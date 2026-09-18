import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import * as runtime from '../../packages/boss-cli/src/runtime/application/pipeline.js';
import { materializeState } from '../../packages/boss-cli/src/runtime/projectors/materialize-state.js';

/**
 * 反馈循环上限限制的是「同一产物的返工轮次」，不是 feature 的一生。
 *
 * 此前 `feedbackLoops.currentRound` 只增不减、全仓没有任何重置路径，而 `maxRounds` 是 2。
 * 于是一个 feature 一生只能接受两次修订请求，第三次直接抛错——feature 活得越久，越早
 * 失去记录反馈的能力，这与长期迭代的用法正面冲突。
 *
 * 现按产物分别计数：防死循环的原意保留（同一产物仍最多返工 2 轮），不同产物互不影响。
 */
describe('feedback rounds are counted per artifact', () => {
  let tmpDir: string;
  const feature = 'fb-feat';

  function request(artifact: string, reason: string) {
    return runtime.recordFeedback(feature, {
      cwd: tmpDir,
      from: 'boss-qa',
      to: 'boss-backend',
      artifact,
      reason,
    });
  }

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'boss-fb-'));
    runtime.initPipeline(feature, { cwd: tmpDir });
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it('still caps revisions on the same artifact at maxRounds', () => {
    request('code', '第一次');
    request('code', '第二次');

    expect(() => request('code', '第三次')).toThrow(/上限/);
  });

  it('does not let one artifact exhaust another artifact budget', () => {
    request('code', '第一次');
    request('code', '第二次');

    // 另一个产物此前会被前一个产物的返工次数拖死
    expect(() => request('architecture.md', '架构要改')).not.toThrow();
  });

  it('tracks rounds per artifact in the projected state', () => {
    request('code', '第一次');
    request('code', '第二次');
    request('architecture.md', '架构要改');

    const state = materializeState(feature, tmpDir).state;
    expect(state.feedbackLoops.rounds).toEqual({ code: 2, 'architecture.md': 1 });
    // 总轮次仍然保留，报表与既有消费方不受影响
    expect(state.feedbackLoops.currentRound).toBe(3);
  });

  it('keeps maxRounds in the projected state', () => {
    const state = materializeState(feature, tmpDir).state;
    expect(state.feedbackLoops.maxRounds).toBe(2);
  });
});
