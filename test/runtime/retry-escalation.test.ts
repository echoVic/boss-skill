import { spawnSync } from 'node:child_process';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import * as runtime from '../../packages/boss-cli/src/runtime/application/pipeline.js';
import { materializeState } from '../../packages/boss-cli/src/runtime/projectors/materialize-state.js';
import { ensureBuilt } from '../helpers/run-cli.js';

const BOSS_ENTRYPOINT = 'packages/boss-cli/dist/bin/boss.js';
const REPO_ROOT = path.resolve(import.meta.dirname, '..', '..');

/**
 * 阶段重试是「agent 重试耗尽」之后的升级手段，必须真的给这一阶段的 agent 重新发预算。
 *
 * 编排循环第 8 步：「只重试失败 Agent：retry-agent；Agent 达上限后才用 retry-stage」。
 * 但 retry-stage 只把阶段推回 running，不动 agent 的 retryCount——升级之后
 * retry-agent 仍然报「已达最大重试次数」，文档给出的恢复阶梯最上面一级是空的。
 * 这与此前 feedbackLoops.currentRound 只增不减是同一类问题：单调计数无人对账。
 */
describe('stage retry re-arms the agents in that stage', () => {
  let tmpDir: string;
  const feature = 'retry-feat';

  function agent() {
    return materializeState(feature, tmpDir).state.stages['3']?.agents?.['boss-backend'];
  }

  function exhaustAgent(): void {
    runtime.updateStage(feature, 3, 'running', { cwd: tmpDir });
    for (let round = 0; round < 3; round += 1) {
      runtime.updateAgent(feature, 3, 'boss-backend', 'failed', {
        cwd: tmpDir,
        reason: `boom-${round}`,
      });
      if (round < 2) runtime.retryAgent(feature, 3, 'boss-backend', { cwd: tmpDir });
    }
  }

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'boss-retry-'));
    runtime.initPipeline(feature, { cwd: tmpDir });
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it('exhausts the agent budget as before', () => {
    exhaustAgent();
    expect(agent()?.retryCount).toBe(2);
    expect(() => runtime.retryAgent(feature, 3, 'boss-backend', { cwd: tmpDir })).toThrow(
      /最大重试次数/,
    );
  });

  it('resets that budget when the stage is retried', () => {
    exhaustAgent();
    runtime.updateStage(feature, 3, 'failed', { cwd: tmpDir, reason: 'agents exhausted' });
    runtime.retryStage(feature, 3, { cwd: tmpDir });

    expect(agent()?.retryCount).toBe(0);
  });

  it('lets the documented escalation actually recover the agent', () => {
    exhaustAgent();
    runtime.updateStage(feature, 3, 'failed', { cwd: tmpDir, reason: 'agents exhausted' });
    runtime.retryStage(feature, 3, { cwd: tmpDir });

    // 升级之后 retry-agent 必须可用，否则这一级阶梯没有意义
    runtime.updateAgent(feature, 3, 'boss-backend', 'failed', { cwd: tmpDir, reason: 'again' });
    expect(() => runtime.retryAgent(feature, 3, 'boss-backend', { cwd: tmpDir })).not.toThrow();
  });

  it('leaves agents in other stages untouched', () => {
    runtime.updateStage(feature, 1, 'running', { cwd: tmpDir });
    runtime.updateAgent(feature, 1, 'boss-pm', 'failed', { cwd: tmpDir, reason: 'x' });
    runtime.retryAgent(feature, 1, 'boss-pm', { cwd: tmpDir });
    exhaustAgent();
    runtime.updateStage(feature, 3, 'failed', { cwd: tmpDir, reason: 'y' });
    runtime.retryStage(feature, 3, { cwd: tmpDir });

    const stage1Agent = materializeState(feature, tmpDir).state.stages['1']?.agents?.['boss-pm'];
    expect(stage1Agent?.retryCount).toBe(1);
  });
});

/**
 * 领域条件不是内部故障：调用方有明确的下一步，错误码必须能区分。
 *
 * 实测中有六条这样的消息全部落到 internal_error，建议一律是
 * 「Re-run with --describe to verify command parameters」——对「已达最大重试次数」
 * 这种情况毫无帮助，而编排循环恰好规定了该做什么（升级到 retry-stage）。
 */
