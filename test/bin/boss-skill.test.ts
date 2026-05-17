import { describe, expect, it, vi } from 'vitest';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { resolve } from 'node:path';
import { runCli } from '../helpers/run-cli.js';
import { validateUiDesignArtifact } from '../../packages/boss-cli/src/runtime/design/schema.js';
import { cleanupTempDir } from '../helpers/fixtures.js';

const root = resolve(import.meta.dirname, '..', '..');
const pkg = JSON.parse(readFileSync(resolve(root, 'package.json'), 'utf8'));
const distEntry = resolve(root, 'packages/boss-cli/dist/bin/boss.js');

describe('boss-skill dist bin', () => {
  it('uses the workspace boss CLI as the published entrypoint', () => {
    expect(pkg.type).toBe('module');
    expect(pkg.workspaces).toEqual(['packages/*']);
    expect(pkg.bin.boss).toBe('packages/boss-cli/dist/bin/boss.js');
    expect(pkg.bin['boss-skill']).toBe('packages/boss-cli/dist/bin/boss.js');
    expect(pkg.engines.node).toBe('>=20');
    expect(pkg.files).toContain('packages/boss-cli/dist/');
    expect(pkg.files).toContain('packages/boss-cli/assets/');
    expect(pkg.files).toContain('skill/');
    expect(pkg.files).not.toContain('agents/');
    expect(pkg.files).not.toContain('commands/');
    expect(pkg.files).not.toContain('harness/');
    expect(pkg.files).not.toContain('hooks/');
    expect(pkg.files).not.toContain('templates/');
    expect(pkg.files).not.toContain('SKILL.md');
  });

  it('prints help from the built dist entrypoint', () => {
    const result = runCli(['packages/boss-cli/dist/bin/boss.js', '--help']);
    expect(result.status).toBe(0);
    expect(result.stdout).toContain('Usage:');
    expect(result.stdout).toContain('boss-skill install');
  });

  it('exposes runtime help through the boss dispatcher', () => {
    const result = runCli(['packages/boss-cli/dist/bin/boss.js', 'runtime', '--help']);

    expect(result.status).toBe(0);
    expect(result.stdout + result.stderr).toContain('boss runtime');
  });

  it('exposes design help through the boss dispatcher', () => {
    const result = runCli(['packages/boss-cli/dist/bin/boss.js', 'design', '--help']);

    expect(result.status).toBe(0);
    expect(result.stdout + result.stderr).toContain('boss design');
    expect(result.stdout + result.stderr).toContain('preview');
  });

  it('exposes thin skill helper commands through the boss dispatcher', () => {
    for (const command of ['project', 'artifact', 'packs', 'hooks', 'qa']) {
      const result = runCli(['packages/boss-cli/dist/bin/boss.js', command, '--help']);

      expect(result.status).toBe(0);
      expect(result.stdout + result.stderr).toContain(`boss ${command}`);
    }
  });

  it('forwards help to runtime concrete commands', () => {
    const result = runCli(['packages/boss-cli/dist/bin/boss.js', 'runtime', 'init-pipeline', '--help']);

    expect(result.status).toBe(0);
    expect(result.stdout + result.stderr).toContain('Usage: boss runtime init-pipeline FEATURE [options]');
    expect(result.stdout + result.stderr).not.toContain('Usage: boss runtime COMMAND');
  });

  it('forwards help to thin helper concrete commands', () => {
    const result = runCli(['packages/boss-cli/dist/bin/boss.js', 'project', 'init', '--help']);

    expect(result.status).toBe(0);
    expect(result.stdout + result.stderr).toContain('用法: boss project init <feature-name> [options]');
    expect(result.stdout + result.stderr).not.toContain('Usage: boss project init <feature-name> [--template] [--force]');
  });

  it('dist project init writes a valid ui-design.json stub', () => {
    const workspace = mkdtempSync(resolve(tmpdir(), 'boss-project-init-'));

    try {
      const result = runCli(['packages/boss-cli/dist/bin/boss.js', 'project', 'init', 'valid-ui-design', '--json'], {
        cwd: workspace
      });
      expect(result.status, result.stderr).toBe(0);

      const uiDesign = JSON.parse(readFileSync(resolve(workspace, '.boss', 'valid-ui-design', 'ui-design.json'), 'utf8'));
      const validation = validateUiDesignArtifact(uiDesign);
      expect(validation).toEqual({ ok: true, errors: [] });
    } finally {
      cleanupTempDir(workspace);
    }
  });

  it('exposes global agent contract flags in command help', () => {
    const help = runCli(['packages/boss-cli/dist/bin/boss.js', '--help']);
    expect(help.status).toBe(0);
    expect(help.stdout).toContain('--json');
    expect(help.stdout).toContain('--describe');
    expect(help.stdout).toContain('--json-input');

    for (const command of ['project', 'artifact', 'packs', 'hooks', 'runtime']) {
      const result = runCli(['packages/boss-cli/dist/bin/boss.js', command, '--help']);
      expect(result.status).toBe(0);
      expect(result.stdout + result.stderr).toContain('--json');
      expect(result.stdout + result.stderr).toContain('--describe');
      expect(result.stdout + result.stderr).toContain('--json-input');
    }
  });

  it('returns structured root command metadata with --describe', () => {
    const result = runCli(['packages/boss-cli/dist/bin/boss.js', '--describe']);
    expect(result.status).toBe(0);
    const payload = JSON.parse(result.stdout) as {
      command: string;
      commands: string[];
      options: Array<{ name: string }>;
    };
    expect(payload.command).toBe('boss');
    expect(payload.commands).toContain('project init');
    expect(payload.commands).toContain('runtime COMMAND');
    expect(payload.commands).toContain('qa attack');
    expect(payload.options.map((option) => option.name)).toContain('json');
  });

  it('returns structured install metadata with --describe without running install', () => {
    const result = runCli(['packages/boss-cli/dist/bin/boss.js', 'install', '--describe']);
    expect(result.status).toBe(0);
    expect(result.stdout).not.toContain('Detected');
    const payload = JSON.parse(result.stdout) as {
      command: string;
    };
    expect(payload.command).toBe('boss install');
  });

  it('prints raw path by default and structured path with --json', () => {
    const plain = runCli(['packages/boss-cli/dist/bin/boss.js', 'path']);
    expect(plain.status).toBe(0);
    expect(plain.stdout).toBe(`${root}\n`);
    expect(() => JSON.parse(plain.stdout)).toThrow();

    const json = runCli(['packages/boss-cli/dist/bin/boss.js', 'path', '--json']);
    expect(json.status).toBe(0);
    expect(JSON.parse(json.stdout)).toEqual({ path: root });
  });

  it('returns structured project group metadata with --describe', () => {
    const result = runCli(['packages/boss-cli/dist/bin/boss.js', 'project', '--describe']);
    expect(result.status).toBe(0);
    const payload = JSON.parse(result.stdout) as {
      command: string;
      commands: string[];
    };
    expect(payload.command).toBe('boss project');
    expect(payload.commands).toContain('init');
  });

  it('returns structured runtime group metadata with --describe', () => {
    const result = runCli(['packages/boss-cli/dist/bin/boss.js', 'runtime', '--describe']);
    expect(result.status).toBe(0);
    const payload = JSON.parse(result.stdout) as {
      command: string;
      commands?: string[];
      runtime_commands?: string[];
    };
    expect(payload.command).toBe('boss runtime');
    expect(payload.commands ?? payload.runtime_commands).toContain('init-pipeline');
  });

  it('returns structured errors for unknown root commands in non-tty mode', () => {
    const result = runCli(['packages/boss-cli/dist/bin/boss.js', 'unknown-command']);
    expect(result.status).toBe(1);
    const payload = JSON.parse(result.stderr) as { error: { code: string; input: Record<string, unknown> } };
    expect(payload.error.code).toBe('unknown_command');
    expect(payload.error.input).toEqual({ command: 'unknown-command' });
  });

  it('builds the dist entrypoint used by both bins', () => {
    expect(existsSync(distEntry)).toBe(true);
  });

  it('copy-installs only the thin skill bundle for Codex', () => {
    const home = mkdtempSync(resolve(tmpdir(), 'boss-skill-install-'));
    mkdirSync(resolve(home, '.codex'), { recursive: true });
    mkdirSync(resolve(home, '.hermes'), { recursive: true });

    try {
      const result = runCli(['packages/boss-cli/dist/bin/boss.js', 'install'], {
        cwd: root,
        env: { ...process.env, HOME: home },
      });

      expect(result.status, result.stderr).toBe(0);

      const installed = resolve(home, '.codex', 'skills', 'boss');
      expect(existsSync(resolve(installed, 'SKILL.md'))).toBe(true);
      expect(existsSync(resolve(installed, 'agents', 'boss-pm.md'))).toBe(true);
      expect(existsSync(resolve(installed, 'commands', 'boss.md'))).toBe(true);
      expect(existsSync(resolve(installed, 'templates', 'prd.md.template'))).toBe(true);
      expect(existsSync(resolve(installed, 'hooks', 'claude', 'hooks.json'))).toBe(true);
      expect(existsSync(resolve(installed, 'hooks', 'codex', 'hooks.json'))).toBe(true);
      expect(existsSync(resolve(installed, 'skills', 'brainstorming', 'SKILL.md'))).toBe(true);
      expect(existsSync(resolve(installed, 'skills', 'pm', 'requirement-penetration', 'SKILL.md'))).toBe(true);
      expect(existsSync(resolve(installed, 'skills', 'qa', 'test-strategy', 'SKILL.md'))).toBe(true);
      expect(existsSync(resolve(installed, 'skills', 'shared', 'tech-stack-detection', 'SKILL.md'))).toBe(true);
      expect(existsSync(resolve(installed, 'skills', 'README.md'))).toBe(true);

      expect(existsSync(resolve(installed, 'package.json'))).toBe(false);
      expect(existsSync(resolve(installed, 'packages'))).toBe(false);
      expect(existsSync(resolve(installed, 'scripts'))).toBe(false);
      expect(existsSync(resolve(installed, 'test'))).toBe(false);
      expect(existsSync(resolve(installed, '.claude-plugin'))).toBe(false);

      const hermesInstalled = resolve(home, '.hermes', 'skills', 'boss');
      expect(existsSync(resolve(hermesInstalled, 'SKILL.md'))).toBe(true);
      expect(readFileSync(resolve(hermesInstalled, 'SKILL.md'), 'utf8')).toContain('hermes:');
    } finally {
      cleanupTempDir(home);
    }
  });

  it('does not run main() when the source module is imported', async () => {
    const writeSpy = vi
      .spyOn(process.stdout, 'write')
      .mockImplementation(() => true);

    vi.resetModules();
    const mod = await import('../../packages/boss-cli/src/bin/boss.js');

    expect(writeSpy).not.toHaveBeenCalled();
    expect(typeof mod.main).toBe('function');
    expect(typeof mod.showHelp).toBe('function');

    vi.restoreAllMocks();
  });
});
