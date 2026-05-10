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

describe('knowledge worker runtime', () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'boss-knowledge-job-'));
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
    vi.restoreAllMocks();
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
      expect.arrayContaining(['runtime', 'process-knowledge-jobs', 'feat-a']),
      expect.objectContaining({
        cwd: tmpDir,
        detached: true,
        stdio: 'ignore'
      })
    );
    expect(unref).toHaveBeenCalledOnce();
  });
});
