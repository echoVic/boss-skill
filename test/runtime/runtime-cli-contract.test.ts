import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

import { buildFeatureSummary, writeFeatureMemory } from '../../runtime/cli/lib/memory-runtime.js';
import { initPipeline } from '../../runtime/cli/lib/pipeline-runtime.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const REPO_ROOT = path.resolve(__dirname, '..', '..');
const INIT_PIPELINE_CLI = path.join(REPO_ROOT, 'runtime', 'cli', 'init-pipeline.js');
const GET_READY_ARTIFACTS_CLI = path.join(REPO_ROOT, 'runtime', 'cli', 'get-ready-artifacts.js');
const RECORD_ARTIFACT_CLI = path.join(REPO_ROOT, 'runtime', 'cli', 'record-artifact.js');
const UPDATE_STAGE_CLI = path.join(REPO_ROOT, 'runtime', 'cli', 'update-stage.js');
const UPDATE_AGENT_CLI = path.join(REPO_ROOT, 'runtime', 'cli', 'update-agent.js');
const EVALUATE_GATES_CLI = path.join(REPO_ROOT, 'runtime', 'cli', 'evaluate-gates.js');
const CHECK_STAGE_CLI = path.join(REPO_ROOT, 'runtime', 'cli', 'check-stage.js');
const REPLAY_EVENTS_CLI = path.join(REPO_ROOT, 'runtime', 'cli', 'replay-events.js');
const INSPECT_PROGRESS_CLI = path.join(REPO_ROOT, 'runtime', 'cli', 'inspect-progress.js');
const RENDER_DIAGNOSTICS_CLI = path.join(REPO_ROOT, 'runtime', 'cli', 'render-diagnostics.js');
const EXTRACT_MEMORY_CLI = path.join(REPO_ROOT, 'runtime', 'cli', 'extract-memory.js');
const QUERY_MEMORY_CLI = path.join(REPO_ROOT, 'runtime', 'cli', 'query-memory.js');
const BUILD_MEMORY_SUMMARY_CLI = path.join(REPO_ROOT, 'runtime', 'cli', 'build-memory-summary.js');
const RUN_WITH_FLAGS = path.join(REPO_ROOT, 'scripts', 'lib', 'run-with-flags.js');

