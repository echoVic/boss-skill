import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { execFileSync, spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import {
  buildFeatureSummary,
  writeFeatureMemory
} from '../../src/runtime/cli/lib/memory-runtime.js';
import { initPipeline } from '../../src/runtime/cli/lib/pipeline-runtime.js';

const REPO_ROOT = path.resolve(import.meta.dirname, '..', '..');
const DIST_ROOT = path.join(REPO_ROOT, 'dist', 'runtime', 'cli');
const RUN_WITH_FLAGS = path.join(REPO_ROOT, 'scripts', 'lib', 'run-with-flags.js');
const npmCmd = process.platform === 'win32' ? 'npm.cmd' : 'npm';

function buildCurrentDist() {
  execFileSync(npmCmd, ['run', 'build'], {
    cwd: REPO_ROOT,
    encoding: 'utf8'
  });
}

describe('runtime CLI contract', () => {
  let tmpDir: string;
  let originalCwd: string;

  beforeEach(() => {
    buildCurrentDist();
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'boss-runtime-cli-'));
    originalCwd = process.cwd();
    process.chdir(tmpDir);
  });

  afterEach(() => {
    process.chdir(originalCwd);
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  function distCli(name: string) {
    return path.join(DIST_ROOT, `${name}.js`);
  }

  function runCli(name: string, args: string[]) {
    return spawnSync(process.execPath, [distCli(name), ...args], {
      cwd: tmpDir,
      encoding: 'utf8'
    });
  }

  it('get-ready-artifacts CLI does not depend on runtime internal exports', () => {
    const source = fs.readFileSync(
      path.join(REPO_ROOT, 'src', 'runtime', 'cli', 'get-ready-artifacts.ts'),
      'utf8'
    );

    expect(source).not.toMatch(/\._internal\b/);
  });

  it('dist init-pipeline artifact is rebuilt from the current source under review', () => {
    const sourcePath = path.join(REPO_ROOT, 'src', 'runtime', 'cli', 'init-pipeline.ts');
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
      feature: string;
      gate: string;
      passed: boolean;
      checks: unknown[];
      dryRun?: boolean;
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
