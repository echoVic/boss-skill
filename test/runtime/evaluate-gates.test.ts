import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { evaluateGates, initPipeline } from '../../src/runtime/cli/lib/pipeline-runtime.js';

const REPO_ROOT = path.resolve(import.meta.dirname, '..', '..');

describe('evaluateGates', () => {
  let tmpDir: string;
  let cwd: string;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'boss-gate-cli-'));
    cwd = process.cwd();
    process.chdir(tmpDir);
    initPipeline('test-feat', { cwd: tmpDir });
  });

  afterEach(() => {
    process.chdir(cwd);
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it('returns gate result data and materializes qualityGates', () => {
    const result = evaluateGates('test-feat', 'gate1', { cwd: tmpDir });
    expect(typeof result.passed).toBe('boolean');
    expect(Array.isArray(result.checks)).toBe(true);
    expect(result.execution.qualityGates.gate1.status).toBe('completed');
  });

  it('resolves plugin gates from cwd-local harness/plugins', () => {
    const pluginDir = path.join(tmpDir, 'harness', 'plugins', 'local-gate');
    fs.mkdirSync(pluginDir, { recursive: true });
    fs.writeFileSync(path.join(pluginDir, 'gate.sh'), '#!/bin/bash\necho "[]"\nexit 0\n', 'utf8');
    fs.chmodSync(path.join(pluginDir, 'gate.sh'), 0o755);

    const result = evaluateGates('test-feat', 'local-gate', { cwd: tmpDir });
    expect(result.passed).toBe(true);
    expect(result.execution.qualityGates['local-gate'].status).toBe('completed');
  });

  it('dry-run does not append gate results', () => {
    const result = evaluateGates('test-feat', 'gate1', { cwd: tmpDir, dryRun: true });
    expect(typeof result.passed).toBe('boolean');

    const executionPath = path.join(tmpDir, '.boss', 'test-feat', '.meta', 'execution.json');
    const execution = JSON.parse(fs.readFileSync(executionPath, 'utf8')) as {
      qualityGates: Record<string, { status: string }>;
    };
    expect(execution.qualityGates.gate1.status).toBe('pending');

    const eventsPath = path.join(tmpDir, '.boss', 'test-feat', '.meta', 'events.jsonl');
    const events = fs
      .readFileSync(eventsPath, 'utf8')
      .trim()
      .split('\n')
      .map((line) => JSON.parse(line) as { type: string });
    const hasGateEvaluated = events.some((event) => event.type === 'GateEvaluated');
    expect(hasGateEvaluated).toBe(false);
  });

  it('skip-on-error ignores missing gates', () => {
    const result = evaluateGates('test-feat', 'missing-gate', {
      cwd: tmpDir,
      skipOnError: true
    });
    expect(result.skipped).toBe(true);
    expect(result.passed).toBe(true);

    const executionPath = path.join(tmpDir, '.boss', 'test-feat', '.meta', 'execution.json');
    const execution = JSON.parse(fs.readFileSync(executionPath, 'utf8')) as {
      qualityGates: Record<string, unknown>;
    };
    expect(execution.qualityGates['missing-gate']).toBeUndefined();
  });

  it('returns non-zero exit for failing gate via dist runtime CLI', () => {
    const pluginDir = path.join(tmpDir, 'harness', 'plugins', 'fail-gate');
    fs.mkdirSync(pluginDir, { recursive: true });
    fs.writeFileSync(path.join(pluginDir, 'gate.sh'), '#!/bin/bash\necho "[]"\nexit 1\n', 'utf8');
    fs.chmodSync(path.join(pluginDir, 'gate.sh'), 0o755);

    const cli = path.join(REPO_ROOT, 'dist', 'runtime', 'cli', 'evaluate-gates.js');
    const result = spawnSync(process.execPath, [cli, 'test-feat', 'fail-gate'], {
      cwd: tmpDir,
      encoding: 'utf8'
    });
    expect(result.status).not.toBe(0);
  });

  it('uses cwd-local plugin stage metadata when materializing gate results', () => {
    const pluginDir = path.join(tmpDir, 'harness', 'plugins', 'stage-gate');
    fs.mkdirSync(pluginDir, { recursive: true });
    fs.writeFileSync(path.join(pluginDir, 'gate.sh'), '#!/bin/bash\necho "[]"\nexit 0\n', 'utf8');
    fs.writeFileSync(path.join(pluginDir, 'plugin.json'), '{ "stages": [2] }\n', 'utf8');
    fs.chmodSync(path.join(pluginDir, 'gate.sh'), 0o755);

    const result = evaluateGates('test-feat', 'stage-gate', { cwd: tmpDir });
    expect(result.execution.stages['2'].gateResults['stage-gate'].passed).toBe(true);
    expect(result.execution.stages['3'].gateResults['stage-gate']).toBeUndefined();
  });

  it('reports missing args at dist runtime CLI boundary', () => {
    const cli = path.join(REPO_ROOT, 'dist', 'runtime', 'cli', 'evaluate-gates.js');
    const result = spawnSync(process.execPath, [cli], { cwd: tmpDir, encoding: 'utf8' });
    expect(result.status).not.toBe(0);
    expect(result.stderr).toMatch(/evaluate-gates\.js|缺少 gate-name 参数/);
  });

  it('records stderr-only gate checks', () => {
    const pluginDir = path.join(tmpDir, 'harness', 'plugins', 'stderr-gate');
    fs.mkdirSync(pluginDir, { recursive: true });
    fs.writeFileSync(
      path.join(pluginDir, 'gate.sh'),
      '#!/bin/bash\necho "[{\\"name\\":\\"stderr-only\\",\\"passed\\":true}]" 1>&2\nexit 0\n',
      'utf8'
    );
    fs.chmodSync(path.join(pluginDir, 'gate.sh'), 0o755);

    const result = evaluateGates('test-feat', 'stderr-gate', { cwd: tmpDir });
    expect((result.execution.qualityGates['stderr-gate'].checks[0] as { name: string }).name).toBe(
      'stderr-only'
    );
  });

  it('falls back to stage 3 when plugin stage metadata is invalid', () => {
    const pluginDir = path.join(tmpDir, 'harness', 'plugins', 'bad-stage-gate');
    fs.mkdirSync(pluginDir, { recursive: true });
    fs.writeFileSync(path.join(pluginDir, 'gate.sh'), '#!/bin/bash\necho "[]"\nexit 0\n', 'utf8');
    fs.writeFileSync(path.join(pluginDir, 'plugin.json'), '{ "stages": [0] }\n', 'utf8');
    fs.chmodSync(path.join(pluginDir, 'gate.sh'), 0o755);

    const result = evaluateGates('test-feat', 'bad-stage-gate', { cwd: tmpDir });
    expect(result.execution.stages['3'].gateResults['bad-stage-gate'].passed).toBe(true);
  });

  it('falls back to repo-root plugins when cwd-local plugin is missing', () => {
    const repoPluginDir = path.join(REPO_ROOT, 'harness', 'plugins', 'repo-gate');
    fs.mkdirSync(repoPluginDir, { recursive: true });
    fs.writeFileSync(path.join(repoPluginDir, 'gate.sh'), '#!/bin/bash\necho "[]"\nexit 0\n', 'utf8');
    fs.chmodSync(path.join(repoPluginDir, 'gate.sh'), 0o755);

    try {
      const result = evaluateGates('test-feat', 'repo-gate', { cwd: tmpDir });
      expect(result.passed).toBe(true);
    } finally {
      fs.rmSync(repoPluginDir, { recursive: true, force: true });
    }
  });

  it('gate0 includes secrets-scan and unsafe-patterns checks', () => {
    const gate0Path = path.join(REPO_ROOT, 'scripts', 'gates', 'gate0-code-quality.sh');
    const gate0Content = fs.readFileSync(gate0Path, 'utf8');

    expect(gate0Content).toContain('secrets-scan');
    expect(gate0Content).toContain('unsafe-patterns');
  });
});
