import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import {
  ARTIFACT_LAYERS,
  artifactLayer,
} from '../../packages/boss-cli/src/runtime/application/artifact-layers.js';
import * as runtime from '../../packages/boss-cli/src/runtime/application/pipeline.js';

/**
 * 产物按生命周期分层，而不是平铺成一堆同等重要的文件。
 *
 * 一次运行会在 `.boss/<feature>/` 顶层留下 14 个文件，其中产品资产（prd、architecture、
 * ui-spec）跨迭代持续维护，单轮记录（tasks、qa-report、deploy-report）跑完即过期，
 * 派生视图（.html）可随时重建。三者混在一起，第二次迭代时用户分不清哪些还作数。
 */
describe('artifact layers', () => {
  it('classifies product assets as long-lived', () => {
    expect(artifactLayer('prd.md')).toBe('product');
    expect(artifactLayer('architecture.md')).toBe('product');
    expect(artifactLayer('ui-spec.md')).toBe('product');
    expect(artifactLayer('ui-design.json')).toBe('product');
  });

  it('classifies per-run records as run-scoped', () => {
    expect(artifactLayer('tech-review.md')).toBe('run');
    expect(artifactLayer('tasks.md')).toBe('run');
    expect(artifactLayer('qa-report.md')).toBe('run');
    expect(artifactLayer('deploy-report.md')).toBe('run');
  });

  it('classifies generated views as derived', () => {
    expect(artifactLayer('prd.html')).toBe('derived');
    expect(artifactLayer('summary-report.html')).toBe('derived');
  });

  it('falls back to run scope for anything unknown', () => {
    // 未知产物按单轮处理：不会被误当成需要长期维护的产品资产
    expect(artifactLayer('whatever.md')).toBe('run');
  });

  it('exposes the layers in a stable order for rendering', () => {
    expect(ARTIFACT_LAYERS.map((layer) => layer.id)).toEqual(['product', 'run', 'derived']);
    for (const layer of ARTIFACT_LAYERS) {
      expect(layer.title.length).toBeGreaterThan(0);
    }
  });
});

/**
 * 单轮记录应当随迭代过期，而不是永远堆在顶层。
 *
 * 归档机制（`.versions/`）已经存在，但只在同名产物被覆盖时触发。GStack 的做法是给
 * 执行痕迹一个保留期而不是挪目录——同样的效果，不必改任何写入路径。
 */
describe('stale run artifacts are reported', () => {
  let tmpDir: string;
  const feature = 'layer-feat';

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'boss-layer-'));
    runtime.initPipeline(feature, { cwd: tmpDir });
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  function record(artifact: string, stage: number): void {
    fs.writeFileSync(path.join(tmpDir, '.boss', feature, artifact), `# ${artifact}\n`, 'utf8');
    runtime.recordArtifact(feature, artifact, stage, { cwd: tmpDir });
  }

  it('reports nothing stale on a first run', async () => {
    record('prd.md', 1);
    record('tasks.md', 2);

    const { findStaleRunArtifacts } = await import(
      '../../packages/boss-cli/src/runtime/application/artifact-layers.js'
    );
    expect(findStaleRunArtifacts(feature, { cwd: tmpDir })).toEqual([]);
  });

  it('marks a run artifact stale once a newer round produced its upstream', async () => {
    record('tasks.md', 2);
    // 第二轮重做了上游产品资产：上一轮的任务清单不再对应当前的 prd
    record('prd.md', 1);

    const { findStaleRunArtifacts } = await import(
      '../../packages/boss-cli/src/runtime/application/artifact-layers.js'
    );
    const stale = findStaleRunArtifacts(feature, { cwd: tmpDir });
    expect(stale.map((item) => item.artifact)).toContain('tasks.md');
  });
});

/**
 * 分层必须出现在用户真正会看的地方：`boss status` 与摘要报告。
 * 只做分类而不呈现，等于又造了一个「写了没人读」的字段。
 */
describe('layers reach the surfaces users actually read', () => {
  let tmpDir: string;
  const feature = 'surface-feat';

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'boss-surface-'));
    runtime.initPipeline(feature, { cwd: tmpDir });
    for (const [artifact, stage] of [
      ['prd.md', 1],
      ['tasks.md', 2],
    ] as const) {
      fs.writeFileSync(path.join(tmpDir, '.boss', feature, artifact), `# ${artifact}\n`, 'utf8');
      runtime.recordArtifact(feature, artifact, stage, { cwd: tmpDir });
    }
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it('boss status groups recorded artifacts by layer', async () => {
    const { buildBossStatus } = await import(
      '../../packages/boss-cli/src/runtime/application/checkpoints.js'
    );
    const status = buildBossStatus(feature, { cwd: tmpDir });

    expect(status.artifactLayers.product).toContain('prd.md');
    expect(status.artifactLayers.run).toContain('tasks.md');
  });

  it('the summary report lists product assets separately from run records', async () => {
    const { buildSummaryModel } = await import(
      '../../packages/boss-cli/src/runtime/report/summary-model.js'
    );
    const { renderMarkdown } = await import(
      '../../packages/boss-cli/src/runtime/report/render-markdown.js'
    );
    const markdown = renderMarkdown(buildSummaryModel(feature, { cwd: tmpDir }));

    expect(markdown).toContain('产品资产');
    expect(markdown).toContain('本轮记录');
  });
});
