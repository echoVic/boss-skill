import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { main as inspectPipelineMain } from '../../packages/boss-cli/src/commands/runtime/inspect-pipeline.js';
import { initPipeline } from '../../packages/boss-cli/src/runtime/application/pipeline.js';
import { inspectPipeline } from '../../packages/boss-cli/src/runtime/application/inspection.js';
import { queryKnowledgeRecords, type KnowledgeQueryRecord } from '../../packages/boss-cli/src/runtime/knowledge/query.js';
import {
  buildAgentSections,
  buildKnowledgeSummary,
  buildStartupSummary
} from '../../packages/boss-cli/src/runtime/knowledge/summarizer.js';
import { saveProjectKnowledgeSummary } from '../../packages/boss-cli/src/runtime/knowledge/store.js';

function record(overrides: Partial<KnowledgeQueryRecord>): KnowledgeQueryRecord {
  return {
    scope: overrides.scope ?? 'project',
    category: overrides.category ?? 'user_preference',
    summary: overrides.summary ?? 'Prefer automatic extraction',
    confidence: overrides.confidence ?? 0.8,
    lastSeenAt: overrides.lastSeenAt ?? '2026-05-01T00:00:00Z',
    expiresAt: overrides.expiresAt === undefined ? null : overrides.expiresAt,
    decayScore: overrides.decayScore ?? 5,
    ...overrides
  };
}

