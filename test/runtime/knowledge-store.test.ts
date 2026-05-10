import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import {
  mergeKnowledgeRecords,
  paths,
  readGlobalKnowledge,
  readProjectKnowledge,
  saveGlobalKnowledge,
  saveGlobalKnowledgeSummary,
  saveProjectKnowledge,
  saveProjectKnowledgeSummary
} from '../../packages/boss-cli/src/runtime/knowledge/store.js';

describe('knowledge store runtime', () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'boss-knowledge-store-'));
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
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
      JSON.parse(
        fs.readFileSync(path.join(tmpDir, '.boss', 'feat-a', '.meta', 'knowledge-summary.json'), 'utf8')
      ).startupSummary[0]?.summary
    ).toBe('Project facts stay local');
    expect(
      JSON.parse(fs.readFileSync(path.join(tmpDir, '.boss', '.knowledge', 'global-knowledge-summary.json'), 'utf8'))
        .startupSummary[0]?.summary
    ).toBe('Global knowledge is shared');
    expect(paths.projectKnowledgePath(tmpDir, 'feat-a')).toBe(
      path.join(tmpDir, '.boss', 'feat-a', '.meta', 'project-knowledge.json')
    );
    expect(paths.globalKnowledgePath(tmpDir)).toBe(
      path.join(tmpDir, '.boss', '.knowledge', 'global-knowledge.json')
    );
  });
});
