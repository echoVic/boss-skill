import { afterEach, describe, expect, it } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { run } from '../../scripts/hooks/session-start.js';

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

describe('session-start hook', () => {
  let tmpDir: string | null = null;
  const originalSkillDir = process.env.SKILL_DIR;
  const originalClaudeProjectDir = process.env.CLAUDE_PROJECT_DIR;

  afterEach(() => {
    if (tmpDir) {
      cleanupTempDir(tmpDir);
      tmpDir = null;
    }

    if (originalSkillDir !== undefined) {
      process.env.SKILL_DIR = originalSkillDir;
    } else {
      delete process.env.SKILL_DIR;
    }

    if (originalClaudeProjectDir !== undefined) {
      process.env.CLAUDE_PROJECT_DIR = originalClaudeProjectDir;
    } else {
      delete process.env.CLAUDE_PROJECT_DIR;
    }
  });

  it('returns empty string when cwd is empty', () => {
    expect(run(JSON.stringify({ cwd: '' }))).toBe('');
  });

  it('returns empty string when no active pipeline and no plugins', () => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'boss-test-'));
    process.env.SKILL_DIR = tmpDir;
    delete process.env.CLAUDE_PROJECT_DIR;

    expect(run(JSON.stringify({ cwd: tmpDir }))).toBe('');
  });

  it('detects active pipeline and returns context', () => {
    const execData = createExecData({ feature: 'test-feat', status: 'running' });
    tmpDir = createTempBossDir('test-feat', execData);

    const result = run(JSON.stringify({ cwd: tmpDir }));
    expect(result.length).toBeGreaterThan(0);

    const parsed = JSON.parse(result) as {
      hookSpecificOutput: { additionalContext: string };
    };

    expect(parsed.hookSpecificOutput.additionalContext).toContain('test-feat');
  });

  it('surfaces active plugin count from runtime execution state without scanning plugin dir', () => {
    const execData = createExecData({
      feature: 'test-feat',
      status: 'running',
      plugins: [{ name: 'security-audit', version: '1.0.0', type: 'gate' }],
      metrics: {
        totalDuration: 60,
        stageTimings: { '1': 30 },
        gatePassRate: 100,
        retryTotal: 0,
        agentSuccessCount: 1,
        agentFailureCount: 0,
        meanRetriesPerStage: 0,
        revisionLoopCount: 0,
        pluginFailureCount: 0
      }
    });
    tmpDir = createTempBossDir('test-feat', execData);

    const result = run(JSON.stringify({ cwd: tmpDir }));
    const parsed = JSON.parse(result) as {
      hookSpecificOutput: { additionalContext: string };
    };

    expect(parsed.hookSpecificOutput.additionalContext).toMatch(/1 plugin\(s\) registered/);
  });
});