describe('knowledge query runtime', () => {
  let tmpDir: string;
  let cwd: string;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'boss-knowledge-query-'));
    cwd = process.cwd();
    process.chdir(tmpDir);
  });

  afterEach(() => {
    process.chdir(cwd);
    fs.rmSync(tmpDir, { recursive: true, force: true, maxRetries: 5, retryDelay: 200 });
  });

  it('prefers project knowledge before global knowledge and boosts current agent and stage', () => {
    const result = queryKnowledgeRecords(
      [
        record({
          scope: 'global',
          summary: 'Global knowledge has a higher raw score',
          confidence: 0.99,
          decayScore: 100,
          lastSeenAt: '2026-05-09T00:00:00Z'
        }),
        record({
          scope: 'project',
          summary: 'Project backend stage guidance',
          agent: 'boss-backend',
          stage: 3,
          confidence: 0.7,
          decayScore: 4,
          lastSeenAt: '2026-05-02T00:00:00Z'
        }),
        record({
          scope: 'project',
          summary: 'Project frontend guidance',
          agent: 'boss-frontend',
          stage: 3,
          confidence: 0.95,
          decayScore: 20,
          lastSeenAt: '2026-05-09T00:00:00Z'
        })
      ],
      { agent: 'boss-backend', stage: 3, limit: 2, now: '2026-05-10T00:00:00Z' }
    );

    expect(result.map((item) => item.summary)).toEqual([
      'Project backend stage guidance',
      'Global knowledge has a higher raw score'
    ]);
  });

  it('uses confidence, decay score, and recency when ranking otherwise similar records', () => {
    const result = queryKnowledgeRecords(
      [
        record({
          summary: 'Old weaker guidance',
          confidence: 0.4,
          decayScore: 2,
          lastSeenAt: '2026-04-01T00:00:00Z'
        }),
        record({
          summary: 'Fresh stronger guidance',
          confidence: 0.9,
          decayScore: 8,
          lastSeenAt: '2026-05-09T00:00:00Z'
        })
      ],
      { limit: 2, now: '2026-05-10T00:00:00Z' }
    );

    expect(result[0]?.summary).toBe('Fresh stronger guidance');
  });

  it('filters expired records from query and summaries', () => {
    const records = [
      record({
        summary: 'Expired guidance',
        expiresAt: '2026-05-01T00:00:00Z',
        decayScore: 100
      }),
      record({
        summary: 'Active guidance',
        expiresAt: '2026-05-11T00:00:00Z',
        decayScore: 1
      })
    ];

    expect(
      queryKnowledgeRecords(records, { limit: 3, now: '2026-05-10T00:00:00Z' }).map((item) => item.summary)
    ).toEqual(['Active guidance']);
    expect(buildStartupSummary(records, { now: '2026-05-10T00:00:00Z' }).map((item) => item.summary)).toEqual([
      'Active guidance'
    ]);
  });

  it('treats records expiring exactly now as expired', () => {
    const records = [
      record({
        summary: 'Expires on the boundary',
        expiresAt: '2026-05-10T00:00:00Z',
        decayScore: 100
      }),
      record({
        summary: 'Still active after the boundary',
        expiresAt: '2026-05-10T00:00:01Z',
        decayScore: 1
      })
    ];

    expect(
      queryKnowledgeRecords(records, { limit: 3, now: '2026-05-10T00:00:00Z' }).map((item) => item.summary)
    ).toEqual(['Still active after the boundary']);
  });

  it('builds startup summaries and agent sections in the memory summary shape', () => {
    const records = [
      record({
        summary: 'Backend prefers queued extraction',
        agent: 'boss-backend',
        stage: 3
      }),
      record({
        summary: 'QA checks extracted knowledge',
        agent: 'boss-qa',
        stage: 3
      })
    ];

    const startupSummary = buildStartupSummary(records, { limit: 1, now: '2026-05-10T00:00:00Z' });
    const agentSections = buildAgentSections(
      records,
      [
        { name: 'boss-backend', stage: 3 },
        { name: 'boss-qa', stage: 3 }
      ],
      { now: '2026-05-10T00:00:00Z' }
    );

    expect(startupSummary).toEqual([
      {
        category: 'user_preference',
        scope: 'project',
        summary: 'Backend prefers queued extraction'
      }
    ]);
    expect(agentSections).toEqual({
      'boss-backend': [
        {
          category: 'user_preference',
          scope: 'project',
          summary: 'Backend prefers queued extraction'
        }
      ],
      'boss-qa': [
        {
          category: 'user_preference',
          scope: 'project',
          summary: 'QA checks extracted knowledge'
        }
      ]
    });
  });

  it('builds a project-shaped knowledge summary including feature metadata', () => {
    const summary = buildKnowledgeSummary(
      'test-feat',
      [
        record({
          summary: 'Feature metadata should be preserved',
          agent: 'boss-backend',
          stage: 3
        })
      ],
      [{ name: 'boss-backend', stage: 3 }],
      { now: '2026-05-10T00:00:00Z' }
    );

    expect(summary.feature).toBe('test-feat');
    expect(summary.startupSummary[0]?.summary).toBe('Feature metadata should be preserved');
    expect(summary.agentSections['boss-backend']?.[0]?.summary).toBe(
      'Feature metadata should be preserved'
    );
  });

  it('exposes knowledge summaries through inspection and text output', () => {
    initPipeline('test-feat', { cwd: tmpDir });
    saveProjectKnowledgeSummary(
      'test-feat',
      {
        feature: 'test-feat',
        generatedAt: '2026-05-10T00:00:00Z',
        startupSummary: [
          {
            category: 'workflow_decision',
            scope: 'project',
            summary: 'Use knowledge during startup'
          }
        ],
        agentSections: {}
      },
      { cwd: tmpDir }
    );

    const payload = inspectPipeline('test-feat', { cwd: tmpDir });
    expect(payload.knowledge.startupSummary[0]?.summary).toBe('Use knowledge during startup');

    const writes: string[] = [];
    const originalWrite = process.stdout.write;
    const originalIsTty = process.stdout.isTTY;
    process.stdout.write = ((chunk: string | Uint8Array) => {
      writes.push(String(chunk));
      return true;
    }) as typeof process.stdout.write;
    Object.defineProperty(process.stdout, 'isTTY', {
      configurable: true,
      value: true
    });
    try {
      expect(inspectPipelineMain(['test-feat'])).toBe(0);
    } finally {
      process.stdout.write = originalWrite;
      Object.defineProperty(process.stdout, 'isTTY', {
        configurable: true,
        value: originalIsTty
      });
    }

    expect(writes.join('')).toContain('memoryStartup: none');
    expect(writes.join('')).toContain('knowledgeStartup: Use knowledge during startup');
  });
});
