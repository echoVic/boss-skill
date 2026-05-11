import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

import { materializeState } from '../../packages/boss-cli/src/runtime/projectors/materialize-state.js';
import { buildSummaryModel } from '../../packages/boss-cli/src/runtime/report/summary-model.js';
import { renderHtml } from '../../packages/boss-cli/src/runtime/report/render-html.js';
import { renderJson } from '../../packages/boss-cli/src/runtime/report/render-json.js';
import { renderMarkdown } from '../../packages/boss-cli/src/runtime/report/render-markdown.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const REPO_ROOT = path.resolve(__dirname, '..', '..');
const BOSS_BIN = path.join(REPO_ROOT, 'packages', 'boss-cli', 'dist', 'bin', 'boss.js');

describe('runtime report generation', () => {
  let tmpDir: string;
  let cwd: string;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'boss-report-'));
    cwd = process.cwd();
    process.chdir(tmpDir);

    const featureDir = path.join(tmpDir, '.boss', 'test-feat');
    const metaDir = path.join(featureDir, '.meta');
    fs.mkdirSync(metaDir, { recursive: true });
    fs.writeFileSync(path.join(featureDir, 'prd.md'), '# PRD\n', 'utf8');
    fs.writeFileSync(path.join(featureDir, 'architecture.md'), '# Architecture\n', 'utf8');

    const execution = {
      schemaVersion: '0.2.0',
      feature: 'test-feat',
      createdAt: '2026-04-12T00:00:00.000Z',
      updatedAt: '2026-04-12T00:05:00.000Z',
      status: 'running',
      parameters: {
        pipelinePack: 'api-only'
      },
      stages: {
        '1': {
          name: 'planning',
          status: 'completed',
          startTime: '2026-04-12T00:00:30.000Z',
          endTime: '2026-04-12T00:02:00.000Z',
          retryCount: 0,
          maxRetries: 2,
          failureReason: null,
          artifacts: ['prd.md', 'architecture.md'],
          gateResults: {}
        },
        '2': {
          name: 'review',
          status: 'running',
          startTime: '2026-04-12T00:03:00.000Z',
          endTime: null,
          retryCount: 1,
          maxRetries: 2,
          failureReason: null,
          artifacts: [],
          gateResults: {}
        },
        '3': {
          name: 'development',
          status: 'pending',
          startTime: null,
          endTime: null,
          retryCount: 0,
          maxRetries: 2,
          failureReason: null,
          artifacts: [],
          gateResults: {
            gate1: {
              passed: true,
              executedAt: '2026-04-12T00:04:00.000Z',
              checks: [{ name: 'unit', passed: true, detail: 'ok' }]
            }
          }
        },
        '4': {
          name: 'deployment',
          status: 'pending',
          startTime: null,
          endTime: null,
          retryCount: 0,
          maxRetries: 2,
          failureReason: null,
          artifacts: [],
          gateResults: {}
        }
      },
      qualityGates: {
        gate0: { status: 'pending', passed: null, checks: [], executedAt: null },
        gate1: {
          status: 'completed',
          passed: true,
          checks: [{ name: 'unit', passed: true, detail: 'ok' }],
          executedAt: '2026-04-12T00:04:00.000Z'
        },
        gate2: {
          status: 'completed',
          passed: false,
          checks: [{ name: 'perf', passed: false, detail: 'slow' }],
          executedAt: '2026-04-12T00:04:30.000Z'
        }
      },
      metrics: {
        totalDuration: 300,
        stageTimings: { '1': 90 },
        gatePassRate: 50,
        retryTotal: 1,
        agentSuccessCount: 2,
        agentFailureCount: 1,
        meanRetriesPerStage: 0.25,
        revisionLoopCount: 2,
        pluginFailureCount: 1
      },
      plugins: [],
      pluginLifecycle: {
        discovered: [],
        activated: [],
        executed: [],
        failed: [
          {
            plugin: { name: 'test-plugin', version: '1.0.0', type: 'gate' },
            hook: 'gate',
            stage: 3,
            exitCode: 1,
            timestamp: '2026-04-12T00:04:45.000Z'
          }
        ]
      },
      humanInterventions: [],
      revisionRequests: [],
      feedbackLoops: { maxRounds: 2, currentRound: 0 }
    };

    fs.writeFileSync(path.join(metaDir, 'execution.json'), JSON.stringify(execution, null, 2), 'utf8');
  });

  afterEach(() => {
    process.chdir(cwd);
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  function runRuntimeCommand(name: string, args: string[]) {
    return spawnSync(process.execPath, [BOSS_BIN, 'runtime', name, ...args], {
      cwd: tmpDir,
      encoding: 'utf8'
    });
  }

  it('generate-summary runtime CLI emits machine-readable JSON via stdout', () => {
    const result = runRuntimeCommand('generate-summary', ['test-feat', '--json', '--stdout']);

    expect(result.status).toBe(0);
    expect(result.stderr).toBe('');
    const payload = JSON.parse(result.stdout) as {
      feature: string;
      status: string;
      pack: { name: string };
      metrics: { gatePassRate: number; agentSuccessCount: number; pluginFailureCount: number };
      stages: Array<{ artifacts: string[] }>;
      qualityGates: { gate2: { passed: boolean } };
    };
    expect(payload.feature).toBe('test-feat');
    expect(payload.status).toBe('running');
    expect(payload.pack.name).toBe('api-only');
    expect(payload.metrics.gatePassRate).toBe(50);
    expect(payload.metrics.agentSuccessCount).toBe(2);
    expect(payload.metrics.pluginFailureCount).toBe(1);
    expect(payload.stages[0]?.artifacts.length).toBe(2);
    expect(payload.qualityGates.gate2.passed).toBe(false);
  });

  it('record-artifact writes and records html companions for markdown artifacts', () => {
    const prdPath = path.join(tmpDir, '.boss', 'test-feat', 'prd.md');
    const metaDir = path.join(tmpDir, '.boss', 'test-feat', '.meta');
    const execution = JSON.parse(fs.readFileSync(path.join(metaDir, 'execution.json'), 'utf8')) as unknown;
    fs.writeFileSync(
      path.join(metaDir, 'events.jsonl'),
      `${JSON.stringify({
        id: 1,
        type: 'PipelineInitialized',
        timestamp: '2026-04-12T00:00:00.000Z',
        data: { initialState: execution }
      })}\n`,
      'utf8'
    );
    fs.writeFileSync(
      prdPath,
      ['# 产品需求文档', '', '## 摘要', '- 安全展示 `<script>x</script>`', '', '| 字段 | 说明 |', '|------|------|', '| id | 标识 |'].join('\n'),
      'utf8'
    );

    const result = runRuntimeCommand('record-artifact', ['test-feat', 'prd.md', '1']);

    expect(result.status).toBe(0);
    expect(result.stderr).toBe('');
    const payload = JSON.parse(result.stdout) as {
      artifact: string;
      artifacts: string[];
      htmlArtifact?: string;
      htmlPath?: string;
    };
    expect(payload.artifact).toBe('prd.md');
    expect(payload.htmlArtifact).toBe('prd.html');
    expect(payload.htmlPath).toBe('.boss/test-feat/prd.html');
    expect(payload.artifacts).toContain('prd.md');
    expect(payload.artifacts).toContain('prd.html');

    const htmlPath = path.join(tmpDir, '.boss', 'test-feat', 'prd.html');
    expect(fs.existsSync(htmlPath)).toBe(true);
    const html = fs.readFileSync(htmlPath, 'utf8');
    expect(html).toMatch(/<!doctype html>/i);
    expect(html).toContain('产品需求文档 - test-feat');
    expect(html).toContain('&lt;script&gt;x&lt;/script&gt;');
    expect(html).toContain('<table>');
  });

  it('generate-summary runtime CLI emits markdown via stdout', () => {
    const result = runRuntimeCommand('generate-summary', ['test-feat', '--stdout']);

    expect(result.status).toBe(0);
    expect(result.stderr).toBe('');
    expect(result.stdout).toMatch(/# 流水线执行报告/);
    expect(result.stdout).toMatch(/test-feat/);
    expect(result.stdout).toMatch(/api-only/);
    expect(result.stdout).toMatch(/Gate 2 \(性能\)/);
    expect(result.stdout).toMatch(/插件失败次数/);
  });

  it('render-diagnostics runtime CLI emits an html diagnostics page', () => {
    const result = runRuntimeCommand('render-diagnostics', ['test-feat', '--stdout']);

    expect(result.status).toBe(0);
    expect(result.stderr).toBe('');
    expect(result.stdout).toMatch(/<!doctype html>/i);
    expect(result.stdout).toMatch(/test-feat/);
    expect(result.stdout).toMatch(/recent events/i);
    expect(result.stdout).toMatch(/progress flow/i);
  });

  it('generate-summary runtime CLI writes markdown/json report files', () => {
    const mdResult = runRuntimeCommand('generate-summary', ['test-feat']);
    expect(mdResult.status).toBe(0);
    expect(mdResult.stderr).toBe('');
    const mdPayload = JSON.parse(mdResult.stdout) as {
      feature: string;
      outputPath: string;
      format: string;
    };
    expect(mdPayload).toEqual({
      feature: 'test-feat',
      outputPath: '.boss/test-feat/summary-report.md',
      format: 'markdown'
    });
    const markdownPath = path.join(tmpDir, '.boss', 'test-feat', 'summary-report.md');
    expect(fs.existsSync(markdownPath)).toBe(true);
    expect(fs.readFileSync(markdownPath, 'utf8')).toMatch(/# 流水线执行报告/);

    const jsonResult = runRuntimeCommand('generate-summary', ['test-feat', '--json']);
    expect(jsonResult.status).toBe(0);
    expect(jsonResult.stderr).toBe('');
    const jsonStdoutPayload = JSON.parse(jsonResult.stdout) as {
      feature: string;
      outputPath: string;
      format: string;
    };
    expect(jsonStdoutPayload).toEqual({
      feature: 'test-feat',
      outputPath: '.boss/test-feat/summary-report.json',
      format: 'json'
    });
    const jsonPath = path.join(tmpDir, '.boss', 'test-feat', 'summary-report.json');
    expect(fs.existsSync(jsonPath)).toBe(true);
    const payload = JSON.parse(fs.readFileSync(jsonPath, 'utf8')) as {
      feature: string;
      pack: { name: string };
    };
    expect(payload.feature).toBe('test-feat');
    expect(payload.pack.name).toBe('api-only');
  });

  it('report writer runtime CLIs support structured dry-run without writing files', () => {
    const summaryResult = runRuntimeCommand('generate-summary', ['test-feat', '--dry-run', '--json']);
    expect(summaryResult.status).toBe(0);
    expect(summaryResult.stderr).toBe('');
    const summaryPayload = JSON.parse(summaryResult.stdout) as {
      actions: Array<{ type: string; path: string; format: string }>;
      risk_tier: string;
      requires_approval: boolean;
    };
    expect(summaryPayload).toEqual({
      actions: [
        {
          type: 'write_file',
          path: '.boss/test-feat/summary-report.json',
          format: 'json'
        }
      ],
      risk_tier: 'medium',
      requires_approval: false
    });
    expect(fs.existsSync(path.join(tmpDir, '.boss', 'test-feat', 'summary-report.json'))).toBe(false);

    const diagnosticsResult = runRuntimeCommand('render-diagnostics', ['test-feat', '--dry-run', '--json']);
    expect(diagnosticsResult.status).toBe(0);
    expect(diagnosticsResult.stderr).toBe('');
    const diagnosticsPayload = JSON.parse(diagnosticsResult.stdout) as {
      actions: Array<{ type: string; path: string; format: string }>;
    };
    expect(diagnosticsPayload.actions).toEqual([
      {
        type: 'write_file',
        path: '.boss/test-feat/diagnostics.html',
        format: 'html'
      }
    ]);
    expect(fs.existsSync(path.join(tmpDir, '.boss', 'test-feat', 'diagnostics.html'))).toBe(false);
  });

  it('normalizes empty failure reasons to null when materializing state', () => {
    const metaDir = path.join(tmpDir, '.boss', 'test-feat', '.meta');
    const events = [
      {
        id: 1,
        type: 'PipelineInitialized',
        timestamp: '2026-04-12T00:00:00.000Z',
        data: {
          initialState: {
            feature: 'test-feat',
            createdAt: '2026-04-12T00:00:00.000Z'
          }
        }
      },
      {
        id: 2,
        type: 'StageStarted',
        timestamp: '2026-04-12T00:00:10.000Z',
        data: { stage: 1 }
      },
      {
        id: 3,
        type: 'AgentStarted',
        timestamp: '2026-04-12T00:00:45.000Z',
        data: { stage: 1, agent: 'boss-backend' }
      },
      {
        id: 4,
        type: 'AgentFailed',
        timestamp: '2026-04-12T00:01:15.000Z',
        data: { stage: 1, agent: 'boss-backend', reason: '' }
      },
      {
        id: 5,
        type: 'StageFailed',
        timestamp: '2026-04-12T00:02:00.000Z',
        data: { stage: 1, reason: '' }
      }
    ];

    fs.writeFileSync(
      path.join(metaDir, 'events.jsonl'),
      `${events.map((event) => JSON.stringify(event)).join('\n')}\n`,
      'utf8'
    );

    const materialized = materializeState('test-feat', tmpDir);
    expect(materialized.state.stages['1']?.failureReason).toBeNull();
    expect(materialized.state.stages['1']?.agents?.['boss-backend']?.failureReason).toBeNull();
  });

  it('buildSummaryModel falls back to default for falsy pipelinePack values', () => {
    const metaDir = path.join(tmpDir, '.boss', 'test-feat', '.meta');
    const executionPath = path.join(metaDir, 'execution.json');
    const execution = JSON.parse(fs.readFileSync(executionPath, 'utf8')) as {
      parameters: { pipelinePack?: string };
    };
    execution.parameters.pipelinePack = '';
    fs.writeFileSync(executionPath, JSON.stringify(execution, null, 2), 'utf8');

    const model = buildSummaryModel('test-feat', { cwd: tmpDir });
    expect(model.pack.name).toBe('default');
  });

  it('direct TS report modules build and render summary output from execution state', () => {
    const model = buildSummaryModel('test-feat', { cwd: tmpDir });
    const json = renderJson(model);
    const markdown = renderMarkdown(model);
    const html = renderHtml({
      ...model,
      currentStage: { id: 2, name: 'review', status: 'running' },
      recentEvents: [{ type: 'StageStarted', timestamp: '2026-04-12T00:03:00.000Z' }],
      progressEvents: [{ type: 'stage-start', timestamp: '2026-04-12T00:03:00.000Z' }]
    });

    expect(model.stages[0]).toEqual(
      expect.objectContaining({
        stage: 1,
        name: 'planning',
        duration: 90,
        artifacts: ['prd.md', 'architecture.md']
      })
    );
    expect(JSON.parse(json) as { feature: string; pack: { name: string } }).toMatchObject({
      feature: 'test-feat',
      pack: { name: 'api-only' }
    });
    expect(json.endsWith('\n')).toBe(true);
    expect(markdown).toMatch(/# 流水线执行报告/);
    expect(markdown).toMatch(/Gate 2 \(性能\)/);
    expect(markdown).toMatch(/`prd\.md`/);
    expect(html).toMatch(/<!doctype html>/i);
    expect(html).toContain('Boss Diagnostics - test-feat');
    expect(html).toContain('Current stage: 2 (review) running');
    expect(html).toContain('recent events');
    expect(html).toContain('progress flow');
  });
});
