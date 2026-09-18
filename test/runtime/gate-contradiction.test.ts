import { spawnSync } from 'node:child_process';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { evaluateFinalGate } from '../../packages/boss-cli/src/runtime/application/final-gate.js';
import * as runtime from '../../packages/boss-cli/src/runtime/application/pipeline.js';
import { materializeState } from '../../packages/boss-cli/src/runtime/projectors/materialize-state.js';
import { ensureBuilt } from '../helpers/run-cli.js';

const BOSS_ENTRYPOINT = 'packages/boss-cli/dist/bin/boss.js';
const REPO_ROOT = path.resolve(import.meta.dirname, '..', '..');

/**
 * 门禁失败却把阶段标记为完成，是一处必须被看见的矛盾。
 *
 * `updateStage` 的唯一前置校验是状态机表，`running:completed` 无条件合法；门禁结果
 * 通过同一次调用的可选参数进来，而且是在阶段完成事件之后追加的。于是一次调用可以
 * 同时写下「门禁未通过」和「阶段已完成」，状态会忠实记下两者，此前没有任何东西反对。
 *
 * 这里不改变写入是否被允许（那会改动行为契约），而是让这个矛盾在最终门禁与
 * `boss doctor` 里显形：记录得准确，但不假装它没发生。
 */
describe('a failed gate on a completed stage is surfaced', () => {
  let tmpDir: string;
  const feature = 'gate-feat';

  function completeStageWithFailedGate(): void {
    runtime.updateStage(feature, 3, 'running', { cwd: tmpDir });
    runtime.updateStage(feature, 3, 'completed', {
      cwd: tmpDir,
      gate: 'gate2',
      gatePassed: 'false',
    });
  }

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'boss-gate-'));
    runtime.initPipeline(feature, { cwd: tmpDir });
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it('still records both facts faithfully', () => {
    completeStageWithFailedGate();
    const state = materializeState(feature, tmpDir).state;

    expect(state.stages['3']?.status).toBe('completed');
    expect(state.qualityGates.gate2?.passed).toBe(false);
  });

  it('fails the final gate when a completed stage carries a failed gate', () => {
    completeStageWithFailedGate();
    const result = evaluateFinalGate(feature, { cwd: tmpDir });

    const check = result.checks.find((item) => item.name === 'no-failed-gates');
    expect(check).toBeDefined();
    expect(check?.passed).toBe(false);
    expect(result.passed).toBe(false);
  });

  it('passes that check when the gate was re-evaluated and passed', () => {
    completeStageWithFailedGate();
    // 返工后重跑门禁：同一门禁的最新一次评估通过，矛盾即被解除
    runtime.updateStage(feature, 3, 'running', { cwd: tmpDir });
    runtime.updateStage(feature, 3, 'completed', {
      cwd: tmpDir,
      gate: 'gate2',
      gatePassed: 'true',
    });

    const result = evaluateFinalGate(feature, { cwd: tmpDir });
    const check = result.checks.find((item) => item.name === 'no-failed-gates');
    expect(check?.passed).toBe(true);
  });

  it('passes that check on a pipeline with no gate evaluations at all', () => {
    const result = evaluateFinalGate(feature, { cwd: tmpDir });
    const check = result.checks.find((item) => item.name === 'no-failed-gates');
    expect(check?.passed).toBe(true);
  });
});

/**
 * 同一个矛盾也必须出现在 `boss doctor` 里：最终门禁只在收尾时跑，
 * 而 doctor 是随时可查的体检入口，一个「门禁失败却完成」的 feature 不该被报成健康。
 */
describe('boss doctor reports the same contradiction', () => {
  let tmpDir: string;
  const feature = 'doctor-gate-feat';

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'boss-doctor-gate-'));
    runtime.initPipeline(feature, { cwd: tmpDir });
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it('reports an error when a completed stage carries a failed gate', () => {
    runtime.updateStage(feature, 3, 'running', { cwd: tmpDir });
    runtime.updateStage(feature, 3, 'completed', {
      cwd: tmpDir,
      gate: 'gate2',
      gatePassed: 'false',
    });

    ensureBuilt(BOSS_ENTRYPOINT);
    const result = spawnSync(
      process.execPath,
      [path.join(REPO_ROOT, BOSS_ENTRYPOINT), 'doctor', '--json'],
      { cwd: tmpDir, encoding: 'utf8' },
    );
    const report = JSON.parse(result.stdout) as {
      status: string;
      checks: Array<{ name: string; status: string; detail: string }>;
    };
    const check = report.checks.find((item) => item.name === `gates:${feature}`);

    expect(check?.status).toBe('error');
    expect(check?.detail).toContain('gate2');
    expect(report.status).toBe('error');
  });
});
