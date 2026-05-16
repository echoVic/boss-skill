import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import {
  enqueueKnowledgeJob,
  paths,
  processKnowledgeJobs,
  readKnowledgeJobs
} from '../../packages/boss-cli/src/runtime/knowledge/jobs.js';
import { startKnowledgeWorker } from '../../packages/boss-cli/src/runtime/application/knowledge.js';
import { readGlobalKnowledge, readProjectKnowledge } from '../../packages/boss-cli/src/runtime/knowledge/store.js';
import { main as workerMain } from '../../packages/boss-cli/src/runtime/knowledge/worker.js';

describe('knowledge worker runtime', () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'boss-knowledge-job-'));
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true, maxRetries: 5, retryDelay: 200 });
    vi.restoreAllMocks();
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });

  it('queues a knowledge job and processes it with a fake LLM client', async () => {
    const extract = vi.fn(async () => ({
      records: [
        {
          id: 'k1',
          scope: 'project' as const,
          kind: 'decision' as const,
          category: 'workflow_decision',
          subject: 'feature',
          summary: 'Use background LLM extraction',
          source: { type: 'runtime-event', ref: '17' },
          evidence: [{ type: 'runtime-event', ref: '17' }],
          confidence: 0.95,
          createdAt: '2026-05-10T00:00:00Z',
          lastSeenAt: '2026-05-10T00:00:00Z',
          expiresAt: null,
          decayScore: 9
        }
      ]
    }));

    const job = enqueueKnowledgeJob(
      'feat-a',
      {
        sources: [{ type: 'runtime-event', ref: '17' }]
      },
      { cwd: tmpDir }
    );

    const result = await processKnowledgeJobs('feat-a', {
      cwd: tmpDir,
      client: { extract }
    });

    expect(job.status).toBe('pending');
    expect(fs.existsSync(paths.knowledgeJobsPath(tmpDir, 'feat-a'))).toBe(true);
    expect(readKnowledgeJobs('feat-a', { cwd: tmpDir })[0]).toMatchObject({
      id: job.id,
      status: 'pending'
    });
    expect(extract).toHaveBeenCalledWith(job.payload, job);
    expect(result).toEqual({ processed: 1, failed: 0 });
    expect(readProjectKnowledge('feat-a', { cwd: tmpDir }).records[0]?.summary).toBe(
      'Use background LLM extraction'
    );
    expect(readKnowledgeJobs('feat-a', { cwd: tmpDir }).map((entry) => entry.status)).toEqual([
      'pending',
      'processing',
      'succeeded'
    ]);
  });

  it('leaves queued jobs pending when no LLM client is configured', async () => {
    enqueueKnowledgeJob(
      'feat-a',
      {
        sources: [{ type: 'runtime-event', ref: '17' }]
      },
      { cwd: tmpDir }
    );

    const result = await processKnowledgeJobs('feat-a', { cwd: tmpDir });

    expect(result).toEqual({ processed: 0, failed: 0 });
    expect(readKnowledgeJobs('feat-a', { cwd: tmpDir }).map((entry) => entry.status)).toEqual(['pending']);
  });

  it('uses the configured default LLM client when environment credentials are present', async () => {
    vi.stubEnv('OPENAI_API_KEY', 'test-key');
    vi.stubEnv('BOSS_KNOWLEDGE_MODEL', 'test-model');
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => ({
        ok: true,
        json: async () => ({
          output_text: JSON.stringify({
            records: [
              {
                id: 'k-default-client',
                scope: 'project',
                kind: 'fact',
                category: 'workflow_fact',
                subject: 'runtime',
                summary: 'Default client can process configured jobs',
                source: { type: 'runtime-event', ref: '17' },
                evidence: [{ type: 'runtime-event', ref: '17' }],
                confidence: 0.9,
                createdAt: '2026-05-10T00:00:00Z',
                lastSeenAt: '2026-05-10T00:00:00Z',
                expiresAt: null,
                decayScore: 5
              }
            ]
          })
        })
      }))
    );
    enqueueKnowledgeJob(
      'feat-a',
      {
        sources: [{ type: 'runtime-event', ref: '17' }]
      },
      { cwd: tmpDir }
    );

    const result = await processKnowledgeJobs('feat-a', { cwd: tmpDir });

    expect(result).toEqual({ processed: 1, failed: 0 });
    expect(fetch).toHaveBeenCalledWith(
      'https://api.openai.com/v1/responses',
      expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining({
          Authorization: 'Bearer test-key'
        })
      })
    );
    expect(readProjectKnowledge('feat-a', { cwd: tmpDir }).records[0]?.summary).toBe(
      'Default client can process configured jobs'
    );
  });

  it('drains jobs enqueued while the worker is already processing', async () => {
    enqueueKnowledgeJob('feat-a', { sources: [{ type: 'runtime-event', ref: '17' }] }, { cwd: tmpDir });

    let calls = 0;
    const result = await processKnowledgeJobs('feat-a', {
      cwd: tmpDir,
      client: {
        extract: vi.fn(async () => {
          calls += 1;
          if (calls === 1) {
            enqueueKnowledgeJob('feat-a', { sources: [{ type: 'runtime-event', ref: '18' }] }, { cwd: tmpDir });
          }
          return {
            records: [
              {
                id: `k-drain-${calls}`,
                scope: 'project' as const,
                kind: 'fact' as const,
                category: 'workflow_fact',
                subject: `runtime-${calls}`,
                summary: `Drain job ${calls}`,
                source: { type: 'runtime-event', ref: String(16 + calls) },
                evidence: [{ type: 'runtime-event', ref: String(16 + calls) }],
                confidence: 0.9,
                createdAt: '2026-05-10T00:00:00Z',
                lastSeenAt: '2026-05-10T00:00:00Z',
                expiresAt: null,
                decayScore: 5
              }
            ]
          };
        })
      }
    });

    expect(result).toEqual({ processed: 2, failed: 0 });
    expect(readProjectKnowledge('feat-a', { cwd: tmpDir }).records).toHaveLength(2);
    expect(readKnowledgeJobs('feat-a', { cwd: tmpDir }).filter((entry) => entry.status === 'pending')).toHaveLength(2);
    expect(readKnowledgeJobs('feat-a', { cwd: tmpDir }).filter((entry) => entry.status === 'succeeded')).toHaveLength(2);
  });

  it('rejects invalid LLM output and keeps the runtime path resilient', async () => {
    enqueueKnowledgeJob(
      'feat-a',
      {
        sources: [{ type: 'runtime-event', ref: '18' }]
      },
      { cwd: tmpDir }
    );

    const result = await processKnowledgeJobs('feat-a', {
      cwd: tmpDir,
      client: {
        extract: vi.fn(async () => ({ records: [{ id: 'bad-output' }] }))
      }
    });

    const jobs = readKnowledgeJobs('feat-a', { cwd: tmpDir });

    expect(result).toEqual({ processed: 0, failed: 1 });
    expect(readProjectKnowledge('feat-a', { cwd: tmpDir }).records).toHaveLength(0);
    expect(jobs.at(-1)?.status).toBe('failed');
    expect(jobs.at(-1)?.error).toContain('Invalid knowledge record');
  });

  it('rejects out-of-range numeric fields from LLM output', async () => {
    enqueueKnowledgeJob(
      'feat-a',
      {
        sources: [{ type: 'runtime-event', ref: '19' }]
      },
      { cwd: tmpDir }
    );

    const result = await processKnowledgeJobs('feat-a', {
      cwd: tmpDir,
      client: {
        extract: vi.fn(async () => ({
          records: [
            {
              id: 'bad-confidence',
              scope: 'project' as const,
              kind: 'fact' as const,
              category: 'workflow_fact',
              subject: 'runtime',
              summary: 'Confidence should stay within bounds',
              source: { type: 'runtime-event', ref: '19' },
              evidence: [{ type: 'runtime-event', ref: '19' }],
              confidence: 7,
              createdAt: '2026-05-10T00:00:00Z',
              lastSeenAt: '2026-05-10T00:00:00Z',
              expiresAt: null,
              decayScore: 1
            }
          ]
        }))
      }
    });

    const jobs = readKnowledgeJobs('feat-a', { cwd: tmpDir });

    expect(result).toEqual({ processed: 0, failed: 1 });
    expect(readProjectKnowledge('feat-a', { cwd: tmpDir }).records).toHaveLength(0);
    expect(jobs.at(-1)?.error).toContain('confidence');
  });

  it('replays stale processing jobs and retries failed jobs within bounds', async () => {
    const staleJob = enqueueKnowledgeJob(
      'feat-a',
      {
        sources: [{ type: 'runtime-event', ref: '20' }]
      },
      { cwd: tmpDir }
    );
    fs.writeFileSync(
      paths.knowledgeJobsPath(tmpDir, 'feat-a'),
      `${JSON.stringify({
        ...staleJob,
        status: 'processing',
        attempts: 1,
        updatedAt: '2026-01-01T00:00:00Z'
      })}\n`,
      'utf8'
    );

    const staleResult = await processKnowledgeJobs('feat-a', {
      cwd: tmpDir,
      client: {
        extract: vi.fn(async () => ({
          records: [
            {
              id: 'k-stale',
              scope: 'project' as const,
              kind: 'lesson' as const,
              category: 'workflow_lesson',
              subject: 'runtime',
              summary: 'Stale processing jobs can be replayed',
              source: { type: 'runtime-event', ref: '20' },
              evidence: [{ type: 'runtime-event', ref: '20' }],
              confidence: 0.9,
              createdAt: '2026-05-10T00:00:00Z',
              lastSeenAt: '2026-05-10T00:10:00Z',
              expiresAt: null,
              decayScore: 8
            }
          ]
        }))
      }
    });

    expect(staleResult).toEqual({ processed: 1, failed: 0 });
    expect(readProjectKnowledge('feat-a', { cwd: tmpDir }).records[0]?.summary).toBe(
      'Stale processing jobs can be replayed'
    );
    expect(readKnowledgeJobs('feat-a', { cwd: tmpDir }).map((entry) => entry.status)).toEqual([
      'processing',
      'processing',
      'succeeded'
    ]);
  });

  it('does not replay stale processing jobs after the retry limit', async () => {
    const job = enqueueKnowledgeJob(
      'feat-a',
      {
        sources: [{ type: 'runtime-event', ref: '20' }]
      },
      { cwd: tmpDir }
    );
    fs.writeFileSync(
      paths.knowledgeJobsPath(tmpDir, 'feat-a'),
      `${JSON.stringify({
        ...job,
        status: 'processing',
        attempts: 3,
        updatedAt: '2026-01-01T00:00:00Z'
      })}\n`,
      'utf8'
    );

    const extract = vi.fn(async () => ({ records: [] }));
    const result = await processKnowledgeJobs('feat-a', {
      cwd: tmpDir,
      client: { extract }
    });

    expect(result).toEqual({ processed: 0, failed: 0 });
    expect(extract).not.toHaveBeenCalled();
  });

  it('clears previous errors when a failed job is retried successfully', async () => {
    const job = enqueueKnowledgeJob(
      'feat-a',
      {
        sources: [{ type: 'runtime-event', ref: '23' }]
      },
      { cwd: tmpDir }
    );
    fs.writeFileSync(
      paths.knowledgeJobsPath(tmpDir, 'feat-a'),
      `${JSON.stringify({
        ...job,
        status: 'failed',
        attempts: 1,
        updatedAt: '2026-05-10T00:00:00Z',
        error: 'temporary failure'
      })}\n`,
      'utf8'
    );

    await processKnowledgeJobs('feat-a', {
      cwd: tmpDir,
      client: {
        extract: vi.fn(async () => ({
          records: [
            {
              id: 'k-retry',
              scope: 'project' as const,
              kind: 'fact' as const,
              category: 'workflow_fact',
              subject: 'runtime',
              summary: 'Retry succeeded',
              source: { type: 'runtime-event', ref: '23' },
              evidence: [{ type: 'runtime-event', ref: '23' }],
              confidence: 0.9,
              createdAt: '2026-05-10T00:00:00Z',
              lastSeenAt: '2026-05-10T00:10:00Z',
              expiresAt: null,
              decayScore: 6
            }
          ]
        }))
      }
    });

    const latest = readKnowledgeJobs('feat-a', { cwd: tmpDir }).at(-1);
    expect(latest?.status).toBe('succeeded');
    expect(latest?.error).toBeUndefined();
  });

  it('promotes stable project records into global knowledge', async () => {
    const stableRecord = {
      id: 'k-stable',
      scope: 'project' as const,
      kind: 'lesson' as const,
      category: 'workflow_lesson',
      subject: 'runtime',
      summary: 'Promote knowledge only after repeated evidence',
      source: { type: 'runtime-event', ref: '21' },
      evidence: [
        { type: 'runtime-event', ref: '21' },
        { type: 'runtime-event', ref: '22' }
      ],
      confidence: 0.91,
      createdAt: '2026-05-10T00:00:00Z',
      lastSeenAt: '2026-05-10T00:10:00Z',
      expiresAt: null,
      decayScore: 8
    };

    enqueueKnowledgeJob('feat-a', { sources: [{ type: 'runtime-event', ref: '21' }] }, { cwd: tmpDir });

    await processKnowledgeJobs('feat-a', {
      cwd: tmpDir,
      client: {
        extract: vi.fn(async () => ({ records: [stableRecord] }))
      }
    });

    expect(readProjectKnowledge('feat-a', { cwd: tmpDir }).records[0]?.scope).toBe('project');
    expect(readGlobalKnowledge({ cwd: tmpDir }).records[0]).toMatchObject({
      scope: 'global',
      summary: 'Promote knowledge only after repeated evidence'
    });
  });

  it('promotes merged project evidence after repeated jobs', async () => {
    enqueueKnowledgeJob('feat-a', { sources: [{ type: 'runtime-event', ref: '24' }] }, { cwd: tmpDir });
    await processKnowledgeJobs('feat-a', {
      cwd: tmpDir,
      client: {
        extract: vi.fn(async () => ({
          records: [
            {
              id: 'k-part-1',
              scope: 'project' as const,
              kind: 'lesson' as const,
              category: 'workflow_lesson',
              subject: 'runtime',
              summary: 'Repeated evidence should promote',
              source: { type: 'runtime-event', ref: '24' },
              evidence: [{ type: 'runtime-event', ref: '24' }],
              confidence: 0.82,
              createdAt: '2026-05-10T00:00:00Z',
              lastSeenAt: '2026-05-10T00:00:00Z',
              expiresAt: null,
              decayScore: 8
            }
          ]
        }))
      }
    });

    enqueueKnowledgeJob('feat-a', { sources: [{ type: 'runtime-event', ref: '25' }] }, { cwd: tmpDir });
    await processKnowledgeJobs('feat-a', {
      cwd: tmpDir,
      client: {
        extract: vi.fn(async () => ({
          records: [
            {
              id: 'k-part-2',
              scope: 'project' as const,
              kind: 'lesson' as const,
              category: 'workflow_lesson',
              subject: 'runtime',
              summary: 'Repeated evidence should promote',
              source: { type: 'runtime-event', ref: '25' },
              evidence: [{ type: 'runtime-event', ref: '25' }],
              confidence: 0.84,
              createdAt: '2026-05-10T00:01:00Z',
              lastSeenAt: '2026-05-10T00:01:00Z',
              expiresAt: null,
              decayScore: 8
            }
          ]
        }))
      }
    });

    expect(readProjectKnowledge('feat-a', { cwd: tmpDir }).records[0]?.evidence).toHaveLength(2);
    expect(readGlobalKnowledge({ cwd: tmpDir }).records[0]?.summary).toBe(
      'Repeated evidence should promote'
    );
  });

  it('starts a detached worker process and returns immediately', () => {
    const unref = vi.fn();
    const spawn = vi.fn(() => ({ unref }));

    const result = startKnowledgeWorker('feat-a', {
      cwd: tmpDir,
      spawn
    });

    expect(result.started).toBe(true);
    expect(spawn).toHaveBeenCalledWith(
      process.execPath,
      expect.arrayContaining([expect.stringContaining('worker.js'), 'feat-a']),
      expect.objectContaining({
        cwd: tmpDir,
        detached: true,
        stdio: 'ignore'
      })
    );
    expect(unref).toHaveBeenCalledOnce();
  });

  it('honors an existing live worker lock even when the timestamp is old', async () => {
    const metaDir = path.join(tmpDir, '.boss', 'feat-a', '.meta');
    fs.mkdirSync(metaDir, { recursive: true });
    const lockPath = path.join(metaDir, 'knowledge-worker.lock');
    fs.writeFileSync(lockPath, `${process.pid}\n2026-01-01T00:00:00Z\n`, 'utf8');

    const result = await workerMain('feat-a', { cwd: tmpDir });

    expect(result).toBe(0);
    expect(fs.existsSync(lockPath)).toBe(true);
  });

  it('treats a freshly created empty lock file as busy instead of deleting it', async () => {
    const metaDir = path.join(tmpDir, '.boss', 'feat-a', '.meta');
    fs.mkdirSync(metaDir, { recursive: true });
    const lockPath = path.join(metaDir, 'knowledge-worker.lock');
    fs.writeFileSync(lockPath, '', 'utf8');

    const result = await workerMain('feat-a', { cwd: tmpDir });

    expect(result).toBe(0);
    expect(fs.existsSync(lockPath)).toBe(true);
  });
});
