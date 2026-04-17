import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

import { cleanupTempDir, createExecData, createTempBossDir } from '../helpers/fixtures.js';

describe('session-end hook', () => {
  let hook: typeof import('../../scripts/hooks/session-end.js');
  let tmpDir: string | null = null;
  const originalSkillDir = process.env.SKILL_DIR;
  const originalClaudeProjectDir = process.env.CLAUDE_PROJECT_DIR;

  beforeEach(async () => {
    vi.resetModules();
    hook = await import('../../scripts/hooks/session-end.js');
  });

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

  it('returns empty string when no .boss dir', () => {
    expect(hook.run(JSON.stringify({ cwd: '/nonexistent' }))).toBe('');
  });

  it('saves session state for running pipeline', () => {
    const execData = createExecData({ feature: 'test-feat', status: 'running' });
    tmpDir = createTempBossDir('test-feat', execData);

    process.env.SKILL_DIR = '/nonexistent';

    hook.run(JSON.stringify({ cwd: tmpDir }));

    const sessionStatePath = path.join(tmpDir, '.boss', '.session-state.json');
    expect(fs.existsSync(sessionStatePath)).toBe(true);

    const state = JSON.parse(fs.readFileSync(sessionStatePath, 'utf8')) as {
      feature: string;
      pipelineStatus: string;
    };
    expect(state.feature).toBe('test-feat');
    expect(state.pipelineStatus).toBe('running');
  });

  it('skips features with unknown/initialized status', () => {
    const execData = createExecData({ feature: 'test-feat', status: 'initialized' });
    tmpDir = createTempBossDir('test-feat', execData);

    process.env.SKILL_DIR = '/nonexistent';

    hook.run(JSON.stringify({ cwd: tmpDir }));

    const sessionStatePath = path.join(tmpDir, '.boss', '.session-state.json');
    expect(fs.existsSync(sessionStatePath)).toBe(false);
  });

  it('generates summary report through runtime modules even without SKILL_DIR', () => {
    const execData = createExecData({
      feature: 'test-feat',
      status: 'running',
      schemaVersion: '0.2.0',
      createdAt: '2026-04-12T00:00:00Z',
      updatedAt: '2026-04-12T00:01:00Z',
      parameters: { pipelinePack: 'default' },
      qualityGates: {
        gate0: { status: 'pending', passed: null, checks: [], executedAt: null },
        gate1: { status: 'pending', passed: null, checks: [], executedAt: null },
        gate2: { status: 'pending', passed: null, checks: [], executedAt: null }
      },
      metrics: {
        totalDuration: 60,
        stageTimings: { '1': 30 },
        gatePassRate: null,
        retryTotal: 0,
        agentSuccessCount: 0,
        agentFailureCount: 0,
        meanRetriesPerStage: 0,
        revisionLoopCount: 0,
        pluginFailureCount: 0
      },
      plugins: [],
      pluginLifecycle: { discovered: [], activated: [], executed: [], failed: [] },
      humanInterventions: [],
      revisionRequests: [],
      feedbackLoops: { maxRounds: 2, currentRound: 0 }
    });
    tmpDir = createTempBossDir('test-feat', execData);

    delete process.env.SKILL_DIR;
    delete process.env.CLAUDE_PROJECT_DIR;

    hook.run(JSON.stringify({ cwd: tmpDir }));

    const summaryPath = path.join(tmpDir, '.boss', 'test-feat', 'summary-report.md');
    expect(fs.existsSync(summaryPath)).toBe(true);
    expect(fs.readFileSync(summaryPath, 'utf8')).toMatch(/# 流水线执行报告/);
  });
});
