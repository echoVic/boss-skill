import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const REPO_ROOT = path.resolve(import.meta.dirname, '..', '..');
const BOSS_BIN = path.join(REPO_ROOT, 'packages', 'boss-cli', 'dist', 'bin', 'boss.js');

function runBoss(args: string[], cwd: string, input?: string) {
  return spawnSync(process.execPath, [BOSS_BIN, ...args], {
    cwd,
    input,
    encoding: 'utf8',
    env: { ...process.env, NO_COLOR: '1' }
  });
}

function parseJson(stdout: string): unknown {
  expect(stdout.trim().length).toBeGreaterThan(0);
  return JSON.parse(stdout);
}

describe('agent-friendly boss CLI contract', () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'boss-agent-cli-'));
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it('defaults to JSON for non-TTY command output', () => {
    const result = runBoss(['packs', 'detect', '.'], tmpDir);

    expect(result.status).toBe(0);
    const payload = parseJson(result.stdout) as {
      detected: string;
      matched: string[];
    };
    expect(payload.detected).toBe('default');
    expect(Array.isArray(payload.matched)).toBe(true);
    expect(result.stderr).not.toContain('[PACK-DETECT]');
  });

  it('returns structured errors with code, input echo, retryability, and suggestion', () => {
    const result = runBoss(['packs', 'detect', '../outside'], tmpDir);

    expect(result.status).toBe(1);
    const payload = JSON.parse(result.stderr) as {
      error: {
        code: string;
        message: string;
        input: Record<string, unknown>;
        retryable: boolean;
        suggestion?: string;
      };
    };
    expect(payload.error.code).toBe('invalid_path');
    expect(payload.error.input).toEqual({ path: '../outside' });
    expect(payload.error.retryable).toBe(false);
    expect(payload.error.suggestion).toContain('project directory');
  });

  it('describes commands as stable JSON schemas', () => {
    const result = runBoss(['project', 'init', '--describe'], tmpDir);

    expect(result.status).toBe(0);
    const payload = parseJson(result.stdout) as {
      command: string;
      parameters: Array<{ name: string; type: string; required?: boolean }>;
      options: Array<{ name: string; type: string }>;
      risk_tier: string;
    };
    expect(payload.command).toBe('boss project init');
    expect(payload.parameters.some((param) => param.name === 'feature')).toBe(true);
    expect(payload.options.map((option) => option.name)).toContain('json');
    expect(payload.options.map((option) => option.name)).toContain('json-input');
    expect(payload.risk_tier).toBe('medium');
  });

  it('supports JSON input from stdin for project init dry-run', () => {
    const result = runBoss(
      ['project', 'init', '--json-input=-', '--dry-run', '--json'],
      tmpDir,
      '{"feature":"agent-json-input","template":true}'
    );

    expect(result.status).toBe(0);
    const payload = parseJson(result.stdout) as {
      actions: Array<{ type: string; path?: string }>;
      requires_approval: boolean;
    };
    expect(payload.actions.some((action) => action.type === 'create_feature_workspace')).toBe(true);
    expect(payload.requires_approval).toBe(false);
    expect(fs.existsSync(path.join(tmpDir, '.boss', 'agent-json-input'))).toBe(false);
  });

  it('requires --yes for non-interactive destructive overwrite', () => {
    fs.mkdirSync(path.join(tmpDir, '.boss', 'danger-zone'), { recursive: true });

    const result = runBoss(['project', 'init', 'danger-zone', '--force', '--json'], tmpDir);

    expect(result.status).toBe(1);
    const payload = JSON.parse(result.stderr) as { error: { code: string; retryable: boolean } };
    expect(payload.error.code).toBe('confirmation_required');
    expect(payload.error.retryable).toBe(false);
  });

  it('limits and picks fields for list-like JSON output', () => {
    const result = runBoss(['runtime', 'inspect-events', 'missing-feature', '--limit=1', '--fields=events', '--json'], tmpDir);

    expect(result.status).toBe(1);
    const payload = JSON.parse(result.stderr) as { error: { code: string } };
    expect(payload.error.code).toBe('feature_not_found');
  });
});