describe('runtime CLI contract', () => {
  let tmpDir: string;
  let originalCwd: string;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'boss-runtime-cli-'));
    originalCwd = process.cwd();
    process.chdir(tmpDir);
  });

  afterEach(() => {
    process.chdir(originalCwd);
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  function runCli(script: string, args: string[]) {
    return spawnSync(process.execPath, [script, ...args], {
      cwd: tmpDir,
      encoding: 'utf8'
    });
  }

  it('get-ready-artifacts CLI does not depend on runtime internal exports', () => {
    const source = fs.readFileSync(
      path.join(REPO_ROOT, 'runtime', 'cli', 'get-ready-artifacts.js'),
      'utf8'
    );

    expect(source).not.toMatch(/\._internal\b/);
  });

  it('init-pipeline CLI exposes help text and stable JSON fields', () => {
    const help = runCli(INIT_PIPELINE_CLI, ['--help']);
    expect(help.status).toBe(0);
    expect(help.stderr).toMatch(/用法: init-pipeline\.js <feature>/);

    const result = runCli(INIT_PIPELINE_CLI, ['test-feat']);
    expect(result.status).toBe(0);

    const payload = JSON.parse(result.stdout) as {
      feature: string;
      status: string;
      executionPath: string;
    };
    expect(payload.feature).toBe('test-feat');
    expect(payload.status).toBe('initialized');
    expect(payload.executionPath).toBe('.boss/test-feat/.meta/execution.json');
  });

  it('record-artifact CLI exposes help text and stable JSON fields', () => {
    initPipeline('test-feat', { cwd: tmpDir });

    const help = runCli(RECORD_ARTIFACT_CLI, ['--help']);
    expect(help.status).toBe(0);
    expect(help.stderr).toMatch(/用法: record-artifact\.js <feature> <artifact> <stage>/);

    const result = runCli(RECORD_ARTIFACT_CLI, ['test-feat', 'prd.md', '1']);
    expect(result.status).toBe(0);

    const payload = JSON.parse(result.stdout) as {
      feature: string;
      artifact: string;
      stage: number;
      artifacts: string[];
    };
    expect(payload.feature).toBe('test-feat');
    expect(payload.artifact).toBe('prd.md');
    expect(payload.stage).toBe(1);
    expect(payload.artifacts).toEqual(['prd.md']);
  });

  it('get-ready-artifacts CLI exposes help text and stable ready-artifact JSON', () => {
    initPipeline('test-feat', { cwd: tmpDir });

    const help = runCli(GET_READY_ARTIFACTS_CLI, ['--help']);
    expect(help.status).toBe(0);
    expect(help.stdout).toMatch(/用法: get-ready-artifacts\.js <feature> <artifact> \[options\]/);

    const result = runCli(GET_READY_ARTIFACTS_CLI, ['test-feat', '--ready', '--json']);
    expect(result.status).toBe(0);

    const payload = JSON.parse(result.stdout) as string[];
    expect(payload).toEqual(['prd.md']);
  });

  it('evaluate-gates CLI exposes help text and stable JSON fields', () => {
    initPipeline('test-feat', { cwd: tmpDir });

    const help = runCli(EVALUATE_GATES_CLI, ['--help']);
    expect(help.status).toBe(0);
    expect(help.stderr).toMatch(/用法: evaluate-gates\.js <feature> <gate-name> \[options\]/);

    const result = runCli(EVALUATE_GATES_CLI, ['test-feat', 'gate1', '--dry-run']);
    expect(result.status).toBe(0);

    const payload = JSON.parse(result.stdout) as {
      feature: string;
      gate: string;
      passed: boolean;
      checks: unknown[];
      dryRun: boolean;
      skipped: boolean;
    };
    expect(payload.feature).toBe('test-feat');
    expect(payload.gate).toBe('gate1');
    expect(typeof payload.passed).toBe('boolean');
    expect(Array.isArray(payload.checks)).toBe(true);
    expect(payload.dryRun).toBe(true);
    expect(typeof payload.skipped).toBe('boolean');
  });

  it('update-stage and update-agent CLIs expose runtime-first help text', () => {
    const stageHelp = runCli(UPDATE_STAGE_CLI, ['--help']);
    expect(stageHelp.status).toBe(0);
    expect(stageHelp.stderr).toMatch(/用法: update-stage\.js <feature> <stage> <status> \[options\]/);

    const agentHelp = runCli(UPDATE_AGENT_CLI, ['--help']);
    expect(agentHelp.status).toBe(0);
    expect(agentHelp.stderr).toMatch(/用法: update-agent\.js <feature> <stage> <agent-name> <status> \[options\]/);
  });

  it('check-stage, replay-events, inspect-progress, and render-diagnostics expose help text', () => {
    const stageHelp = runCli(CHECK_STAGE_CLI, ['--help']);
    expect(stageHelp.status).toBe(0);
    expect(stageHelp.stdout + stageHelp.stderr).toMatch(/用法: check-stage\.js <feature>/);

    const replayHelp = runCli(REPLAY_EVENTS_CLI, ['--help']);
    expect(replayHelp.status).toBe(0);
    expect(replayHelp.stdout + replayHelp.stderr).toMatch(/用法: replay-events\.js <feature>/);

    const progressHelp = runCli(INSPECT_PROGRESS_CLI, ['--help']);
    expect(progressHelp.status).toBe(0);
    expect(progressHelp.stdout + progressHelp.stderr).toMatch(/用法: inspect-progress\.js <feature>/);

    const diagnosticsHelp = runCli(RENDER_DIAGNOSTICS_CLI, ['--help']);
    expect(diagnosticsHelp.status).toBe(0);
    expect(diagnosticsHelp.stdout + diagnosticsHelp.stderr).toMatch(/用法: render-diagnostics\.js <feature>/);
  });

  it('extract-memory, query-memory, and build-memory-summary expose help text', () => {
    const extractHelp = runCli(EXTRACT_MEMORY_CLI, ['--help']);
    expect(extractHelp.status).toBe(0);
    expect(extractHelp.stdout + extractHelp.stderr).toMatch(/用法: extract-memory\.js <feature>/);

    const queryHelp = runCli(QUERY_MEMORY_CLI, ['--help']);
    expect(queryHelp.status).toBe(0);
    expect(queryHelp.stdout + queryHelp.stderr).toMatch(/用法: query-memory\.js <feature>/);

    const summaryHelp = runCli(BUILD_MEMORY_SUMMARY_CLI, ['--help']);
    expect(summaryHelp.status).toBe(0);
    expect(summaryHelp.stdout + summaryHelp.stderr).toMatch(/用法: build-memory-summary\.js <feature>/);
  });

  it('query-memory emits stable json payloads for startup summaries', () => {
    writeFeatureMemory('test-feat', [{
      id: 'm1',
      scope: 'feature',
      kind: 'execution',
      category: 'historical_risk',
      summary: 'Stage 3 is unstable',
      source: { type: 'events' },
      evidence: [{ type: 'event', ref: '2' }],
      tags: ['stage3'],
      confidence: 0.8,
      createdAt: '2026-04-17T00:00:00Z',
      lastSeenAt: '2026-04-17T00:00:00Z',
      expiresAt: null,
      decayScore: 10,
      influence: 'preference'
    }], { cwd: tmpDir });
    buildFeatureSummary('test-feat', { cwd: tmpDir });

    const result = runCli(QUERY_MEMORY_CLI, ['test-feat', '--startup', '--json']);
    expect(result.status).toBe(0);

    const payload = JSON.parse(result.stdout) as {
      feature: string;
      startupSummary: Array<{ summary: string }>;
    };
    expect(payload.feature).toBe('test-feat');
    expect(payload.startupSummary[0]?.summary).toBe('Stage 3 is unstable');
  });

  it('run-with-flags launches async ESM hook modules, preserves chunk order, and caps stdin at 1 MB', () => {
    const pluginRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'boss-launcher-'));
    const hookPath = path.join(pluginRoot, 'echo-hook.js');
    fs.writeFileSync(
      hookPath,
      [
        'export async function run(rawInput) {',
        '  await Promise.resolve();',
        '  return {',
        '    stdout: JSON.stringify({',
        '      length: rawInput.length,',
        '      first: rawInput[0],',
        '      secondChunk: rawInput[4096],',
        '      nearEnd: rawInput[rawInput.length - 1]',
        '    }),',
        '    exitCode: 0',
        '  };',
        '}',
        ''
      ].join('\n'),
      'utf8'
    );

    const chunkSize = 4096;
    const chunkCount = Math.floor((1024 * 1024) / chunkSize);
    const input = Buffer.alloc(1024 * 1024 + 128);
    for (let index = 0; index < chunkCount; index += 1) {
      const fill = String.fromCharCode(65 + (index % 26));
      input.fill(fill, index * chunkSize, (index + 1) * chunkSize, 'utf8');
    }
    input.fill('z', 1024 * 1024);

    const result = spawnSync(
      process.execPath,
      [RUN_WITH_FLAGS, 'session-start', 'echo-hook.js'],
      {
        cwd: tmpDir,
        env: { ...process.env, SKILL_DIR: pluginRoot },
        input,
        encoding: 'utf8'
      }
    );

    fs.rmSync(pluginRoot, { recursive: true, force: true });

    expect(result.status).toBe(0);
    expect(JSON.parse(result.stdout) as {
      length: number;
      first: string;
      secondChunk: string;
      nearEnd: string;
    }).toEqual({
      length: 1024 * 1024,
      first: 'A',
      secondChunk: 'B',
      nearEnd: 'V'
    });
  });
});
