import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { evaluateGates } from '../../packages/boss-cli/src/runtime/application/gates.js';
import * as runtime from '../../packages/boss-cli/src/runtime/application/pipeline.js';
import { filterAgentsByPack } from '../../packages/boss-cli/src/runtime/application/pipeline-dag.js';

/**
 * `/boss:extend` 教用户写的 pack 配置必须真的生效。
 *
 * `skill/references/extending-boss.md` 把 `config.agents`、`config.gates`、`config.stages`、
 * `config.agentStages`、`config.skipFrontend` 都列为可配置项，但它们此前没有任何读取方：
 * 照文档写了自定义 pack，跑起来完全没有效果，也没有任何报错。内置的 `api-only` pack
 * 正好设了 `skipFrontend: true`，而那个开关是空的。
 *
 * 现在 agents / gates / skipFrontend 真正生效；stages 与 agentStages 从文档和内置 pack
 * 里移除（阶段实际由 artifact DAG 决定，保留只会继续误导）。
 */
describe('pipeline pack config takes effect', () => {
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

  function readyAgents(): string[] {
    const ready = runtime.getReadyArtifacts(feature, { cwd: tmpDir });
    const agents = new Set<string>();
    for (const item of ready) {
      for (const agent of Array.isArray(item.agent) ? item.agent : [item.agent]) {
        if (agent) agents.add(String(agent));
      }
    }
    return [...agents].sort();
  }

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'boss-pack-contract-'));
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it('dispatches every agent when the pack lists none', () => {
    writePack({});
    runtime.initPipeline(feature, { cwd: tmpDir });

    expect(readyAgents()).toContain('boss-pm');
  });

  it('never offers work to an agent the pack excluded', () => {
    writePack({ agents: ['boss-architect', 'boss-backend'] });
    runtime.initPipeline(feature, { cwd: tmpDir });

    expect(readyAgents()).not.toContain('boss-pm');
  });

  it('drops only the frontend agent when skipFrontend is set', () => {
    // code 由 frontend 与 backend 共同产出，所以 skipFrontend 不能按产物跳过，
    // 只能把 frontend 从该产物的 agent 列表里摘掉
    writePack({ skipFrontend: true });
    runtime.initPipeline(feature, { cwd: tmpDir });

    expect(readyAgents()).not.toContain('boss-frontend');
    expect(readyAgents()).toContain('boss-pm');
  });

  it('skips a gate the pack did not enable', () => {
    writePack({ gates: ['gate0'] });
    runtime.initPipeline(feature, { cwd: tmpDir });

    const result = evaluateGates(feature, 'gate2', { cwd: tmpDir });
    expect(result.skipped).toBe(true);
    expect(result.passed).toBe(true);
  });

  it('runs a gate the pack enabled', () => {
    writePack({ gates: ['gate0'] });
    runtime.initPipeline(feature, { cwd: tmpDir });

    const result = evaluateGates(feature, 'gate0', { cwd: tmpDir, dryRun: true });
    expect(result.skipped).not.toBe(true);
  });

  it('runs every gate when the pack lists none', () => {
    writePack({});
    runtime.initPipeline(feature, { cwd: tmpDir });

    const result = evaluateGates(feature, 'gate2', { cwd: tmpDir, dryRun: true });
    expect(result.skipped).not.toBe(true);
  });
});

/**
 * agent 收窄逻辑单独测：`code` 由 frontend 与 backend 共同产出，
 * 它只有在流水线推进到阶段 3 才会就绪，用就绪集覆盖不到这些分支。
 */
describe('filterAgentsByPack', () => {
  it('keeps every agent when the pack declares nothing', () => {
    expect(filterAgentsByPack(['boss-frontend', 'boss-backend'], {} as never)).toEqual([
      'boss-frontend',
      'boss-backend',
    ]);
  });

  it('drops the frontend agent but keeps the artifact producible', () => {
    expect(
      filterAgentsByPack(['boss-frontend', 'boss-backend'], { skipFrontend: true } as never),
    ).toEqual(['boss-backend']);
  });

  it('returns null when no declared agent can produce the artifact', () => {
    expect(filterAgentsByPack(['boss-frontend'], { skipFrontend: true } as never)).toBeNull();
    expect(filterAgentsByPack('boss-pm', { activeAgents: ['boss-backend'] } as never)).toBeNull();
  });

  it('preserves the scalar shape for a single-agent artifact', () => {
    expect(filterAgentsByPack('boss-pm', { activeAgents: ['boss-pm'] } as never)).toBe('boss-pm');
  });
});
