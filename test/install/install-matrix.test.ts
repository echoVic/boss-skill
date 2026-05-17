import { afterEach, describe, expect, it } from 'vitest';
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { ensureBuilt } from '../helpers/run-cli.js';
import { cleanupTempDir } from '../helpers/fixtures.js';

const REPO_ROOT = path.resolve(import.meta.dirname, '..', '..');
const BOSS_BIN = path.join(REPO_ROOT, 'packages', 'boss-cli', 'dist', 'bin', 'boss.js');

const COPY_TARGETS = [
  { agent: 'Codex', marker: ['.codex'], installPath: ['.codex', 'skills', 'boss'], metadata: 'codex:' },
  { agent: 'Hermes', marker: ['.hermes'], installPath: ['.hermes', 'skills', 'boss'], metadata: 'hermes:' },
  { agent: 'OpenClaw', marker: ['.openclaw'], installPath: ['.openclaw', 'skills', 'boss'], metadata: 'openclaw:' },
  {
    agent: 'Antigravity',
    marker: ['.gemini', 'antigravity'],
    installPath: ['.gemini', 'antigravity', 'skills', 'boss'],
    metadata: 'antigravity:'
  }
] as const;

const REPRESENTATIVE_BUNDLE_FILES = [
  'SKILL.md',
  'agents/boss-pm.md',
  'agents/boss-qa.md',
  'commands/boss.md',
  'hooks/claude/hooks.json',
  'hooks/codex/hooks.json',
  'templates/prd.md.template',
  'skills/README.md',
  'skills/brainstorming/SKILL.md',
  'skills/pm/requirement-penetration/SKILL.md',
  'skills/architect/architecture-design/SKILL.md',
  'skills/backend/testing-guide/SKILL.md',
  'skills/frontend/testing-guide/SKILL.md',
  'skills/qa/test-strategy/SKILL.md',
  'skills/shared/tech-stack-detection/SKILL.md'
] as const;

const REQUIRED_PACKED_FILES = [
  'package.json',
  'packages/boss-cli/dist/bin/boss.js',
  'packages/boss-cli/assets/artifact-dag.json',
  'packages/boss-cli/src/runtime/schema/execution-schema.json',
  'skill/SKILL.md',
  'skill/skills/README.md',
  'skill/skills/pm/requirement-penetration/SKILL.md',
  'skill/skills/qa/test-strategy/SKILL.md',
  'skill/hooks/claude/hooks.json',
  'skill/hooks/codex/hooks.json',
  '.claude-plugin/plugin.json',
  '.claude-plugin/marketplace.json',
  '.codex-plugin/plugin.json',
  '.codex-plugin/marketplace.json',
  'scripts/hooks/lib/normalize-input.js',
  'scripts/hooks/subagent-stop.js'
] as const;

