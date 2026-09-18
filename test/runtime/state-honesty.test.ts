import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import * as runtime from '../../packages/boss-cli/src/runtime/application/pipeline.js';
import { appendRuntimeEvent } from '../../packages/boss-cli/src/runtime/application/state.js';
import { EVENT_TYPES } from '../../packages/boss-cli/src/runtime/domain/event-types.js';
import { materializeState } from '../../packages/boss-cli/src/runtime/projectors/materialize-state.js';

/**
 * 「写了但没人读」审计的后续：投影出来的状态必须诚实。
 *
 * 诚实有两层含义。一是落盘内容与类型声明一致——否则任何从类型出发的审计都是错的。
 * 二是写进去的值本身是对的，而不是恒为空的占位符。
 */
describe('projected state is honest about what it contains', () => {
  let tmpDir: string;
  const feature = 'honest-feat';

  function state() {
    return materializeState(feature, tmpDir).state;
  }

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'boss-honest-'));
    runtime.initPipeline(feature, { cwd: tmpDir });
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it('names a stage created by an event instead of leaving it blank', () => {
    // init 只给 1-4 命名；任何由事件首次创建的阶段此前恒为空名，并一路出现在报表里
    appendRuntimeEvent(tmpDir, feature, EVENT_TYPES.STAGE_STARTED, { stage: 7 });

    const stage = state().stages['7'];
    expect(stage).toBeDefined();
    expect(stage?.name).not.toBe('');
  });

  it('keeps the four initialized stages named as before', () => {
    const stages = state().stages;
    expect(stages['1']?.name).toBe('planning');
    expect(stages['4']?.name).toBe('deployment');
  });

  it('declares every field it actually writes into workflow nodes', () => {
    // parallelGroup / description 通过 spread 落进 execution.json，却没有出现在
    // WorkflowExecutionNode 类型里：从类型出发的审计会漏掉它们。
    const onDisk = JSON.parse(
      fs.readFileSync(path.join(tmpDir, '.boss', feature, '.meta', 'execution.json'), 'utf8'),
    ) as { workflow?: { nodes?: Record<string, Record<string, unknown>> } };
    const nodes = Object.values(onDisk.workflow?.nodes ?? {});
    expect(nodes.length).toBeGreaterThan(0);

    const typesSource = fs.readFileSync(
      path.resolve(import.meta.dirname, '../../packages/boss-cli/src/runtime/projectors/types.ts'),
      'utf8',
    );
    const block = typesSource.slice(typesSource.indexOf('export interface WorkflowExecutionNode'));
    const declared = new Set(
      block
        .slice(0, block.indexOf('}'))
        .split('\n')
        .map((line) => line.trim().match(/^([A-Za-z_][A-Za-z0-9_]*)\??:/)?.[1])
        .filter((name): name is string => Boolean(name)),
    );

    const undeclared = new Set<string>();
    for (const node of nodes) {
      for (const key of Object.keys(node)) {
        if (!declared.has(key)) undeclared.add(key);
      }
    }
    expect([...undeclared].sort()).toEqual([]);
  });
});

/**
 * 审计轨迹必须被呈现，否则记录它就没有意义。
 *
 * 修订请求与人工介入被完整记进事件流与状态，但既不参与判断，也不出现在任何
 * 面向人的输出里。对一个以可审计性为卖点的项目，这是最该补上的一段。
 */
describe('audit trail reaches the summary report', () => {
  let tmpDir: string;
  const feature = 'trail-feat';

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'boss-trail-'));
    runtime.initPipeline(feature, { cwd: tmpDir });
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it('carries revision requests and human interventions into the summary model', async () => {
    appendRuntimeEvent(tmpDir, feature, EVENT_TYPES.REVISION_REQUESTED, {
      from: 'boss-qa',
      to: 'boss-backend',
      artifact: 'code',
      reason: '缺少边界用例',
    });
    appendRuntimeEvent(tmpDir, feature, EVENT_TYPES.USER_CHOICE_RECORDED, {
      choiceType: 'gate-override',
      selected: 'continue',
      agent: 'boss-qa',
      stage: 3,
    });

    materializeState(feature, tmpDir); // 报告读的是投影后的 execution.json
    const { buildSummaryModel } = await import(
      '../../packages/boss-cli/src/runtime/report/summary-model.js'
    );
    const model = buildSummaryModel(feature, { cwd: tmpDir });

    expect(model.revisionRequests).toHaveLength(1);
    expect(model.revisionRequests[0]?.reason).toBe('缺少边界用例');
    expect(model.humanInterventions).toHaveLength(1);
    expect(model.humanInterventions[0]?.selected).toBe('continue');
  });

  it('renders both sections in the markdown report', async () => {
    appendRuntimeEvent(tmpDir, feature, EVENT_TYPES.REVISION_REQUESTED, {
      from: 'boss-qa',
      to: 'boss-backend',
      artifact: 'code',
      reason: '缺少边界用例',
    });

    materializeState(feature, tmpDir);
    const { buildSummaryModel } = await import(
      '../../packages/boss-cli/src/runtime/report/summary-model.js'
    );
    const { renderMarkdown } = await import(
      '../../packages/boss-cli/src/runtime/report/render-markdown.js'
    );
    const markdown = renderMarkdown(buildSummaryModel(feature, { cwd: tmpDir }));

    expect(markdown).toContain('缺少边界用例');
    expect(markdown).toContain('boss-qa');
  });
});
