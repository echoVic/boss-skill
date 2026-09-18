import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import * as runtime from '../../packages/boss-cli/src/runtime/application/pipeline.js';
import { evaluateAgentReuse } from '../../packages/boss-cli/src/runtime/application/pipeline-reuse.js';

/**
 * pipeline pack 在两次运行之间改变时，上一轮的 agent 产物不应再被复用。
 *
 * 初始化时 pack 的指纹被算出来写进 `execution.parameters.packHash`，README 也把它
 * 与 workflowHash、artifact DAG hash 并列描述。但此前没有任何代码读它做判断：
 * artifact DAG 有 `isArtifactDagStale` 守卫，pack 没有。于是改了 pack 的 stages /
 * agents / gates 之后恢复，仍会按旧计划复用旧产物，且无从察觉。
 */
describe('pipeline pack drift blocks agent reuse', () => {
  let tmpDir: string;
  const feature = 'pack-feat';

  function writePack(config: Record<string, unknown>): void {
    fs.mkdirSync(path.join(tmpDir, '.boss', 'pipeline-packs', 'custom'), { recursive: true });
    fs.writeFileSync(path.join(tmpDir, 'custom.marker'), 'yes\n', 'utf8');
    fs.writeFileSync(
      path.join(tmpDir, '.boss', 'pipeline-packs', 'custom', 'pipeline.json'),
      `${JSON.stringify(
        {
          name: 'custom',
          version: '1.0.0',
          type: 'pipeline-pack',
          priority: 100,
          when: { fileExists: ['custom.marker'] },
          config,
        },
        null,
        2,
      )}\n`,
      'utf8',
    );
  }

  function completeAgent(): void {
    fs.writeFileSync(path.join(tmpDir, '.boss', feature, 'design-brief'), 'brief\n', 'utf8');
    runtime.updateAgent(feature, 1, 'boss-pm', 'completed', {
      cwd: tmpDir,
      prompt: 'boss-pm:prd.md',
      dependencyArtifacts: ['design-brief'],
    });
  }

  function reuse() {
    return evaluateAgentReuse(feature, 1, 'boss-pm', {
      cwd: tmpDir,
      prompt: 'boss-pm:prd.md',
      dependencyArtifacts: ['design-brief'],
    });
  }

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'boss-pack-drift-'));
    writePack({ stages: [1, 2], agents: ['boss-pm', 'boss-architect'], gates: [] });
    runtime.initPipeline(feature, { cwd: tmpDir });
    completeAgent();
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it('reuses the completed agent while the pack is unchanged', () => {
    const decision = reuse();
    expect(decision.reusable).toBe(true);
    expect(decision.packStale).toBe(false);
  });

  it('refuses reuse after the pipeline pack changes', () => {
    // 改掉 pack 的 config：阶段和 agent 集合都变了，上一轮的产物不再对应当前流水线
    writePack({ stages: [1, 2, 3], agents: ['boss-pm', 'boss-architect', 'boss-qa'], gates: [] });

    const decision = reuse();
    expect(decision.packStale).toBe(true);
    expect(decision.reusable).toBe(false);
    expect(decision.reason).toBe('pipeline-pack-stale');
  });

  it('records a pack hash that can be recomputed from the resolved pack', () => {
    // 与 artifact DAG 对称：记录下来的指纹必须能被重算比对，否则它证明不了任何事
    const execution = JSON.parse(
      fs.readFileSync(path.join(tmpDir, '.boss', feature, '.meta', 'execution.json'), 'utf8'),
    ) as { parameters: { packHash?: string } };
    expect(typeof execution.parameters.packHash).toBe('string');
    expect(reuse().packStale).toBe(false);
  });
});
