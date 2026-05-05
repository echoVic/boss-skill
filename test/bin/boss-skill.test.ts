import { describe, expect, it, vi } from 'vitest';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import { resolve } from 'node:path';
import { runCli } from '../helpers/run-cli.js';

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
    expect(pkg.files).toContain('skill/');
    expect(pkg.files).not.toContain('agents/');
    expect(pkg.files).not.toContain('commands/');
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

  it('exposes thin skill helper commands through the boss dispatcher', () => {
    for (const command of ['project', 'artifact', 'packs', 'hooks']) {
      const result = runCli(['packages/boss-cli/dist/bin/boss.js', command, '--help']);

      expect(result.status).toBe(0);
      expect(result.stdout + result.stderr).toContain(`boss ${command}`);
    }
  });

  it('builds the dist entrypoint used by both bins', () => {
    expect(existsSync(distEntry)).toBe(true);
  });

  it('copy-installs only the thin skill bundle for Codex', () => {
    const home = mkdtempSync(resolve(tmpdir(), 'boss-skill-install-'));
    mkdirSync(resolve(home, '.codex'), { recursive: true });

    try {
      const result = spawnSync(process.execPath, [distEntry, 'install'], {
        cwd: root,
        env: { ...process.env, HOME: home },
        encoding: 'utf8'
      });

      expect(result.status, result.stderr).toBe(0);

      const installed = resolve(home, '.codex', 'skills', 'boss');
      expect(existsSync(resolve(installed, 'SKILL.md'))).toBe(true);
      expect(existsSync(resolve(installed, 'agents', 'boss-pm.md'))).toBe(true);
      expect(existsSync(resolve(installed, 'commands', 'boss.md'))).toBe(true);
      expect(existsSync(resolve(installed, 'templates', 'prd.md.template'))).toBe(true);
      expect(existsSync(resolve(installed, 'hooks', 'hooks.json'))).toBe(true);
      expect(existsSync(resolve(installed, 'skills', 'brainstorming', 'SKILL.md'))).toBe(true);

      expect(existsSync(resolve(installed, 'package.json'))).toBe(false);
      expect(existsSync(resolve(installed, 'packages'))).toBe(false);
      expect(existsSync(resolve(installed, 'scripts'))).toBe(false);
      expect(existsSync(resolve(installed, 'test'))).toBe(false);
      expect(existsSync(resolve(installed, '.claude-plugin'))).toBe(false);
    } finally {
      rmSync(home, { recursive: true, force: true });
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
