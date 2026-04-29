import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  initPipeline,
  evaluateGates,
  resolveGateConfig
} from '../../src/runtime/cli/lib/pipeline-runtime.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, '../..');

describe('configurable gate coverage threshold', () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'boss-gate-cfg-'));
    initPipeline('test-feat', { cwd: tmpDir });
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it('resolveGateConfig returns default 70 when no pack override', () => {
    const config = resolveGateConfig('test-feat', 'gate1', { cwd: tmpDir });
    expect(config).toEqual({ coverage: 70 });
  });

  it('resolveGateConfig returns pack override when gateConfig.coverage is set', () => {
    // Write gateConfig into execution.json parameters.packConfig
    const execPath = path.join(tmpDir, '.boss', 'test-feat', '.meta', 'execution.json');
    const exec = JSON.parse(fs.readFileSync(execPath, 'utf8'));
    exec.parameters = exec.parameters || {};
    exec.parameters.packConfig = { ...(exec.parameters.packConfig || {}), gateConfig: { coverage: 80 } };
    fs.writeFileSync(execPath, JSON.stringify(exec, null, 2), 'utf8');

    const config = resolveGateConfig('test-feat', 'gate1', { cwd: tmpDir });
    expect(config).toEqual({ coverage: 80 });
  });

  it('evaluateGates passes GATE_COVERAGE_THRESHOLD env var to gate scripts', () => {
    // Create a custom gate that echoes the env var in its output
    const gateDir = path.join(tmpDir, 'harness', 'plugins', 'env-echo');
    fs.mkdirSync(gateDir, { recursive: true });
    const gateScript = path.join(gateDir, 'gate.sh');
    fs.writeFileSync(gateScript, [
      '#!/bin/bash',
      'T="${GATE_COVERAGE_THRESHOLD:-unset}"',
      'echo "[{\\"name\\":\\"threshold\\",\\"passed\\":true,\\"detail\\":\\"${T}\\"}]"',
      'exit 0'
    ].join('\n'), 'utf8');
    fs.chmodSync(gateScript, 0o755);

    const result = evaluateGates('test-feat', 'env-echo', { cwd: tmpDir, dryRun: true });
    expect(result.passed).toBe(true);
    // The default threshold (70) should have been passed
    const check = result.checks.find((c: any) => c.name === 'threshold') as any;
    expect(check?.detail).toBe('70');
  });

  it('gate1-testing.sh reads GATE_COVERAGE_THRESHOLD variable', () => {
    const gate1Path = path.join(REPO_ROOT, 'scripts', 'gates', 'gate1-testing.sh');
    const content = fs.readFileSync(gate1Path, 'utf8');
    expect(content).toContain('GATE_COVERAGE_THRESHOLD');
  });
});
