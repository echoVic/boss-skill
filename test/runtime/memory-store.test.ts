import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import {
  mergeRecords,
  paths,
  saveFeatureMemory,
  saveFeatureSummary,
  saveGlobalMemory,
  saveGlobalSummary
} from '../../src/runtime/memory/store.js';

describe('memory store runtime', () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'boss-memory-store-'));
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it('persists feature memory records under .boss/<feature>/.meta', () => {
    saveFeatureMemory(
      'test-feat',
      [
        {
          id: 'm1',
          scope: 'feature',
          kind: 'execution',
          category: 'gate_failure_pattern',
          summary: 'Gate 1 failed twice',
          source: { type: 'events' },
          evidence: [{ type: 'event', ref: '2' }],
          tags: ['gate1'],
          confidence: 0.8,
          createdAt: '2026-04-17T00:00:00Z',
          lastSeenAt: '2026-04-17T00:00:00Z',
          expiresAt: null,
          decayScore: 10,
          influence: 'preference'
        }
      ],
      { cwd: tmpDir }
    );

    const payload = JSON.parse(
      fs.readFileSync(path.join(tmpDir, '.boss', 'test-feat', '.meta', 'feature-memory.json'), 'utf8')
    ) as { records: Array<{ category: string }> };

    expect(payload.records).toHaveLength(1);
    expect(payload.records[0]?.category).toBe('gate_failure_pattern');
    expect(paths.featureMemoryPath(tmpDir, 'test-feat')).toBe(
      path.join(tmpDir, '.boss', 'test-feat', '.meta', 'feature-memory.json')
    );
  });

  it('dedupes matching records and updates lastSeenAt, decayScore, and evidence', () => {
    const merged = mergeRecords(
      [
        {
          id: 'm1',
          scope: 'feature',
          kind: 'execution',
          category: 'retry_lesson',
          feature: 'test-feat',
          stage: 3,
          agent: 'boss-backend',
          summary: 'Backend retried',
          source: { type: 'events' },
          evidence: [{ type: 'event', ref: '3' }],
          tags: ['retry'],
          confidence: 0.6,
          createdAt: '2026-04-17T00:00:00Z',
          lastSeenAt: '2026-04-17T00:00:00Z',
          expiresAt: null,
          decayScore: 5,
          influence: 'preference'
        }
      ],
      [
        {
          id: 'm2',
          scope: 'feature',
          kind: 'execution',
          category: 'retry_lesson',
          feature: 'test-feat',
          stage: 3,
          agent: 'boss-backend',
          summary: 'Backend retried again',
          source: { type: 'events' },
          evidence: [{ type: 'event', ref: '4' }],
          tags: ['retry'],
          confidence: 0.8,
          createdAt: '2026-04-18T00:00:00Z',
          lastSeenAt: '2026-04-18T00:00:00Z',
          expiresAt: null,
          decayScore: 9,
          influence: 'preference'
        }
      ]
    );

    expect(merged).toHaveLength(1);
    expect(merged[0]?.lastSeenAt).toBe('2026-04-18T00:00:00Z');
    expect(merged[0]?.decayScore).toBe(9);
    expect(merged[0]?.evidence).toHaveLength(2);
  });

  it('persists summaries separately from raw feature and global records', () => {
    saveFeatureSummary(
      'test-feat',
      {
        feature: 'test-feat',
        generatedAt: '2026-04-17T00:00:00Z',
        startupSummary: [
          { category: 'historical_risk', scope: 'feature', summary: 'Stage 3 is unstable' }
        ],
        agentSections: {
          'boss-qa': [{ category: 'retry_lesson', summary: 'Check backend retry path' }]
        }
      },
      { cwd: tmpDir }
    );
    saveGlobalMemory(
      [
        {
          id: 'g1',
          scope: 'global',
          kind: 'long_term',
          category: 'gate_failure_pattern',
          summary: 'Gate 1 fails across features',
          source: { type: 'aggregation' },
          evidence: [{ type: 'feature', ref: 'feat-a' }],
          tags: ['gate1'],
          confidence: 0.9,
          createdAt: '2026-04-18T00:00:00Z',
          lastSeenAt: '2026-04-18T00:00:00Z',
          expiresAt: null,
          decayScore: 11,
          influence: 'preference'
        }
      ],
      { cwd: tmpDir }
    );
    saveGlobalSummary(
      {
        generatedAt: '2026-04-18T00:00:00Z',
        startupSummary: [{ category: 'gate_failure_pattern', scope: 'global', summary: 'Gate 1 fails' }],
        agentSections: {}
      },
      { cwd: tmpDir }
    );

    const featureSummary = JSON.parse(
      fs.readFileSync(path.join(tmpDir, '.boss', 'test-feat', '.meta', 'memory-summary.json'), 'utf8')
    ) as { agentSections: Record<string, Array<{ summary: string }>> };
    const globalMemory = JSON.parse(
      fs.readFileSync(path.join(tmpDir, '.boss', '.memory', 'global-memory.json'), 'utf8')
    ) as { records: Array<{ scope: string }> };
    const globalSummary = JSON.parse(
      fs.readFileSync(path.join(tmpDir, '.boss', '.memory', 'global-memory-summary.json'), 'utf8')
    ) as { startupSummary: Array<{ summary: string }> };

    expect(featureSummary.agentSections['boss-qa']?.[0]?.summary).toBe('Check backend retry path');
    expect(globalMemory.records[0]?.scope).toBe('global');
    expect(globalSummary.startupSummary[0]?.summary).toBe('Gate 1 fails');
  });
});
