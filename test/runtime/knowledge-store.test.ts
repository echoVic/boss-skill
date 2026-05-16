import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import {
  mergeKnowledgeRecords,
  paths,
  readGlobalKnowledge,
  readGlobalKnowledgeSummary,
  readProjectKnowledge,
  readProjectKnowledgeSummary,
  saveGlobalKnowledge,
  saveGlobalKnowledgeSummary,
  saveProjectKnowledge,
  saveProjectKnowledgeSummary
} from '../../packages/boss-cli/src/runtime/knowledge/store.js';
import { cleanupTempDir } from '../helpers/fixtures.js';

describe('knowledge store runtime', () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'boss-knowledge-store-'));
  });

  afterEach(() => {
    cleanupTempDir(tmpDir);
  });

  it('persists and merges project knowledge', () => {
    const payload = saveProjectKnowledge(
      'feat-a',
      [
        {
          id: 'k1',
          scope: 'project',
          kind: 'preference',
          category: 'user_preference',
          subject: 'user',
          summary: 'Prefer automatic extraction',
          source: { type: 'dialogue', ref: 'turn-12' },
          evidence: [{ type: 'dialogue', ref: 'turn-12' }],
          confidence: 0.92,
          createdAt: '2026-05-10T00:00:00Z',
          lastSeenAt: '2026-05-10T00:00:00Z',
          expiresAt: null,
          decayScore: 8
        }
      ],
      { cwd: tmpDir }
    );

    expect(payload.records).toHaveLength(1);
    expect(readProjectKnowledge('feat-a', { cwd: tmpDir }).records[0]?.summary).toBe(
      'Prefer automatic extraction'
    );

    const merged = mergeKnowledgeRecords(payload.records, [
      {
        ...payload.records[0]!,
        id: 'k2',
        summary: 'Prefer automatic extraction in the background',
        evidence: [{ type: 'runtime-event', ref: '18' }],
        confidence: 0.97,
        lastSeenAt: '2026-05-10T00:05:00Z'
      }
    ]);

    expect(merged).toHaveLength(1);
    expect(merged[0]?.summary).toBe('Prefer automatic extraction in the background');
    expect(merged[0]?.evidence).toHaveLength(2);
  });

  it('keeps agent-specific knowledge records distinct during merges', () => {
    const sharedRecord = {
      id: 'k1',
      scope: 'project' as const,
      kind: 'decision' as const,
      category: 'workflow_decision',
      subject: 'runtime',
      summary: 'Use background extraction',
      source: { type: 'dialogue', ref: 'turn-12' },
      evidence: [{ type: 'dialogue', ref: 'turn-12' }],
      confidence: 0.9,
      createdAt: '2026-05-10T00:00:00Z',
      lastSeenAt: '2026-05-10T00:00:00Z',
      expiresAt: null,
      decayScore: 8
    };

    const merged = mergeKnowledgeRecords(
      [
        {
          ...sharedRecord,
          agent: 'boss-backend',
          stage: 3
        }
      ],
      [
        {
          ...sharedRecord,
          id: 'k2',
          agent: 'boss-qa',
          stage: 4,
          summary: 'Use background extraction for QA too',
          evidence: [{ type: 'dialogue', ref: 'turn-13' }],
          createdAt: '2026-05-10T00:01:00Z',
          lastSeenAt: '2026-05-10T00:01:00Z'
        }
      ]
    );

    expect(merged).toHaveLength(2);
    expect(merged.map((record) => record.agent)).toEqual(['boss-backend', 'boss-qa']);
  });

  it('keeps the existing representative record when an older duplicate arrives', () => {
    const current = {
      id: 'k1',
      scope: 'project' as const,
      kind: 'decision' as const,
      category: 'workflow_decision',
      subject: 'feature',
      summary: 'Use background extraction',
      source: { type: 'dialogue', ref: 'turn-12' },
      evidence: [{ type: 'dialogue', ref: 'turn-12' }],
      confidence: 0.9,
      createdAt: '2026-05-10T00:00:00Z',
      lastSeenAt: '2026-05-10T00:05:00Z',
      expiresAt: null,
      decayScore: 8
    };
    const merged = mergeKnowledgeRecords([current], [
      {
        ...current,
        id: 'k-old',
        summary: 'Use background extraction, maybe later',
        source: { type: 'dialogue', ref: 'turn-1' },
        evidence: [{ type: 'dialogue', ref: 'turn-1' }],
        confidence: 0.4,
        createdAt: '2026-05-09T23:59:00Z',
        lastSeenAt: '2026-05-10T00:01:00Z',
        decayScore: 2
      }
    ]);

    expect(merged[0]?.summary).toBe('Use background extraction');
    expect(merged[0]?.source.ref).toBe('turn-12');
    expect(merged[0]?.evidence).toHaveLength(2);
  });

  it('persists global knowledge and summaries under the global knowledge directory', () => {
    saveGlobalKnowledge(
      [
        {
          id: 'g1',
          scope: 'global',
          kind: 'fact',
          category: 'workflow_fact',
          subject: 'runtime',
          summary: 'Knowledge is stored separately from execution memory',
          source: { type: 'artifact', ref: 'spec-1' },
          evidence: [{ type: 'artifact', ref: 'spec-1' }],
          confidence: 0.88,
          createdAt: '2026-05-10T00:00:00Z',
          lastSeenAt: '2026-05-10T00:00:00Z',
          expiresAt: null,
          decayScore: 4
        }
      ],
      { cwd: tmpDir }
    );
    saveProjectKnowledgeSummary(
      'feat-a',
      {
        feature: 'feat-a',
        generatedAt: '2026-05-10T00:00:00Z',
        startupSummary: [{ category: 'workflow_fact', scope: 'project', summary: 'Project facts stay local' }],
        agentSections: {}
      },
      { cwd: tmpDir }
    );
    saveGlobalKnowledgeSummary(
      {
        generatedAt: '2026-05-10T00:00:00Z',
        startupSummary: [{ category: 'workflow_fact', scope: 'global', summary: 'Global knowledge is shared' }],
        agentSections: {}
      },
      { cwd: tmpDir }
    );

    expect(readGlobalKnowledge({ cwd: tmpDir }).records[0]?.scope).toBe('global');
    expect(
      readProjectKnowledgeSummary('feat-a', { cwd: tmpDir }).startupSummary[0]?.summary
    ).toBe('Project facts stay local');
    expect(
      readGlobalKnowledgeSummary({ cwd: tmpDir }).startupSummary[0]?.summary
    ).toBe('Global knowledge is shared');
    expect(paths.projectKnowledgePath(tmpDir, 'feat-a')).toBe(
      path.join(tmpDir, '.boss', 'feat-a', '.meta', 'project-knowledge.json')
    );
    expect(paths.globalKnowledgePath(tmpDir)).toBe(
      path.join(tmpDir, '.boss', '.knowledge', 'global-knowledge.json')
    );
  });

  it('merges repeated saves through the read-then-write helpers', () => {
    saveProjectKnowledge(
      'feat-a',
      [
        {
          id: 'k1',
          scope: 'project',
          kind: 'lesson',
          category: 'workflow_lesson',
          subject: 'runtime',
          summary: 'Prefer separate knowledge storage',
          source: { type: 'artifact', ref: 'spec-1' },
          evidence: [{ type: 'artifact', ref: 'spec-1' }],
          confidence: 0.75,
          createdAt: '2026-05-10T00:00:00Z',
          lastSeenAt: '2026-05-10T00:00:00Z',
          expiresAt: null,
          decayScore: 3
        }
      ],
      { cwd: tmpDir }
    );
    const second = saveProjectKnowledge(
      'feat-a',
      [
        {
          id: 'k2',
          scope: 'project',
          kind: 'lesson',
          category: 'workflow_lesson',
          subject: 'runtime',
          summary: 'Prefer separate knowledge storage and summaries',
          source: { type: 'artifact', ref: 'spec-2' },
          evidence: [{ type: 'artifact', ref: 'spec-2' }],
          confidence: 0.8,
          createdAt: '2026-05-10T00:01:00Z',
          lastSeenAt: '2026-05-10T00:01:00Z',
          expiresAt: null,
          decayScore: 4
        }
      ],
      { cwd: tmpDir }
    );

    expect(second.records).toHaveLength(1);
    expect(readProjectKnowledge('feat-a', { cwd: tmpDir }).records[0]?.evidence).toHaveLength(2);
  });
});