describe('Boss install matrix', () => {
  const tmpDirs: string[] = [];

  afterEach(() => {
    for (const tmpDir of tmpDirs.splice(0)) {
      cleanupTempDir(tmpDir);
    }
  });

  function makeHome(): string {
    const home = fs.mkdtempSync(path.join(os.tmpdir(), 'boss-install-matrix-'));
    tmpDirs.push(home);
    return home;
  }

  it.each(COPY_TARGETS)('copy-installs the full skill bundle for $agent', (target) => {
    ensureBuilt('packages/boss-cli/dist/bin/boss.js');
    const home = makeHome();
    fs.mkdirSync(path.join(home, ...target.marker), { recursive: true });

    const result = spawnSync(process.execPath, [BOSS_BIN, 'install', '--json'], {
      cwd: REPO_ROOT,
      env: { ...process.env, HOME: home },
      encoding: 'utf8'
    });

    expect(result.status, result.stderr).toBe(0);
    const payload = JSON.parse(result.stdout) as { actions: Array<{ agent: string; type: string }> };
    expect(payload.actions).toContainEqual(expect.objectContaining({ agent: target.agent, type: 'install_skill' }));

    const installed = path.join(home, ...target.installPath);
    for (const relativePath of REPRESENTATIVE_BUNDLE_FILES) {
      expect(fs.existsSync(path.join(installed, relativePath)), `${target.agent} missing ${relativePath}`).toBe(true);
    }

    const skill = fs.readFileSync(path.join(installed, 'SKILL.md'), 'utf8');
    expect(skill).toContain(target.metadata);
    expect(fs.existsSync(path.join(installed, 'package.json'))).toBe(false);
    expect(fs.existsSync(path.join(installed, 'packages'))).toBe(false);
    expect(fs.existsSync(path.join(installed, '.claude-plugin'))).toBe(false);
  });

  it('merges Codex hooks into ~/.codex/hooks.json without overwriting user hooks', () => {
    ensureBuilt('packages/boss-cli/dist/bin/boss.js');
    const home = makeHome();
    const codexHome = path.join(home, '.codex');
    fs.mkdirSync(codexHome, { recursive: true });
    const existingHooks = {
      hooks: {
        PreToolUse: [
          {
            matcher: 'Bash',
            hooks: [
              {
                type: 'command',
                command: 'echo keep-user-hook'
              }
            ],
            description: 'user hook',
            id: 'user:pre:bash'
          }
        ]
      }
    };
    fs.writeFileSync(path.join(codexHome, 'hooks.json'), JSON.stringify(existingHooks, null, 2) + '\n', 'utf8');

    const result = spawnSync(process.execPath, [BOSS_BIN, 'install', '--json'], {
      cwd: REPO_ROOT,
      env: { ...process.env, HOME: home },
      encoding: 'utf8'
    });

    expect(result.status, result.stderr).toBe(0);

    const hooksJson = JSON.parse(fs.readFileSync(path.join(codexHome, 'hooks.json'), 'utf8')) as {
      hooks: Record<string, Array<{ id: string }>>;
    };
    expect(hooksJson.hooks.PreToolUse?.some((entry) => entry.id === 'user:pre:bash')).toBe(true);
    expect(hooksJson.hooks.SessionStart?.some((entry) => entry.id === 'session:start')).toBe(true);
    expect(hooksJson.hooks.PreToolUse?.some((entry) => entry.id === 'pre:write:artifact-guard')).toBe(true);
    const state = JSON.parse(fs.readFileSync(path.join(codexHome, '.boss-hooks-state.json'), 'utf8')) as {
      manifestChecksum?: string;
      hookIds: string[];
    };
    expect(state.manifestChecksum).toMatch(/^sha256:/);
    expect(state.hookIds).toContain('pre:write:artifact-guard');
  });

  it('warns when user hooks without ids use Codex write matcher aliases', async () => {
    ensureBuilt('packages/boss-cli/dist/bin/boss.js');
    const home = makeHome();
    const codexHome = path.join(home, '.codex');
    fs.mkdirSync(codexHome, { recursive: true });
    fs.writeFileSync(
      path.join(codexHome, 'hooks.json'),
      JSON.stringify(
        {
          hooks: {
            PreToolUse: [
              {
                matcher: 'Edit',
                hooks: [{ type: 'command', command: 'echo user-edit-hook' }]
              }
            ]
          }
        },
        null,
        2
      ) + '\n',
      'utf8'
    );
    const result = spawnSync(process.execPath, [BOSS_BIN, 'install', '--human'], {
      cwd: REPO_ROOT,
      env: { ...process.env, HOME: home },
      encoding: 'utf8'
    });

    expect(result.status, result.stderr).toBe(0);
    expect(result.stdout).toContain('PreToolUse/apply_patch');
  });

  it('dry-run shows both Codex skill copy and hooks merge actions', () => {
    ensureBuilt('packages/boss-cli/dist/bin/boss.js');
    const home = makeHome();
    fs.mkdirSync(path.join(home, '.codex'), { recursive: true });

    const result = spawnSync(process.execPath, [BOSS_BIN, 'install', '--dry-run', '--human'], {
      cwd: REPO_ROOT,
      env: { ...process.env, HOME: home },
      encoding: 'utf8'
    });

    expect(result.status, result.stderr).toBe(0);
    expect(result.stdout).toContain(`[dry-run] Codex: would install to ${path.join(home, '.codex', 'skills', 'boss')}`);
    expect(result.stdout).toContain(`[dry-run] Codex: would merge hooks into ${path.join(home, '.codex', 'hooks.json')}`);
  });

  it('uninstall removes stale Boss-managed Codex hook ids from older installs', () => {
    ensureBuilt('packages/boss-cli/dist/bin/boss.js');
    const home = makeHome();
    const codexHome = path.join(home, '.codex');
    const installed = path.join(codexHome, 'skills', 'boss');
    fs.mkdirSync(installed, { recursive: true });
    fs.writeFileSync(path.join(installed, 'SKILL.md'), 'installed\n', 'utf8');
    fs.writeFileSync(
      path.join(codexHome, 'hooks.json'),
      JSON.stringify(
        {
          hooks: {
            PreToolUse: [
              { matcher: 'Bash', hooks: [], id: 'pre:bash:dangerous-cmd-guard' },
              { matcher: 'Bash', hooks: [], id: 'pre:my-custom-thing' },
              { matcher: 'Bash', hooks: [], id: 'user:pre:bash' }
            ]
          }
        },
        null,
        2
      ) + '\n',
      'utf8'
    );
    fs.writeFileSync(
      path.join(codexHome, '.boss-hooks-state.json'),
      JSON.stringify(
        { version: '3.8.9', installMode: 'hooks-json', hookIds: ['pre:bash:dangerous-cmd-guard'] },
        null,
        2
      ) + '\n',
      'utf8'
    );

    const uninstall = spawnSync(process.execPath, [BOSS_BIN, 'uninstall', '--yes', '--json'], {
      cwd: REPO_ROOT,
      env: { ...process.env, HOME: home },
      encoding: 'utf8'
    });
    expect(uninstall.status, uninstall.stderr).toBe(0);

    const hooksJson = JSON.parse(fs.readFileSync(path.join(codexHome, 'hooks.json'), 'utf8')) as {
      hooks: Record<string, Array<{ id: string }>>;
    };
    expect(hooksJson.hooks.PreToolUse?.some((entry) => entry.id === 'pre:bash:dangerous-cmd-guard') ?? false).toBe(false);
    expect(hooksJson.hooks.PreToolUse?.some((entry) => entry.id === 'pre:my-custom-thing')).toBe(true);
    expect(hooksJson.hooks.PreToolUse?.some((entry) => entry.id === 'user:pre:bash')).toBe(true);
  });

  it('legacy Boss hook id cleanup list covers current Claude and Codex manifests', async () => {
    const { LEGACY_BOSS_HOOK_IDS } = await import('../../packages/boss-cli/src/commands/install/index.js');
    const legacyIds = new Set(LEGACY_BOSS_HOOK_IDS);

    for (const manifestPath of [
      path.join(REPO_ROOT, 'skill', 'hooks', 'claude', 'hooks.json'),
      path.join(REPO_ROOT, 'skill', 'hooks', 'codex', 'hooks.json')
    ]) {
      const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8')) as {
        hooks: Record<string, Array<{ id?: string }>>;
      };
      const currentIds = Object.values(manifest.hooks).flatMap((entries) => entries.map((entry) => entry.id));

      for (const id of currentIds) {
        expect(legacyIds.has(id!)).toBe(true);
      }
    }
  });

  it('uninstall removes only Boss-managed Codex hook entries', () => {
    ensureBuilt('packages/boss-cli/dist/bin/boss.js');
    const home = makeHome();
    const codexHome = path.join(home, '.codex');
    fs.mkdirSync(codexHome, { recursive: true });
    const existingHooks = {
      hooks: {
        PreToolUse: [
          {
            matcher: 'Bash',
            hooks: [
              {
                type: 'command',
                command: 'echo keep-user-hook'
              }
            ],
            description: 'user hook',
            id: 'user:pre:bash'
          }
        ]
      }
    };
    fs.writeFileSync(path.join(codexHome, 'hooks.json'), JSON.stringify(existingHooks, null, 2) + '\n', 'utf8');

    const install = spawnSync(process.execPath, [BOSS_BIN, 'install', '--json'], {
      cwd: REPO_ROOT,
      env: { ...process.env, HOME: home },
      encoding: 'utf8'
    });
    expect(install.status, install.stderr).toBe(0);

    const uninstall = spawnSync(process.execPath, [BOSS_BIN, 'uninstall', '--yes', '--json'], {
      cwd: REPO_ROOT,
      env: { ...process.env, HOME: home },
      encoding: 'utf8'
    });
    expect(uninstall.status, uninstall.stderr).toBe(0);

    const hooksJson = JSON.parse(fs.readFileSync(path.join(codexHome, 'hooks.json'), 'utf8')) as {
      hooks: Record<string, Array<{ id: string }>>;
    };
    expect(hooksJson.hooks.PreToolUse?.some((entry) => entry.id === 'user:pre:bash')).toBe(true);
    expect(hooksJson.hooks.SessionStart?.some((entry) => entry.id === 'session:start') ?? false).toBe(false);
    expect(hooksJson.hooks.PreToolUse?.some((entry) => entry.id === 'pre:write:artifact-guard') ?? false).toBe(false);
    expect(fs.existsSync(path.join(codexHome, '.boss-hooks-state.json'))).toBe(false);
  });

  it('Claude plugin declares the main skill and methodology skill roots', () => {
    const plugin = JSON.parse(
      fs.readFileSync(path.join(REPO_ROOT, '.claude-plugin', 'plugin.json'), 'utf8')
    ) as { skills: string[] };

    expect(plugin.skills).toContain('./skill/');
    expect(plugin.skills).toContain('./skill/skills/');
  });

  it('Codex plugin declares the Codex-specific hook manifest', () => {
    const plugin = JSON.parse(
      fs.readFileSync(path.join(REPO_ROOT, '.codex-plugin', 'plugin.json'), 'utf8')
    ) as { hooks?: string; skills: string[] };

    expect(plugin.skills).toContain('./skill/');
    expect(plugin.skills).toContain('./skill/skills/');
    expect(plugin.hooks).toBe('./skill/hooks/codex/hooks.json');
  });

  it('npm dry-run pack includes release-critical runtime, skill, and plugin files', () => {
    ensureBuilt('packages/boss-cli/dist/bin/boss.js');

    const result = spawnSync('npm', ['pack', '--json', '--dry-run'], {
      cwd: REPO_ROOT,
      encoding: 'utf8'
    });

    expect(result.status, result.stderr).toBe(0);
    const payload = JSON.parse(result.stdout) as Array<{ files: Array<{ path: string }> }>;
    const packedFiles = new Set(payload[0]?.files.map((file) => file.path) ?? []);

    for (const file of REQUIRED_PACKED_FILES) {
      expect(packedFiles.has(file), `npm package missing ${file}`).toBe(true);
    }
    expect(packedFiles.has('skill/hooks/hooks.json'), 'npm package should not include legacy hook manifest').toBe(false);
  });
});
