import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { buildBossStatus } from '../../packages/boss-cli/src/runtime/application/checkpoints.js';
import * as runtime from '../../packages/boss-cli/src/runtime/application/pipeline.js';
import { materializeState } from '../../packages/boss-cli/src/runtime/projectors/materialize-state.js';

/**
 * 同一个问题只能有一个答案。
 *
 * 实跑一遍完整流水线后，`boss status` 仍说「Ready artifacts: code」，而同一份 execution.json
 * 里 workflow 节点是 completed、nextNodeIds 为空、pipeline status 为 completed。
 *
 * 根因是「code 是否完成」有两套依据：workflow 节点看 ArtifactRecorded，而
 * `isArtifactDone` 只看 stage 3 的 agent 状态，完全不看产物是否被记录。编排循环第 7 步
 * 写的是「记录产物 → artifact node 进入 completed」，所以记录本身就是完成信号。
 */
describe('ready artifacts agree with the workflow view', () => {
  let tmpDir: string;
  const feature = 'agree-feat';

  function drive(): void {
    runtime.updateStage(feature, 1, 'running', { cwd: tmpDir });
    for (const artifact of ['prd.md', 'architecture.md', 'ui-spec.md', 'ui-design.json']) {
      fs.writeFileSync(path.join(tmpDir, '.boss', feature, artifact), 'x\n', 'utf8');
      runtime.recordArtifact(feature, artifact, 1, { cwd: tmpDir });
    }
    runtime.updateStage(feature, 1, 'completed', { cwd: tmpDir });
    runtime.updateStage(feature, 2, 'running', { cwd: tmpDir });
    for (const artifact of ['tech-review.md', 'tasks.md']) {
      fs.writeFileSync(path.join(tmpDir, '.boss', feature, artifact), 'x\n', 'utf8');
      runtime.recordArtifact(feature, artifact, 2, { cwd: tmpDir });
    }
    runtime.updateStage(feature, 2, 'completed', { cwd: tmpDir });
    runtime.updateStage(feature, 3, 'running', { cwd: tmpDir });
    for (const artifact of ['code', 'qa-report.md']) {
      fs.writeFileSync(path.join(tmpDir, '.boss', feature, artifact), 'x\n', 'utf8');
      runtime.recordArtifact(feature, artifact, 3, { cwd: tmpDir });
    }
  }

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'boss-agree-'));
    runtime.initPipeline(feature, { cwd: tmpDir });
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it('stops offering code once the artifact has been recorded', () => {
    drive();

    const status = buildBossStatus(feature, { cwd: tmpDir });
    const workflowNode = materializeState(feature, tmpDir).state.workflow?.nodes['artifact:code'];

    expect(workflowNode?.status).toBe('completed');
    expect(status.readyArtifacts, 'code is completed in the workflow view').not.toContain('code');
  });

  it('still treats a completed dev agent as producing code', () => {
    // 另一条路径：agent 完成即视为 code 完成，不要求显式记录产物
    runtime.updateStage(feature, 1, 'running', { cwd: tmpDir });
    for (const artifact of ['prd.md', 'architecture.md']) {
      fs.writeFileSync(path.join(tmpDir, '.boss', feature, artifact), 'x\n', 'utf8');
      runtime.recordArtifact(feature, artifact, 1, { cwd: tmpDir });
    }
    runtime.updateStage(feature, 3, 'running', { cwd: tmpDir });
    runtime.updateAgent(feature, 3, 'boss-backend', 'completed', { cwd: tmpDir });

    expect(buildBossStatus(feature, { cwd: tmpDir }).readyArtifacts).not.toContain('code');
  });
});

/**
 * 流水线跑完之后不该再要求确认下一步——已经没有下一步了。
 *
 * `defaultRequiredChecks` 只看 `stage.id >= 3`，不看流水线是否已完成，于是全部收尾之后
 * `boss status` 仍打印 CHECKPOINT_REQUIRED，并提示运行 `boss continue`。
 */
describe('a finished pipeline needs no checkpoint', () => {
  let tmpDir: string;
  const feature = 'done-feat';

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'boss-done-'));
    runtime.initPipeline(feature, { cwd: tmpDir });
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it('reports checkpointRequired while work remains', () => {
    runtime.updateStage(feature, 3, 'running', { cwd: tmpDir });
    expect(buildBossStatus(feature, { cwd: tmpDir }).checkpoint.checkpointRequired).toBe(true);
  });

  it('clears the checkpoint once every stage is completed', () => {
    for (const stage of [1, 2, 3, 4]) {
      runtime.updateStage(feature, stage, 'running', { cwd: tmpDir });
      runtime.updateStage(feature, stage, 'completed', { cwd: tmpDir });
    }

    const status = buildBossStatus(feature, { cwd: tmpDir });
    expect(status.status).toBe('completed');
    expect(status.checkpoint.checkpointRequired).toBe(false);
    expect(status.checkpoint.reason).toMatch(/complete|完成/i);
  });

  it('does not point a finished pipeline at boss continue', () => {
    // 流水线已完成时提示 `boss continue` 会把用户指向一个空操作
    for (const stage of [1, 2, 3, 4]) {
      runtime.updateStage(feature, stage, 'running', { cwd: tmpDir });
      runtime.updateStage(feature, stage, 'completed', { cwd: tmpDir });
    }

    const status = buildBossStatus(feature, { cwd: tmpDir });
    expect(status.checkpoint.continueCommand).toBe('');
  });
});

/**
 * `artifact prepare` 回显的模板路径必须对调用方有意义。
 *
 * 此前回显的是 `path.relative(cwd, templatePath)`——从用户项目指向 boss 安装位置的相对
 * 路径，实跑时长这样：`../boss-sched/skill/templates/prd.md.template`。它既不能直接打开，
 * 也不说明用的是内置模板还是项目自带模板。
 */
describe('artifact prepare reports a usable template reference', () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'boss-tpl-'));
    runtime.initPipeline('tpl-feat', { cwd: tmpDir });
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it('names the bundled template without a traversal path', async () => {
    const { main } = await import('../../packages/boss-cli/src/commands/artifact/index.js');
    const captured: string[] = [];
    const original = process.stdout.write.bind(process.stdout);
    process.stdout.write = ((chunk: string) => {
      captured.push(String(chunk));
      return true;
    }) as typeof process.stdout.write;
    try {
      main(['tpl-feat', 'prd.md', '--json'], { cwd: tmpDir });
    } finally {
      process.stdout.write = original;
    }

    const payload = JSON.parse(captured.join('')) as { template: string; templateSource: string };
    expect(payload.template).toBe('prd.md.template');
    expect(payload.template).not.toContain('..');
    expect(payload.templateSource).toBe('bundled');
  });
});
