import { afterEach, describe, expect, it } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { run } from '../../scripts/hooks/subagent-start.js';
import {
  buildFeatureSummary,
  writeFeatureMemory
} from '../../runtime/cli/lib/memory-runtime.js';

function createTempBossDir(feature: string, execData?: Record<string, unknown>) {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'boss-test-'));
  const metaDir = path.join(tmpDir, '.boss', feature, '.meta');
  fs.mkdirSync(metaDir, { recursive: true });

  if (execData) {
    fs.writeFileSync(
      path.join(metaDir, 'execution.json'),
      `${JSON.stringify(execData, null, 2)}\n`,
      'utf8'
    );
    const timestamp = typeof execData.createdAt === 'string' ? execData.createdAt : '2024-01-01T00:00:00Z';
    fs.writeFileSync(
      path.join(metaDir, 'events.jsonl'),
      `${JSON.stringify({
        id: 1,
        type: 'PipelineInitialized',
        timestamp,
        data: { initialState: execData }
      })}\n`,
      'utf8'
    );
  }

  return tmpDir;
}

function createExecData(overrides: Record<string, unknown>) {
  return {
    feature: 'test-feature',
    status: 'running',
    version: '3.2.0',
    stages: {
      '1': { name: 'Planning', status: 'completed', artifacts: [] },
      '2': { name: 'Review', status: 'running', artifacts: [] },
      '3': { name: 'Development', status: 'pending', artifacts: [] },
      '4': { name: 'Deployment', status: 'pending', artifacts: [] }
    },
    ...overrides
  };
}

function cleanupTempDir(dir: string) {
  fs.rmSync(dir, { recursive: true, force: true });
}

describe('subagent-start hook', () => {
  let tmpDir: string | null = null;

  afterEach(() => {
    if (tmpDir) {
      cleanupTempDir(tmpDir);
      tmpDir = null;
    }
  });

  it('returns empty string when cwd is empty', () => {
    expect(run(JSON.stringify({ cwd: '' }))).toBe('');
  });

  it('returns empty string when no active pipeline', () => {
    expect(run(JSON.stringify({ cwd: '/nonexistent' }))).toBe('');
  });

  it('returns pipeline context when active', () => {
    const execData = createExecData({ feature: 'test-feat', status: 'running' });
    tmpDir = createTempBossDir('test-feat', execData);

    const result = run(JSON.stringify({
      cwd: tmpDir,
      agent_type: 'code'
    }));

    expect(result.length).toBeGreaterThan(0);

    const parsed = JSON.parse(result) as {
      hookSpecificOutput: { additionalContext: string };
    };

    expect(parsed.hookSpecificOutput.additionalContext).toContain('test-feat');
    expect(parsed.hookSpecificOutput.additionalContext).toContain('code');
    expect(parsed.hookSpecificOutput.additionalContext).toContain('BOSS_STATUS');
  });

  it('marks known boss agents as running in execution state and emits progress', () => {
    const execData = createExecData({
      feature: 'test-feat',
      status: 'running',
      stages: {
        '1': { name: 'Planning', status: 'completed', artifacts: [] },
        '2': { name: 'Review', status: 'completed', artifacts: [], agents: {} },
        '3': {
          name: 'Development',
          status: 'running',
          artifacts: [],
          agents: { 'boss-backend': { status: 'pending' } }
        },
        '4': { name: 'Deployment', status: 'pending', artifacts: [] }
      }
    });
    tmpDir = createTempBossDir('test-feat', execData);

    const result = run(JSON.stringify({
      cwd: tmpDir,
      agent_type: 'boss-backend'
    }));

    const parsed = JSON.parse(result) as {
      hookSpecificOutput: { additionalContext: string };
    };
    const execution = JSON.parse(
      fs.readFileSync(path.join(tmpDir, '.boss', 'test-feat', '.meta', 'execution.json'), 'utf8')
    ) as {
      stages: {
        '3': {
          agents: {
            'boss-backend': { status: string };
          };
        };
      };
    };
    const progressLog = fs.readFileSync(
      path.join(tmpDir, '.boss', 'test-feat', '.meta', 'progress.jsonl'),
      'utf8'
    );

    expect(parsed.hookSpecificOutput.additionalContext).toContain('boss-backend');
    expect(execution.stages['3']?.agents['boss-backend']?.status).toBe('running');
    expect(progressLog).toContain('"type":"agent-start"');
  });

  it('includes a memory section when relevant memories exist for the agent stage', () => {
    const execData = createExecData({
      feature: 'test-feat',
      status: 'running',
      stages: {
        '1': { name: 'Planning', status: 'completed', artifacts: [] },
        '2': { name: 'Review', status: 'completed', artifacts: [], agents: {} },
        '3': {
          name: 'Development',
          status: 'running',
          artifacts: [],
          agents: { 'boss-backend': { status: 'pending' } }
        },
        '4': { name: 'Deployment', status: 'pending', artifacts: [] }
      }
    });
    tmpDir = createTempBossDir('test-feat', execData);

    writeFeatureMemory('test-feat', [{
      id: 'm1',
      scope: 'feature',
      kind: 'execution',
      category: 'agent_failure_pattern',
      feature: 'test-feat',
      stage: 3,
      agent: 'boss-backend',
      summary: 'Backend timed out in stage 3',
      source: { type: 'events' },
      evidence: [{ type: 'event', ref: '5' }],
      tags: ['boss-backend'],
      confidence: 0.9,
      createdAt: '2026-04-17T00:00:00Z',
      lastSeenAt: '2026-04-17T00:00:00Z',
      expiresAt: null,
      decayScore: 10,
      influence: 'preference'
    }], { cwd: tmpDir });
    buildFeatureSummary('test-feat', { cwd: tmpDir });

    const result = run(JSON.stringify({ cwd: tmpDir, agent_type: 'boss-backend' }));
    const parsed = JSON.parse(result) as {
      hookSpecificOutput: { additionalContext: string };
    };

    expect(parsed.hookSpecificOutput.additionalContext).toMatch(/记忆提示/);
    expect(parsed.hookSpecificOutput.additionalContext).toMatch(/Backend timed out in stage 3/);
  });
});
