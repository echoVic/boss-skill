import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import {
  buildFeatureSummary,
  writeFeatureMemory
} from '../../packages/boss-cli/src/runtime/cli/lib/memory-runtime.js';
import { initPipeline } from '../../packages/boss-cli/src/runtime/cli/lib/pipeline-runtime.js';

const REPO_ROOT = path.resolve(import.meta.dirname, '..', '..');
const BOSS_BIN = path.join(REPO_ROOT, 'packages', 'boss-cli', 'dist', 'bin', 'boss.js');
const RUN_WITH_FLAGS = path.join(REPO_ROOT, 'scripts', 'lib', 'run-with-flags.js');

describe('runtime CLI contract', () => {
  let tmpDir: string;
  let originalCwd: string;

  beforeEach(() => {
    if (!fs.existsSync(BOSS_BIN)) {
      throw new Error('Missing built Boss CLI dist. Run `npm run build` before runtime CLI contract tests.');
    }
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'boss-runtime-cli-'));
    originalCwd = process.cwd();
    process.chdir(tmpDir);
  });

  afterEach(() => {
    process.chdir(originalCwd);
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  function distCli(name: string) {
    return path.join(REPO_ROOT, 'packages', 'boss-cli', 'dist', 'runtime', 'cli', `${name}.js`);
  }

  function runCli(name: string, args: string[]) {
    return spawnSync(process.execPath, [BOSS_BIN, 'runtime', name, ...args], {
      cwd: tmpDir,
      encoding: 'utf8'
    });
  }

  it('get-ready-artifacts CLI does not depend on runtime internal exports', () => {
    const source = fs.readFileSync(
      path.join(REPO_ROOT, 'packages', 'boss-cli', 'src', 'runtime', 'cli', 'get-ready-artifacts.ts'),
      'utf8'
    );

    expect(source).not.toMatch(/\._internal\b/);
  });

  it('dist init-pipeline artifact is rebuilt from the current source under review', () => {
    const sourcePath = path.join(REPO_ROOT, 'packages', 'boss-cli', 'src', 'runtime', 'cli', 'init-pipeline.ts');
    const distPath = distCli('init-pipeline');

    const sourceMtime = fs.statSync(sourcePath).mtimeMs;
    const distMtime = fs.statSync(distPath).mtimeMs;

    expect(distMtime).toBeGreaterThanOrEqual(sourceMtime);

    const source = fs.readFileSync(sourcePath, 'utf8');
    const dist = fs.readFileSync(distPath, 'utf8');

    expect(source).toContain('用法: init-pipeline.js <feature>');
    expect(dist).toContain('用法: init-pipeline.js <feature>');
  });

  it('init-pipeline CLI exposes help text and stable JSON fields', () => {
    const help = runCli('init-pipeline', ['--help']);
    expect(help.status).toBe(0);
    expect(help.stderr).toMatch(/用法: init-pipeline\.js <feature>/);

    const result = runCli('init-pipeline', ['test-feat']);
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

    const help = runCli('record-artifact', ['--help']);
    expect(help.status).toBe(0);
    expect(help.stderr).toMatch(/用法: record-artifact\.js <feature> <artifact> <stage>/);

    const result = runCli('record-artifact', ['test-feat', 'prd.md', '1']);
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

    const help = runCli('get-ready-artifacts', ['--help']);
    expect(help.status).toBe(0);
    expect(help.stdout).toMatch(/用法: get-ready-artifacts\.js <feature> <artifact> \[options\]/);
    expect(help.stdout).toContain(
      'DAG 文件路径（默认使用 .boss/artifact-dag.json 或内置 packages/boss-cli/assets/artifact-dag.json）'
    );

    const result = runCli('get-ready-artifacts', ['test-feat', '--ready', '--json']);
    expect(result.status).toBe(0);

    const payload = JSON.parse(result.stdout) as string[];
    expect(payload).toEqual(['prd.md']);
  });

  it('evaluate-gates CLI exposes help text and stable JSON fields', () => {
    initPipeline('test-feat', { cwd: tmpDir });

    const help = runCli('evaluate-gates', ['--help']);
    expect(help.status).toBe(0);
    expect(help.stderr).toMatch(/用法: evaluate-gates\.js <feature> <gate-name> \[options\]/);

    const result = runCli('evaluate-gates', ['test-feat', 'gate1', '--dry-run']);
    expect(result.status).toBe(0);

    const payload = JSON.parse(result.stdout) as {
      actions: Array<{ type: string; feature: string; gate: string; writes_event: boolean }>;
      risk_tier: string;
      requires_approval: boolean;
    };
    expect(payload).toEqual({
      actions: [
        {
          type: 'evaluate_gate',
          feature: 'test-feat',
          gate: 'gate1',
          writes_event: false
        }
      ],
      risk_tier: 'medium',
      requires_approval: false
    });
  });

  it('update-stage and update-agent CLIs expose runtime-first help text', () => {
    const stageHelp = runCli('update-stage', ['--help']);
    expect(stageHelp.status).toBe(0);
    expect(stageHelp.stderr).toMatch(/用法: update-stage\.js <feature> <stage> <status> \[options\]/);

    const agentHelp = runCli('update-agent', ['--help']);
    expect(agentHelp.status).toBe(0);
    expect(agentHelp.stderr).toMatch(
      /用法: update-agent\.js <feature> <stage> <agent-name> <status> \[options\]/
    );
  });

  it('check-stage, replay-events, inspect-progress, and render-diagnostics expose help text', () => {
    const stageHelp = runCli('check-stage', ['--help']);
    expect(stageHelp.status).toBe(0);
    expect(stageHelp.stdout + stageHelp.stderr).toMatch(/用法: check-stage\.js <feature>/);

    const replayHelp = runCli('replay-events', ['--help']);
    expect(replayHelp.status).toBe(0);
    expect(replayHelp.stdout + replayHelp.stderr).toMatch(/用法: replay-events\.js <feature>/);

    const progressHelp = runCli('inspect-progress', ['--help']);
    expect(progressHelp.status).toBe(0);
    expect(progressHelp.stdout + progressHelp.stderr).toMatch(/用法: inspect-progress\.js <feature>/);

    const diagnosticsHelp = runCli('render-diagnostics', ['--help']);
    expect(diagnosticsHelp.status).toBe(0);
    expect(diagnosticsHelp.stdout + diagnosticsHelp.stderr).toMatch(/用法: render-diagnostics\.js <feature>/);
  });

  it('extract-memory, query-memory, and build-memory-summary expose help text', () => {
    const extractHelp = runCli('extract-memory', ['--help']);
    expect(extractHelp.status).toBe(0);
    expect(extractHelp.stdout + extractHelp.stderr).toMatch(/用法: extract-memory\.js <feature>/);

    const queryHelp = runCli('query-memory', ['--help']);
    expect(queryHelp.status).toBe(0);
    expect(queryHelp.stdout + queryHelp.stderr).toMatch(/用法: query-memory\.js <feature>/);

    const summaryHelp = runCli('build-memory-summary', ['--help']);
    expect(summaryHelp.status).toBe(0);
    expect(summaryHelp.stdout + summaryHelp.stderr).toMatch(/用法: build-memory-summary\.js <feature>/);
  });

  it('query-memory emits stable json payloads for startup summaries', () => {
    writeFeatureMemory(
      'test-feat',
      [
        {
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
        }
      ],
      { cwd: tmpDir }
    );
    buildFeatureSummary('test-feat', { cwd: tmpDir });

    const result = runCli('query-memory', ['test-feat', '--startup', '--json']);
    expect(result.status).toBe(0);

    const payload = JSON.parse(result.stdout) as {
      feature: string;
      startupSummary: Array<{ summary: string }>;
    };
    expect(payload.feature).toBe('test-feat');
    expect(payload.startupSummary[0]?.summary).toBe('Stage 3 is unstable');
  });

  it('runtime commands expose describe metadata and structured non-tty errors', () => {
    for (const command of [
      'init-pipeline',
      'update-stage',
      'update-agent',
      'record-artifact',
      'get-ready-artifacts',
      'evaluate-gates',
      'check-stage',
      'replay-events',
      'inspect-progress',
      'inspect-pipeline',
      'inspect-events',
      'inspect-plugins',
      'render-diagnostics',
      'extract-memory',
      'query-memory',
      'build-memory-summary',
      'generate-summary',
      'register-plugins',
      'run-plugin-hook',
      'record-feedback',
      'retry-agent',
      'retry-stage'
    ]) {
      const describe = runCli(command, ['--describe']);
      expect(describe.status, `${command} --describe`).toBe(0);
      const metadata = JSON.parse(describe.stdout) as { command: string; options: Array<{ name: string }> };
      expect(metadata.command).toContain(command);
      expect(metadata.options.map((option) => option.name)).toContain('json');
    }

    const result = runCli('update-stage', ['missing-feature', '1', 'running', '--bad-flag']);
    expect(result.status).toBe(1);
    const payload = JSON.parse(result.stderr) as { error: { code: string; retryable: boolean } };
    expect(payload.error.code).toBe('unknown_option');
    expect(payload.error.retryable).toBe(false);
  });

  it('read-only runtime commands default to json in non-tty mode and support fields/limit', () => {
    initPipeline('test-feat', { cwd: tmpDir });

    const events = runCli('inspect-events', ['test-feat', '--limit', '1', '--fields', 'events']);
    expect(events.status).toBe(0);
    const eventsPayload = JSON.parse(events.stdout) as { events: unknown[] };
    expect(Object.keys(eventsPayload)).toEqual(['events']);
    expect(eventsPayload.events.length).toBeLessThanOrEqual(1);

    const pipeline = runCli('inspect-pipeline', ['test-feat', '--fields', 'feature,status']);
    expect(pipeline.status).toBe(0);
    expect(JSON.parse(pipeline.stdout)).toEqual({
      feature: 'test-feat',
      status: 'initialized'
    });
  });

  it('runtime field selectors consume space-separated option values consistently', () => {
    initPipeline('test-feat', { cwd: tmpDir });
    writeFeatureMemory(
      'test-feat',
      [
        {
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
        }
      ],
      { cwd: tmpDir }
    );
    buildFeatureSummary('test-feat', { cwd: tmpDir });

    const query = runCli('query-memory', ['test-feat', '--startup', '--fields', 'feature,startupSummary']);
    expect(query.status).toBe(0);
    expect(Object.keys(JSON.parse(query.stdout))).toEqual(['feature', 'startupSummary']);

    const plugins = runCli('inspect-plugins', ['test-feat', '--fields', 'feature,active']);
    expect(plugins.status).toBe(0);
    expect(Object.keys(JSON.parse(plugins.stdout))).toEqual(['feature', 'active']);

    const stage = runCli('check-stage', ['test-feat', '--summary', '--fields', 'status']);
    expect(stage.status).toBe(0);
    expect(JSON.parse(stage.stdout)).toEqual({ status: 'initialized' });
  });

  it('runtime describe metadata matches implemented fields and limit options', () => {
    const inspectPipeline = runCli('inspect-pipeline', ['--describe']);
    expect(inspectPipeline.status).toBe(0);
    const inspectPipelineMetadata = JSON.parse(inspectPipeline.stdout) as {
      options: Array<{ name: string; default?: unknown }>;
    };
    expect(inspectPipelineMetadata.options.map((option) => option.name)).toContain('fields');
    expect(inspectPipelineMetadata.options.map((option) => option.name)).not.toContain('limit');

    const inspectEvents = runCli('inspect-events', ['--describe']);
    expect(inspectEvents.status).toBe(0);
    const inspectEventsMetadata = JSON.parse(inspectEvents.stdout) as {
      options: Array<{ name: string; default?: unknown }>;
    };
    expect(inspectEventsMetadata.options.find((option) => option.name === 'limit')?.default).toBe('20');

    const updateStage = runCli('update-stage', ['--describe']);
    expect(updateStage.status).toBe(0);
    const updateStageMetadata = JSON.parse(updateStage.stdout) as {
      options: Array<{ name: string }>;
    };
    expect(updateStageMetadata.options.map((option) => option.name)).toEqual([
      'json',
      'describe',
      'fields',
      'dry-run',
      'json-input'
    ]);
  });

  it('runtime contract flags reject missing values before another option', () => {
    initPipeline('test-feat', { cwd: tmpDir });

    const fields = runCli('inspect-pipeline', ['test-feat', '--fields', '--json']);
    expect(fields.status).toBe(1);
    const fieldsPayload = JSON.parse(fields.stderr) as {
      error: { code: string; input: Record<string, unknown>; retryable: boolean };
    };
    expect(fieldsPayload.error).toMatchObject({
      code: 'missing_option_value',
      input: { option: '--fields' },
      retryable: false
    });

    const limit = runCli('inspect-events', ['test-feat', '--limit', '--fields', 'events']);
    expect(limit.status).toBe(1);
    const limitPayload = JSON.parse(limit.stderr) as {
      error: { code: string; input: Record<string, unknown> };
    };
    expect(limitPayload.error).toMatchObject({
      code: 'missing_option_value',
      input: { option: '--limit' }
    });

    const direct = spawnSync(
      process.execPath,
      [distCli('inspect-pipeline'), 'test-feat', '--fields', '--json'],
      {
        cwd: tmpDir,
        encoding: 'utf8'
      }
    );
    expect(direct.status).toBe(1);
    expect(direct.stderr).not.toContain('CliUserError');
    const directPayload = JSON.parse(direct.stderr) as {
      error: { code: string; input: Record<string, unknown> };
    };
    expect(directPayload.error).toMatchObject({
      code: 'missing_option_value',
      input: { option: '--fields' }
    });
  });

  it('memory writer runtime commands support dry-run without creating memory files', () => {
    initPipeline('test-feat', { cwd: tmpDir });
    fs.rmSync(path.join(tmpDir, '.boss', 'test-feat', '.meta', 'feature-memory.json'), { force: true });
    fs.rmSync(path.join(tmpDir, '.boss', 'test-feat', '.meta', 'memory-summary.json'), { force: true });

    const extractResult = runCli('extract-memory', ['test-feat', '--dry-run', '--json']);
    expect(extractResult.status).toBe(0);
    const extractPayload = JSON.parse(extractResult.stdout) as {
      actions: Array<{ type: string; path: string }>;
      risk_tier: string;
      requires_approval: boolean;
    };
    expect(extractPayload.actions).toEqual([
      {
        type: 'write_file',
        path: '.boss/test-feat/.meta/feature-memory.json'
      }
    ]);
    expect(extractPayload.risk_tier).toBe('medium');
    expect(extractPayload.requires_approval).toBe(false);
    expect(fs.existsSync(path.join(tmpDir, '.boss', 'test-feat', '.meta', 'feature-memory.json'))).toBe(false);

    const summaryResult = runCli('build-memory-summary', ['test-feat', '--dry-run', '--json']);
    expect(summaryResult.status).toBe(0);
    const summaryPayload = JSON.parse(summaryResult.stdout) as {
      actions: Array<{ type: string; path: string }>;
    };
    expect(summaryPayload.actions).toEqual([
      {
        type: 'write_file',
        path: '.boss/test-feat/.meta/memory-summary.json'
      }
    ]);
    expect(fs.existsSync(path.join(tmpDir, '.boss', 'test-feat', '.meta', 'memory-summary.json'))).toBe(false);
  });

  it('mutating runtime commands support dry-run plans and json input', () => {
    initPipeline('test-feat', { cwd: tmpDir });

    const updateStage = runCli('update-stage', [
      '--json-input={"feature":"test-feat","stage":1,"status":"running"}',
      '--dry-run',
      '--json'
    ]);
    expect(updateStage.status).toBe(0);
    expect(JSON.parse(updateStage.stdout)).toEqual({
      actions: [
        expect.objectContaining({
          type: 'update_stage',
          feature: 'test-feat',
          stage: 1,
          target_status: 'running'
        })
      ],
      risk_tier: 'medium',
      requires_approval: false
    });

    const retryStage = runCli('retry-stage', ['test-feat', '1', '--dry-run', '--json']);
    expect(retryStage.status).toBe(0);
    const retryPayload = JSON.parse(retryStage.stdout) as {
      actions: Array<{ type: string; feature: string; stage: number }>;
      requires_approval: boolean;
    };
    expect(retryPayload.actions[0]).toMatchObject({
      type: 'retry_stage',
      feature: 'test-feat',
      stage: 1
    });
  });

  it('mutating runtime commands require yes for non-interactive high risk retry execution', () => {
    initPipeline('test-feat', { cwd: tmpDir });

    const result = runCli('retry-stage', ['test-feat', '1', '--json']);
    expect(result.status).toBe(1);
    const payload = JSON.parse(result.stderr) as { error: { code: string } };
    expect(payload.error.code).toBe('confirmation_required');
  });

  it('read-only runtime command errors are structured in non-tty mode', () => {
    const result = runCli('inspect-pipeline', ['missing-feature']);

    expect(result.status).toBe(1);
    const payload = JSON.parse(result.stderr) as { error: { code: string; input: Record<string, unknown> } };
    expect(payload.error.code).toBe('feature_not_found');
    expect(payload.error.input).toEqual({ feature: 'missing-feature' });
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

    const result = spawnSync(process.execPath, [RUN_WITH_FLAGS, 'session-start', 'echo-hook.js'], {
      cwd: tmpDir,
      env: { ...process.env, SKILL_DIR: pluginRoot },
      input,
      encoding: 'utf8'
    });

    fs.rmSync(pluginRoot, { recursive: true, force: true });

    expect(result.status).toBe(0);
    expect(
      JSON.parse(result.stdout) as {
        length: number;
        first: string;
        secondChunk: string;
        nearEnd: string;
      }
    ).toEqual({
      length: 1024 * 1024,
      first: 'A',
      secondChunk: 'B',
      nearEnd: 'V'
    });
  });
});