describe('domain conditions get typed error codes', () => {
  let tmpDir: string;

  function run(args: string[]): { code: string; suggestion: string } {
    ensureBuilt(BOSS_ENTRYPOINT);
    const result = spawnSync(
      process.execPath,
      [path.join(REPO_ROOT, BOSS_ENTRYPOINT), ...args, '--json'],
      { cwd: tmpDir, encoding: 'utf8' },
    );
    const payload = JSON.parse(result.stderr) as {
      error: { code: string; suggestion?: string };
    };
    return { code: payload.error.code, suggestion: payload.error.suggestion ?? '' };
  }

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'boss-codes-'));
    runtime.initPipeline('codes-feat', { cwd: tmpDir });
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it('points an exhausted agent at the documented escalation', () => {
    runtime.updateStage('codes-feat', 3, 'running', { cwd: tmpDir });
    for (let round = 0; round < 3; round += 1) {
      runtime.updateAgent('codes-feat', 3, 'boss-backend', 'failed', {
        cwd: tmpDir,
        reason: 'x',
      });
      if (round < 2) runtime.retryAgent('codes-feat', 3, 'boss-backend', { cwd: tmpDir });
    }

    const { code, suggestion } = run([
      'runtime',
      'retry-agent',
      'codes-feat',
      '3',
      'boss-backend',
      '--yes',
    ]);
    expect(code).toBe('retry_budget_exhausted');
    expect(suggestion).toContain('retry-stage');
  });

  it('names the legal transitions when a status change is rejected', () => {
    const { code, suggestion } = run(['runtime', 'update-stage', 'codes-feat', '1', 'completed']);
    expect(code).toBe('invalid_state_transition');
    expect(suggestion.length).toBeGreaterThan(0);
  });

  it('types a run id mismatch instead of calling it internal', () => {
    const { code } = run(['runtime', 'resume', 'codes-feat', '--from-run', 'bogus']);
    expect(code).toBe('run_id_mismatch');
  });

  it('types an exhausted feedback loop', () => {
    for (let round = 0; round < 2; round += 1) {
      runtime.recordFeedback('codes-feat', {
        cwd: tmpDir,
        from: 'boss-qa',
        to: 'boss-backend',
        artifact: 'code',
        reason: `r${round}`,
      });
    }
    const { code } = run([
      'runtime',
      'record-feedback',
      'codes-feat',
      '--from',
      'boss-qa',
      '--to',
      'boss-backend',
      '--artifact',
      'code',
      '--reason',
      'r3',
    ]);
    expect(code).toBe('feedback_budget_exhausted');
  });
});

/**
 * 第 5 轮实测补充：门禁未找到与多余位置参数。
 *
 * 后者尤其值得单列——本 CLI 的布尔选项用的是成对旗标（`--gate-passed` / `--gate-failed`），
 * 而多数人会先试 `--gate-passed false`，得到的却是「多余的参数: false」加一句
 * 「用 --describe 确认参数」，完全没提成对旗标这回事。
 */
describe('round-five error codes', () => {
  let tmpDir: string;

  function run(args: string[]): { code: string; suggestion: string } {
    ensureBuilt(BOSS_ENTRYPOINT);
    const result = spawnSync(
      process.execPath,
      [path.join(REPO_ROOT, BOSS_ENTRYPOINT), ...args, '--json'],
      { cwd: tmpDir, encoding: 'utf8' },
    );
    const payload = JSON.parse(result.stderr) as { error: { code: string; suggestion?: string } };
    return { code: payload.error.code, suggestion: payload.error.suggestion ?? '' };
  }

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'boss-r5-'));
    runtime.initPipeline('r5-feat', { cwd: tmpDir });
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it('names the real gates when one is not found', () => {
    const { code, suggestion } = run(['runtime', 'evaluate-gates', 'r5-feat', 'nope']);
    expect(code).toBe('gate_not_found');
    expect(suggestion).toContain('gate0');
  });

  it('explains paired boolean flags on a stray positional', () => {
    runtime.updateStage('r5-feat', 3, 'running', { cwd: tmpDir });
    const { code, suggestion } = run([
      'runtime',
      'update-stage',
      'r5-feat',
      '3',
      'completed',
      '--gate',
      'gate0',
      '--gate-passed',
      'false',
    ]);
    expect(code).toBe('invalid_usage');
    expect(suggestion).toContain('--gate-failed');
  });
});
