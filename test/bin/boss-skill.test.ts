import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, mkdtempSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { resolve } from 'node:path';
import { describe, expect, it, vi } from 'vitest';
import { validateUiDesignArtifact } from '../../skill/cli/runtime/design/schema.mts';
import { cleanupTempDir } from '../helpers/fixtures.js';
import { runCli } from '../helpers/run-cli.js';

const root = resolve(import.meta.dirname, '..', '..');
const pkg = JSON.parse(readFileSync(resolve(root, 'package.json'), 'utf8'));
const distEntry = resolve(root, 'skill/cli/bin/boss.mts');

describe('boss-skill dist bin', () => {
  it('ships the CLI as direct source instead of a published package', () => {
    expect(pkg.type).toBe('module');
    // npm 不再是分发通道：仓库私有，不由 npm 提供 bin。
    expect(pkg.private).toBe(true);
    expect(pkg.bin).toBeUndefined();
    expect(pkg.files).toBeUndefined();
    expect(pkg.engines.node).toBe('>=22.18');
  });

  it('prints help from the built dist entrypoint', () => {
    const result = runCli(['skill/cli/bin/boss.mts', '--help']);
    expect(result.status).toBe(0);
    expect(result.stdout).toContain('Usage:');
    expect(result.stdout).toContain('boss-skill install');
  });

  it('exposes runtime help through the boss dispatcher', () => {
    const result = runCli(['skill/cli/bin/boss.mts', 'runtime', '--help']);

    expect(result.status).toBe(0);
    expect(result.stdout + result.stderr).toContain('boss runtime');
  });

  it('shows the new conversation runtime commands in built help', () => {
    const result = spawnSync(process.execPath, [distEntry, 'runtime', '--help'], {
      cwd: root,
      encoding: 'utf8',
    });
    expect(result.status).toBe(0);
    expect(result.stdout).toContain('open-conversation');
    expect(result.stdout).toContain('resolve-conversation');
    expect(result.stdout).toContain('list-todos');
  });

  it('exposes design help through the boss dispatcher', () => {
    const result = runCli(['skill/cli/bin/boss.mts', 'design', '--help']);

    expect(result.status).toBe(0);
    expect(result.stdout + result.stderr).toContain('boss design');
    expect(result.stdout + result.stderr).toContain('preview');
  });

  it('exposes thin skill helper commands through the boss dispatcher', () => {
    for (const command of ['project', 'artifact', 'packs', 'hooks', 'qa']) {
      const result = runCli(['skill/cli/bin/boss.mts', command, '--help']);

      expect(result.status).toBe(0);
      expect(result.stdout + result.stderr).toContain(`boss ${command}`);
    }
  });

  it('forwards help to runtime concrete commands', () => {
    const result = runCli(['skill/cli/bin/boss.mts', 'runtime', 'init-pipeline', '--help']);

    expect(result.status).toBe(0);
    expect(result.stdout + result.stderr).toContain(
      'Usage: boss runtime init-pipeline FEATURE [options]',
    );
    expect(result.stdout + result.stderr).not.toContain('Usage: boss runtime COMMAND');
  });

  it('forwards help to thin helper concrete commands', () => {
    const result = runCli(['skill/cli/bin/boss.mts', 'project', 'init', '--help']);

    expect(result.status).toBe(0);
    expect(result.stdout + result.stderr).toContain(
      '用法: boss project init <feature-name> [options]',
    );
    expect(result.stdout + result.stderr).not.toContain(
      'Usage: boss project init <feature-name> [--template] [--force]',
    );
  });

  it('dist project init writes a valid ui-design.json stub', () => {
    const workspace = mkdtempSync(resolve(tmpdir(), 'boss-project-init-'));

    try {
      const result = runCli(
        ['skill/cli/bin/boss.mts', 'project', 'init', 'valid-ui-design', '--json'],
        {
          cwd: workspace,
        },
      );
      expect(result.status, result.stderr).toBe(0);

      const uiDesign = JSON.parse(
        readFileSync(resolve(workspace, '.boss', 'valid-ui-design', 'ui-design.json'), 'utf8'),
      );
      const validation = validateUiDesignArtifact(uiDesign);
      expect(validation).toEqual({ ok: true, errors: [] });
    } finally {
      cleanupTempDir(workspace);
    }
  });

  it('exposes global agent contract flags in command help', () => {
    const help = runCli(['skill/cli/bin/boss.mts', '--help']);
    expect(help.status).toBe(0);
    expect(help.stdout).toContain('--json');
    expect(help.stdout).toContain('--describe');
    expect(help.stdout).toContain('--json-input');

    for (const command of ['project', 'artifact', 'packs', 'hooks', 'runtime']) {
      const result = runCli(['skill/cli/bin/boss.mts', command, '--help']);
      expect(result.status).toBe(0);
      expect(result.stdout + result.stderr).toContain('--json');
      expect(result.stdout + result.stderr).toContain('--describe');
      expect(result.stdout + result.stderr).toContain('--json-input');
    }
  });

  it('returns structured root command metadata with --describe', () => {
    const result = runCli(['skill/cli/bin/boss.mts', '--describe']);
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
    const result = runCli(['skill/cli/bin/boss.mts', 'install', '--describe']);
    expect(result.status).toBe(0);
    expect(result.stdout).not.toContain('Detected');
    const payload = JSON.parse(result.stdout) as {
      command: string;
    };
    expect(payload.command).toBe('boss install');
  });

  it('prints the skill root by default and structured path with --json', () => {
    const skillRoot = resolve(root, 'skill');
    const plain = runCli(['skill/cli/bin/boss.mts', 'path']);
    expect(plain.status).toBe(0);
    expect(plain.stdout).toBe(`${skillRoot}\n`);
    expect(() => JSON.parse(plain.stdout)).toThrow();

    const json = runCli(['skill/cli/bin/boss.mts', 'path', '--json']);
    expect(json.status).toBe(0);
    expect(JSON.parse(json.stdout)).toEqual({ path: skillRoot });
  });

  it('returns structured project group metadata with --describe', () => {
    const result = runCli(['skill/cli/bin/boss.mts', 'project', '--describe']);
    expect(result.status).toBe(0);
    const payload = JSON.parse(result.stdout) as {
      command: string;
      commands: string[];
    };
    expect(payload.command).toBe('boss project');
    expect(payload.commands).toContain('init');
  });

  it('returns structured runtime group metadata with --describe', () => {
    const result = runCli(['skill/cli/bin/boss.mts', 'runtime', '--describe']);
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
    const result = runCli(['skill/cli/bin/boss.mts', 'unknown-command']);
    expect(result.status).toBe(1);
    const payload = JSON.parse(result.stderr) as {
      error: { code: string; input: Record<string, unknown> };
    };
    expect(payload.error.code).toBe('unknown_command');
    expect(payload.error.input).toEqual({ command: 'unknown-command' });
  });

  it('ships the CLI source entrypoint (no build step)', () => {
    expect(existsSync(distEntry)).toBe(true);
  });

  it('copy-installs the self-contained skill bundle for Codex', () => {
    const home = mkdtempSync(resolve(tmpdir(), 'boss-skill-install-'));
    mkdirSync(resolve(home, '.codex'), { recursive: true });
    mkdirSync(resolve(home, '.hermes'), { recursive: true });

    try {
      const result = runCli(['skill/cli/bin/boss.mts', 'install'], {
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
      expect(
        existsSync(resolve(installed, 'skills', 'pm', 'requirement-penetration', 'SKILL.md')),
      ).toBe(true);
      expect(existsSync(resolve(installed, 'skills', 'qa', 'test-strategy', 'SKILL.md'))).toBe(
        true,
      );
      expect(
        existsSync(resolve(installed, 'skills', 'shared', 'tech-stack-detection', 'SKILL.md')),
      ).toBe(true);
      expect(existsSync(resolve(installed, 'skills', 'README.md'))).toBe(true);

      // skill 自包含：CLI、hooks 运行时、运行时资产都随安装副本分发。
      expect(existsSync(resolve(installed, 'cli', 'bin', 'boss.mts'))).toBe(true);
      expect(existsSync(resolve(installed, 'scripts', 'lib', 'run-with-flags.js'))).toBe(true);
      expect(existsSync(resolve(installed, 'scripts', 'hooks', 'session-start.js'))).toBe(true);
      expect(existsSync(resolve(installed, 'assets', 'artifact-dag.json'))).toBe(true);

      expect(existsSync(resolve(installed, 'package.json'))).toBe(false);
      expect(existsSync(resolve(installed, 'packages'))).toBe(false);
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
    const writeSpy = vi.spyOn(process.stdout, 'write').mockImplementation(() => true);

    vi.resetModules();
    const mod = await import('../../skill/cli/bin/boss.mts');

    expect(writeSpy).not.toHaveBeenCalled();
    expect(typeof mod.main).toBe('function');
    expect(typeof mod.showHelp).toBe('function');

    vi.restoreAllMocks();
  });
});
