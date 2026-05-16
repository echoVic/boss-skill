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
    fs.rmSync(tmpDir, { recursive: true, force: true, maxRetries: 5, retryDelay: 200 });
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

  it('treats project init --force as the explicit overwrite confirmation', () => {
    fs.mkdirSync(path.join(tmpDir, '.boss', 'danger-zone'), { recursive: true });

    const result = runBoss(['project', 'init', 'danger-zone', '--force', '--json'], tmpDir);

    expect(result.status).toBe(0);
    const payload = parseJson(result.stdout) as { feature: string; created: boolean };
    expect(payload.feature).toBe('danger-zone');
    expect(payload.created).toBe(true);
  });

  it('copies the artifact html template during project init with --template', () => {
    const result = runBoss(['project', 'init', 'template-demo', '--template', '--json'], tmpDir);

    expect(result.status).toBe(0);
    const artifactTemplate = path.join(tmpDir, '.boss', 'templates', 'artifact.html.template');
    expect(fs.existsSync(artifactTemplate)).toBe(true);
    expect(fs.readFileSync(artifactTemplate, 'utf8')).toContain('{{BODY_HTML}}');
  });

  it('documents project init --force without redundant --yes confirmation', () => {
    const result = runBoss(['project', 'init', '--help'], tmpDir);

    expect(result.status).toBe(0);
    expect(result.stdout).toContain('--force');
    expect(result.stdout).not.toContain('--yes');
  });

  it('excludes .boss artifacts from Tailwind v4 automatic source detection during project init', () => {
    fs.writeFileSync(
      path.join(tmpDir, 'package.json'),
      JSON.stringify({ dependencies: { tailwindcss: '^4.1.0' } }, null, 2),
      'utf8'
    );
    fs.mkdirSync(path.join(tmpDir, 'app'), { recursive: true });
    const cssPath = path.join(tmpDir, 'app', 'globals.css');
    fs.writeFileSync(cssPath, '@import "tailwindcss";\n', 'utf8');

    const result = runBoss(['project', 'init', 'tailwind-v4-demo', '--json'], tmpDir);

    expect(result.status).toBe(0);
    const css = fs.readFileSync(cssPath, 'utf8');
    expect(css).toContain('@source not "../.boss";');
  });

  it('limits and picks fields for list-like JSON output', () => {
    const init = runBoss(['runtime', 'init-pipeline', 'events-feature'], tmpDir);
    expect(init.status).toBe(0);

    const running = runBoss(['runtime', 'update-stage', 'events-feature', '1', 'running', '--json'], tmpDir);
    expect(running.status).toBe(0);

    const completed = runBoss(['runtime', 'update-stage', 'events-feature', '1', 'completed', '--json'], tmpDir);
    expect(completed.status).toBe(0);

    const result = runBoss(
      ['runtime', 'inspect-events', 'events-feature', '--limit=1', '--fields=events', '--json'],
      tmpDir
    );

    expect(result.status).toBe(0);
    const payload = parseJson(result.stdout) as { events: unknown[] };
    expect(Object.keys(payload)).toEqual(['events']);
    expect(Array.isArray(payload.events)).toBe(true);
    expect(payload.events).toHaveLength(1);
  });

  it('install dry-run returns structured actions and writes nothing', () => {
    const home = path.join(tmpDir, 'home');
    fs.mkdirSync(path.join(home, '.codex'), { recursive: true });
    fs.mkdirSync(path.join(home, '.hermes'), { recursive: true });

    const result = spawnSync(process.execPath, [BOSS_BIN, 'install', '--dry-run', '--json'], {
      cwd: tmpDir,
      env: { ...process.env, HOME: home },
      encoding: 'utf8'
    });

    expect(result.status).toBe(0);
    const payload = JSON.parse(result.stdout) as {
      actions: Array<{ type: string; agent: string; path: string }>;
      risk_tier: string;
      requires_approval: boolean;
    };
    expect(payload.actions.some((action) => action.agent === 'Codex')).toBe(true);
    expect(payload.actions.some((action) => action.agent === 'Hermes')).toBe(true);
    expect(payload.risk_tier).toBe('medium');
    expect(payload.requires_approval).toBe(false);
    expect(fs.existsSync(path.join(home, '.codex', 'skills', 'boss'))).toBe(false);
    expect(fs.existsSync(path.join(home, '.hermes', 'skills', 'boss'))).toBe(false);
  });

  it('install and uninstall json execute quietly with structured payloads', () => {
    const home = path.join(tmpDir, 'home');
    fs.mkdirSync(path.join(home, '.codex'), { recursive: true });
    fs.mkdirSync(path.join(home, '.hermes'), { recursive: true });

    const install = spawnSync(process.execPath, [BOSS_BIN, 'install'], {
      cwd: tmpDir,
      env: { ...process.env, HOME: home },
      encoding: 'utf8'
    });

    expect(install.status).toBe(0);
    expect(install.stdout).not.toContain('Detected');
    const installPayload = JSON.parse(install.stdout) as {
      actions: Array<{ type: string; agent: string; path: string }>;
      risk_tier: string;
      requires_approval: boolean;
      status: string;
    };
    expect(installPayload.status).toBe('installed');
    expect(installPayload.actions.some((action) => action.agent === 'Codex')).toBe(true);
    expect(installPayload.actions.some((action) => action.agent === 'Hermes')).toBe(true);
    expect(installPayload.risk_tier).toBe('medium');
    expect(installPayload.requires_approval).toBe(false);
    expect(fs.existsSync(path.join(home, '.codex', 'skills', 'boss'))).toBe(true);
    expect(fs.existsSync(path.join(home, '.hermes', 'skills', 'boss'))).toBe(true);

    const uninstall = spawnSync(process.execPath, [BOSS_BIN, 'uninstall', '--yes'], {
      cwd: tmpDir,
      env: { ...process.env, HOME: home },
      encoding: 'utf8'
    });

    expect(uninstall.status).toBe(0);
    expect(uninstall.stdout).not.toContain('@blade-ai/boss-skill');
    expect(uninstall.stdout).not.toContain('Uninstall complete');
    const uninstallPayload = JSON.parse(uninstall.stdout) as {
      actions: Array<{ type: string; agent: string; path: string }>;
      risk_tier: string;
      requires_approval: boolean;
      status: string;
    };
    expect(uninstallPayload.status).toBe('uninstalled');
    expect(uninstallPayload.actions.some((action) => action.agent === 'Codex')).toBe(true);
    expect(uninstallPayload.actions.some((action) => action.agent === 'Hermes')).toBe(true);
    expect(uninstallPayload.risk_tier).toBe('high');
    expect(uninstallPayload.requires_approval).toBe(true);
    expect(fs.existsSync(path.join(home, '.codex', 'skills', 'boss'))).toBe(false);
    expect(fs.existsSync(path.join(home, '.hermes', 'skills', 'boss'))).toBe(false);
  });

  it('artifact prepare dry-run returns a structured write plan', () => {
    fs.mkdirSync(path.join(tmpDir, '.boss', 'demo'), { recursive: true });
    const result = runBoss(['artifact', 'prepare', 'demo', 'prd.md', '--dry-run', '--json'], tmpDir);

    expect(result.status).toBe(0);
    const payload = JSON.parse(result.stdout) as {
      actions: Array<{ type: string; path: string; template: string }>;
      risk_tier: string;
    };
    expect(payload.actions).toEqual([
      expect.objectContaining({ type: 'write_artifact', path: '.boss/demo/prd.md' })
    ]);
    expect(payload.risk_tier).toBe('medium');
    expect(fs.existsSync(path.join(tmpDir, '.boss', 'demo', 'prd.md'))).toBe(false);
  });

  it('artifact prepare rejects feature traversal before building target paths', () => {
    const outside = path.resolve(tmpDir, '..', 'sibling');
    fs.rmSync(outside, { recursive: true, force: true, maxRetries: 5, retryDelay: 200 });
    fs.mkdirSync(outside, { recursive: true });

    try {
      const result = runBoss(['artifact', 'prepare', '../../sibling', 'prd.md', '--json'], tmpDir);

      expect(result.status).toBe(1);
      const payload = JSON.parse(result.stderr) as {
        error: { code: string; input: Record<string, unknown> };
      };
      expect(payload.error.code).toBe('invalid_feature');
      expect(payload.error.input).toEqual({ feature: '../../sibling' });
      expect(fs.existsSync(path.join(outside, 'prd.md'))).toBe(false);
    } finally {
      fs.rmSync(outside, { recursive: true, force: true, maxRetries: 5, retryDelay: 200 });
    }
  });

  it('packs detect supports fields and limit', () => {
    const result = runBoss(['packs', 'detect', '.', '--json', '--fields=detected', '--limit=1'], tmpDir);

    expect(result.status).toBe(0);
    expect(JSON.parse(result.stdout)).toEqual({ detected: 'default' });
  });
});
