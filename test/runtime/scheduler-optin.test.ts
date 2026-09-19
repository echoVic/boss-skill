import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';

import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import * as runtime from '../../packages/boss-cli/src/runtime/application/pipeline.js';
import { getReadyArtifacts } from '../../packages/boss-cli/src/runtime/application/pipeline.js';
import { materializeState } from '../../packages/boss-cli/src/runtime/projectors/materialize-state.js';

/**
 * 两个调度面必须给出一致的工作集，否则编排器按哪个都不对。
 *
 * `orchestration-loop.md` 规定「调度以 execution.workflow.nextNodeIds 为准」，
 * `get-ready-artifacts` 只是兼容入口。但权威面此前不做 opt-in 可选产物的排除：
 * 实跑时兼容入口返回 ["code"]，而 nextNodeIds 多出 ui-design-variants.json、
 * strategic-review.md 等四个从不自动派发的产物。
 *
 * 后果有二：编排器被迫为一个笔记 API 产出 UI 变体与市场 ROI 分析；更糟的是循环第 13 步
 * 的终止条件「直到 nextNodeIds 为空」永远不可达——这些节点会一直停在 ready。
 */
describe('both scheduling surfaces agree', () => {
  let tmpDir: string;
  const feature = 'sched-feat';

  function nextNodeIds(): string[] {
    const state = materializeState(feature, tmpDir).state;
    return state.workflow?.nextNodeIds ?? [];
  }

  function record(artifact: string, stage: number): void {
    fs.writeFileSync(path.join(tmpDir, '.boss', feature, artifact), `# ${artifact}\n`, 'utf8');
    runtime.recordArtifact(feature, artifact, stage, { cwd: tmpDir });
  }

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'boss-sched-'));
    runtime.initPipeline(feature, { cwd: tmpDir });
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it('never schedules an opt-in-only artifact', () => {
    record('prd.md', 1);

    const scheduled = nextNodeIds();
    for (const optIn of ['strategic-review.md', 'ui-design-variants.json', 'changelog.md']) {
      expect(scheduled, `${optIn} must not be auto-scheduled`).not.toContain(`artifact:${optIn}`);
    }
  });

  it('offers the same artifacts as the compatibility entry point', () => {
    record('prd.md', 1);

    const compat = getReadyArtifacts(feature, { cwd: tmpDir })
      .map((item) => item.artifact)
      .sort();
    const authoritative = nextNodeIds()
      .filter((id) => id.startsWith('artifact:'))
      .map((id) => id.slice('artifact:'.length))
      .sort();

    expect(authoritative).toEqual(compat);
  });

  it('still offers genuinely optional UI artifacts that have no opt-in gate', () => {
    record('prd.md', 1);
    // ui-spec.md / ui-design.json 是 optional 但非 opt-in：有界面的项目仍应被派发
    expect(nextNodeIds()).toContain('artifact:ui-spec.md');
  });

  it('marks opt-in-only nodes skipped rather than leaving them ready forever', () => {
    record('prd.md', 1);
    const state = materializeState(feature, tmpDir).state;

    expect(state.workflow?.nodes['artifact:strategic-review.md']?.status).toBe('skipped');
  });

  it('completes an opt-in artifact normally when it is actually produced', () => {
    record('prd.md', 1);
    record('strategic-review.md', 2);
    const state = materializeState(feature, tmpDir).state;

    expect(state.workflow?.nodes['artifact:strategic-review.md']?.status).toBe('completed');
  });
});
