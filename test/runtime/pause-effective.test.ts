import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import * as runtime from '../../packages/boss-cli/src/runtime/application/pipeline.js';
import { materializeState } from '../../packages/boss-cli/src/runtime/projectors/materialize-state.js';

/**
 * 暂停必须在「有阶段正在跑」时也生效——那恰恰是唯一想暂停的时刻。
 *
 * `finalize` 先按阶段状态推导 status，只在没有 running/retrying 阶段时才回落到 paused。
 * 于是 pause 记录下了 `pause.paused = true`，而派生出来的 status 仍是 running，
 * 连带两个守卫一起失效：重复 pause 不再被拒（它查的是 status），
 * `update-stage running` 的自动恢复也不再触发。
 *
 * 又是同一类问题：同一个事实有两种表示，派生的那个压过了显式记录的那个。
 */
describe('pause beats the running-stage inference', () => {
  let tmpDir: string;
  const feature = 'pause-feat';

  function state() {
    return materializeState(feature, tmpDir).state;
  }

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'boss-pause-'));
    runtime.initPipeline(feature, { cwd: tmpDir });
    runtime.updateStage(feature, 1, 'running', { cwd: tmpDir });
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it('reports paused while a stage is still running', () => {
    runtime.pausePipeline(feature, { cwd: tmpDir, reason: '人工检查' });

    expect(state().pause?.paused).toBe(true);
    expect(state().status).toBe('paused');
  });

  it('refuses a second pause', () => {
    runtime.pausePipeline(feature, { cwd: tmpDir, reason: 'first' });
    expect(() => runtime.pausePipeline(feature, { cwd: tmpDir, reason: 'second' })).toThrow(
      /已处于暂停/,
    );
  });

  it('auto-resumes when a stage is moved back to running', () => {
    runtime.pausePipeline(feature, { cwd: tmpDir, reason: 'hold' });
    runtime.updateStage(feature, 2, 'running', { cwd: tmpDir });

    expect(state().status).toBe('running');
    expect(state().pause).toBeNull();
  });

  it('still reports completed when every stage is done, even if paused earlier', () => {
    runtime.pausePipeline(feature, { cwd: tmpDir, reason: 'hold' });
    runtime.updateStage(feature, 1, 'completed', { cwd: tmpDir });
    for (const stage of [2, 3, 4]) {
      runtime.updateStage(feature, stage, 'running', { cwd: tmpDir });
      runtime.updateStage(feature, stage, 'completed', { cwd: tmpDir });
    }

    expect(state().status).toBe('completed');
  });
});
