import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

import { materializeState } from '../../src/runtime/projectors/materialize-state.js';
import { buildSummaryModel } from '../../src/runtime/report/summary-model.js';
import { renderHtml } from '../../src/runtime/report/render-html.js';
import { renderJson } from '../../src/runtime/report/render-json.js';
import { renderMarkdown } from '../../src/runtime/report/render-markdown.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const REPO_ROOT = path.resolve(__dirname, '..', '..');

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

  function runNode(script: string, args: string[]) {
    return spawnSync('node', [script, ...args], {
      cwd: tmpDir,
      encoding: 'utf8'
    });
  }

  it('generate-summary runtime CLI emits machine-readable JSON via stdout', () => {
    const cliPath = path.join(REPO_ROOT, 'runtime', 'cli', 'generate-summary.js');
    const result = runNode(cliPath, ['test-feat', '--json', '--stdout']);

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

  it('generate-summary runtime CLI emits markdown via stdout', () => {
    const cliPath = path.join(REPO_ROOT, 'runtime', 'cli', 'generate-summary.js');
    const result = runNode(cliPath, ['test-feat', '--stdout']);

    expect(result.status).toBe(0);
    expect(result.stderr).toBe('');
    expect(result.stdout).toMatch(/# 流水线执行报告/);
    expect(result.stdout).toMatch(/test-feat/);
    expect(result.stdout).toMatch(/api-only/);
    expect(result.stdout).toMatch(/Gate 2 \(性能\)/);
    expect(result.stdout).toMatch(/插件失败次数/);
  });

  it('render-diagnostics runtime CLI emits an html diagnostics page', () => {
    const cliPath = path.join(REPO_ROOT, 'runtime', 'cli', 'render-diagnostics.js');
    const result = runNode(cliPath, ['test-feat', '--stdout']);

    expect(result.status).toBe(0);
    expect(result.stderr).toBe('');
    expect(result.stdout).toMatch(/<!doctype html>/i);
    expect(result.stdout).toMatch(/test-feat/);
    expect(result.stdout).toMatch(/recent events/i);
    expect(result.stdout).toMatch(/progress flow/i);
  });

  it('generate-summary runtime CLI writes markdown/json report files', () => {
    const cliPath = path.join(REPO_ROOT, 'runtime', 'cli', 'generate-summary.js');

    const mdResult = runNode(cliPath, ['test-feat']);
    expect(mdResult.status).toBe(0);
    expect(mdResult.stderr).toBe('');
    const markdownPath = path.join(tmpDir, '.boss', 'test-feat', 'summary-report.md');
    expect(fs.existsSync(markdownPath)).toBe(true);
    expect(fs.readFileSync(markdownPath, 'utf8')).toMatch(/# 流水线执行报告/);

    const jsonResult = runNode(cliPath, ['test-feat', '--json']);
    expect(jsonResult.status).toBe(0);
    expect(jsonResult.stderr).toBe('');
    const jsonPath = path.join(tmpDir, '.boss', 'test-feat', 'summary-report.json');
    expect(fs.existsSync(jsonPath)).toBe(true);
    const payload = JSON.parse(fs.readFileSync(jsonPath, 'utf8')) as {
      feature: string;
      pack: { name: string };
    };
    expect(payload.feature).toBe('test-feat');
    expect(payload.pack.name).toBe('api-only');
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
