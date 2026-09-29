import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { cleanupTempDir } from '../helpers/fixtures.js';
import { ensureCli } from '../helpers/run-cli.js';

const REPO_ROOT = path.resolve(import.meta.dirname, '..', '..');
const BOSS_BIN = path.join(REPO_ROOT, 'skill', 'cli', 'bin', 'boss.mts');

const COPY_TARGETS = [
  {
    agent: 'Codex',
    marker: ['.codex'],
    installPath: ['.codex', 'skills', 'boss'],
    metadata: 'codex:',
  },
  {
    agent: 'Hermes',
    marker: ['.hermes'],
    installPath: ['.hermes', 'skills', 'boss'],
    metadata: 'hermes:',
  },
  {
    agent: 'OpenClaw',
    marker: ['.openclaw'],
    installPath: ['.openclaw', 'skills', 'boss'],
    metadata: 'openclaw:',
  },
  {
    agent: 'Antigravity',
    marker: ['.gemini', 'antigravity'],
    installPath: ['.gemini', 'antigravity', 'skills', 'boss'],
    metadata: 'antigravity:',
  },
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
  'skills/shared/tech-stack-detection/SKILL.md',
  'assets/artifact-dag.json',
  'assets/plugin-schema.json',
  'scripts/hooks/session-start.js',
  'scripts/lib/run-with-flags.js',
  'cli/bin/boss.mts',
] as const;

const REQUIRED_SKILL_BUNDLE_FILES = [
  'SKILL.md',
  'cli/bin/boss.mts',
  'assets/artifact-dag.json',
  'assets/plugin-schema.json',
  'scripts/hooks/session-start.js',
  'scripts/lib/run-with-flags.js',
  'hooks/claude/hooks.json',
  'hooks/codex/hooks.json',
  'agents/boss-pm.md',
  'commands/boss.md',
  'templates/prd.md.template',
  'skills/qa/test-strategy/SKILL.md',
] as const;

const REQUIRED_REPO_FILES = [
  '.claude-plugin/plugin.json',
  '.claude-plugin/marketplace.json',
  '.codex-plugin/plugin.json',
  '.codex-plugin/marketplace.json',
  '.agents/plugins/marketplace.json',
  '.agents/plugins/provenance.json',
  'assets/boss-composer-icon.svg',
  'assets/boss-logo.svg',
  'skill/cli/bin/boss.mts',
  'scripts/provenance.js',
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
    ensureCli('skill/cli/bin/boss.mts');
    const home = makeHome();
    fs.mkdirSync(path.join(home, ...target.marker), { recursive: true });

    const result = spawnSync(process.execPath, [BOSS_BIN, 'install', '--json'], {
      cwd: REPO_ROOT,
      env: { ...process.env, HOME: home },
      encoding: 'utf8',
    });

    expect(result.status, result.stderr).toBe(0);
    const payload = JSON.parse(result.stdout) as {
      actions: Array<{ agent: string; type: string }>;
    };
    expect(payload.actions).toContainEqual(
      expect.objectContaining({ agent: target.agent, type: 'install_skill' }),
    );

    const installed = path.join(home, ...target.installPath);
    for (const relativePath of REPRESENTATIVE_BUNDLE_FILES) {
      expect(
        fs.existsSync(path.join(installed, relativePath)),
        `${target.agent} missing ${relativePath}`,
      ).toBe(true);
    }

    const skill = fs.readFileSync(path.join(installed, 'SKILL.md'), 'utf8');
    expect(skill).toContain(target.metadata);
    expect(fs.existsSync(path.join(installed, 'package.json'))).toBe(false);
    expect(fs.existsSync(path.join(installed, 'packages'))).toBe(false);
    expect(fs.existsSync(path.join(installed, '.claude-plugin'))).toBe(false);

    // 安装副本自带的 CLI 必须能脱离仓库/ npm 直接运行。
    const cliResult = spawnSync(
      process.execPath,
      [path.join(installed, 'cli', 'bin', 'boss.mts'), '--version'],
      { cwd: REPO_ROOT, env: { ...process.env, HOME: home }, encoding: 'utf8' },
    );
    expect(cliResult.status, cliResult.stderr).toBe(0);
    expect(cliResult.stdout.trim()).toMatch(/^\d+\.\d+\.\d+/);
  });

  it('merges Codex hooks into ~/.codex/hooks.json without overwriting user hooks', () => {
    ensureCli('skill/cli/bin/boss.mts');
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
                command: 'echo keep-user-hook',
              },
            ],
            description: 'user hook',
            id: 'user:pre:bash',
          },
        ],
      },
    };
    fs.writeFileSync(
      path.join(codexHome, 'hooks.json'),
      JSON.stringify(existingHooks, null, 2) + '\n',
      'utf8',
    );

    const result = spawnSync(process.execPath, [BOSS_BIN, 'install', '--json'], {
      cwd: REPO_ROOT,
      env: { ...process.env, HOME: home },
      encoding: 'utf8',
    });

    expect(result.status, result.stderr).toBe(0);

    const hooksJson = JSON.parse(fs.readFileSync(path.join(codexHome, 'hooks.json'), 'utf8')) as {
      hooks: Record<string, Array<{ id: string; hooks?: Array<{ command?: string }> }>>;
    };
    expect(hooksJson.hooks.PreToolUse?.some((entry) => entry.id === 'user:pre:bash')).toBe(true);
    expect(hooksJson.hooks.SessionStart?.some((entry) => entry.id === 'session:start')).toBe(true);
    expect(
      hooksJson.hooks.PreToolUse?.some((entry) => entry.id === 'pre:write:artifact-guard'),
    ).toBe(true);

    // 复制安装没有插件根：hooks 中的 ${PLUGIN_ROOT}/skill 必须物化为实际安装目录，
    // 且命令指向安装副本自带的 CLI（不依赖 PATH 上的 boss 二进制）。
    const installedCli = path.join(codexHome, 'skills', 'boss', 'cli', 'bin', 'boss.mts');
    const sessionStart = hooksJson.hooks.SessionStart?.find(
      (entry) => entry.id === 'session:start',
    );
    expect(JSON.stringify(sessionStart)).toContain(installedCli);
    // biome-ignore lint/suspicious/noTemplateCurlyInString: 字面占位符（运行时替换），不是模板插值
    expect(JSON.stringify(hooksJson)).not.toContain('${PLUGIN_ROOT}');
    expect(fs.existsSync(installedCli)).toBe(true);
    const state = JSON.parse(
      fs.readFileSync(path.join(codexHome, '.boss-hooks-state.json'), 'utf8'),
    ) as {
      manifestChecksum?: string;
      hookIds: string[];
    };
    expect(state.manifestChecksum).toMatch(/^sha256:/);
    expect(state.hookIds).toContain('pre:write:artifact-guard');
  });

  it('warns when user hooks without ids use Codex write matcher aliases', async () => {
    ensureCli('skill/cli/bin/boss.mts');
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
                hooks: [{ type: 'command', command: 'echo user-edit-hook' }],
              },
            ],
          },
        },
        null,
        2,
      ) + '\n',
      'utf8',
    );
    const result = spawnSync(process.execPath, [BOSS_BIN, 'install', '--human'], {
      cwd: REPO_ROOT,
      env: { ...process.env, HOME: home },
      encoding: 'utf8',
    });

    expect(result.status, result.stderr).toBe(0);
    expect(result.stdout).toContain('PreToolUse/apply_patch');
  });

  it('dry-run shows both Codex skill copy and hooks merge actions', () => {
    ensureCli('skill/cli/bin/boss.mts');
    const home = makeHome();
    fs.mkdirSync(path.join(home, '.codex'), { recursive: true });

    const result = spawnSync(process.execPath, [BOSS_BIN, 'install', '--dry-run', '--human'], {
      cwd: REPO_ROOT,
      env: { ...process.env, HOME: home },
      encoding: 'utf8',
    });

    expect(result.status, result.stderr).toBe(0);
    expect(result.stdout).toContain(
      `[dry-run] Codex: would install to ${path.join(home, '.codex', 'skills', 'boss')}`,
    );
    expect(result.stdout).toContain(
      `[dry-run] Codex: would merge hooks into ${path.join(home, '.codex', 'hooks.json')}`,
    );
  });

  it('uninstall removes stale Boss-managed Codex hook ids from older installs', () => {
    ensureCli('skill/cli/bin/boss.mts');
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
              { matcher: 'Bash', hooks: [], id: 'user:pre:bash' },
            ],
          },
        },
        null,
        2,
      ) + '\n',
      'utf8',
    );
    fs.writeFileSync(
      path.join(codexHome, '.boss-hooks-state.json'),
      JSON.stringify(
        { version: '3.8.9', installMode: 'hooks-json', hookIds: ['pre:bash:dangerous-cmd-guard'] },
        null,
        2,
      ) + '\n',
      'utf8',
    );

    const uninstall = spawnSync(process.execPath, [BOSS_BIN, 'uninstall', '--yes', '--json'], {
      cwd: REPO_ROOT,
      env: { ...process.env, HOME: home },
      encoding: 'utf8',
    });
    expect(uninstall.status, uninstall.stderr).toBe(0);

    const hooksJson = JSON.parse(fs.readFileSync(path.join(codexHome, 'hooks.json'), 'utf8')) as {
      hooks: Record<string, Array<{ id: string }>>;
    };
    expect(
      hooksJson.hooks.PreToolUse?.some((entry) => entry.id === 'pre:bash:dangerous-cmd-guard') ??
        false,
    ).toBe(false);
    expect(hooksJson.hooks.PreToolUse?.some((entry) => entry.id === 'pre:my-custom-thing')).toBe(
      true,
    );
    expect(hooksJson.hooks.PreToolUse?.some((entry) => entry.id === 'user:pre:bash')).toBe(true);
  });

  it('legacy Boss hook id cleanup list covers current Claude and Codex manifests', async () => {
    const { LEGACY_BOSS_HOOK_IDS } = await import('../../skill/cli/commands/install/index.mts');
    const legacyIds = new Set(LEGACY_BOSS_HOOK_IDS);

    for (const manifestPath of [
      path.join(REPO_ROOT, 'skill', 'hooks', 'claude', 'hooks.json'),
      path.join(REPO_ROOT, 'skill', 'hooks', 'codex', 'hooks.json'),
    ]) {
      const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8')) as {
        hooks: Record<string, Array<{ id?: string }>>;
      };
      const currentIds = Object.values(manifest.hooks).flatMap((entries) =>
        entries.map((entry) => entry.id),
      );

      for (const id of currentIds) {
        expect(legacyIds.has(id!)).toBe(true);
      }
    }
  });

  it('uninstall removes only Boss-managed Codex hook entries', () => {
    ensureCli('skill/cli/bin/boss.mts');
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
                command: 'echo keep-user-hook',
              },
            ],
            description: 'user hook',
            id: 'user:pre:bash',
          },
        ],
      },
    };
    fs.writeFileSync(
      path.join(codexHome, 'hooks.json'),
      JSON.stringify(existingHooks, null, 2) + '\n',
      'utf8',
    );

    const install = spawnSync(process.execPath, [BOSS_BIN, 'install', '--json'], {
      cwd: REPO_ROOT,
      env: { ...process.env, HOME: home },
      encoding: 'utf8',
    });
    expect(install.status, install.stderr).toBe(0);

    const uninstall = spawnSync(process.execPath, [BOSS_BIN, 'uninstall', '--yes', '--json'], {
      cwd: REPO_ROOT,
      env: { ...process.env, HOME: home },
      encoding: 'utf8',
    });
    expect(uninstall.status, uninstall.stderr).toBe(0);

    const hooksJson = JSON.parse(fs.readFileSync(path.join(codexHome, 'hooks.json'), 'utf8')) as {
      hooks: Record<string, Array<{ id: string }>>;
    };
    expect(hooksJson.hooks.PreToolUse?.some((entry) => entry.id === 'user:pre:bash')).toBe(true);
    expect(
      hooksJson.hooks.SessionStart?.some((entry) => entry.id === 'session:start') ?? false,
    ).toBe(false);
    expect(
      hooksJson.hooks.PreToolUse?.some((entry) => entry.id === 'pre:write:artifact-guard') ?? false,
    ).toBe(false);
    expect(fs.existsSync(path.join(codexHome, '.boss-hooks-state.json'))).toBe(false);
  });

  it('Claude plugin declares a single skill root matching the Codex surface', () => {
    const plugin = JSON.parse(
      fs.readFileSync(path.join(REPO_ROOT, '.claude-plugin', 'plugin.json'), 'utf8'),
    ) as { skills: string[] };

    // 只声明 ./skill/ 一个根：boss 作为单个 skill 被外部 skills CLI 发现，
    // 内部方法论随目录整体安装，不被列成独立可选项。
    expect(plugin.skills).toContain('./skill/');
    expect(plugin.skills).not.toContain('./skill/skills/');
  });

  it('Codex plugin declares install-surface metadata without extra runtime surfaces', () => {
    const plugin = JSON.parse(
      fs.readFileSync(path.join(REPO_ROOT, '.codex-plugin', 'plugin.json'), 'utf8'),
    ) as {
      hooks?: string;
      skills: string | string[];
      mcpServers?: unknown;
      apps?: unknown;
      interface?: { displayName?: string; defaultPrompt?: string[] };
    };

    expect(plugin.skills).toBe('./skill/');
    // Codex 支持插件内自带 hooks：声明文件路径，安装后无需 npm 提供的 boss 二进制。
    expect(plugin.hooks).toBe('./skill/hooks/codex/hooks.json');
    expect(plugin.mcpServers).toBeUndefined();
    expect(plugin.apps).toBeUndefined();
    expect(plugin.interface?.displayName).toBe('Boss');
    expect(plugin.interface?.defaultPrompt?.length).toBeGreaterThan(0);
  });

  it('Claude plugin declares the skill hooks manifest for plugin-mode enforcement', () => {
    const plugin = JSON.parse(
      fs.readFileSync(path.join(REPO_ROOT, '.claude-plugin', 'plugin.json'), 'utf8'),
    ) as {
      hooks?: string[];
    };

    expect(plugin.hooks).toContain('./skill/hooks/claude/hooks.json');
  });

  it.each([
    '.agents/plugins/marketplace.json',
    '.codex-plugin/marketplace.json',
    '.claude-plugin/marketplace.json',
  ])('%s declares install policy and local plugin source', (relativePath) => {
    const marketplace = JSON.parse(fs.readFileSync(path.join(REPO_ROOT, relativePath), 'utf8')) as {
      plugins?: Array<{
        name?: string;
        source?: string | { source?: string; path?: string };
        policy?: { installation?: string; authentication?: string };
        category?: string;
      }>;
    };

    const boss = marketplace.plugins?.find((plugin) => plugin.name === 'boss');
    // Claude 市场用相对路径字符串；Codex 市场用 { source: 'local', path } 结构。
    const sourcePath = typeof boss?.source === 'string' ? boss.source : boss?.source?.path;
    expect(sourcePath).toBe('./');
    expect(boss?.policy).toEqual({ installation: 'AVAILABLE', authentication: 'ON_INSTALL' });
    expect(boss?.category).toBe('Productivity');
  });

  it('keeps publisher identity and support URLs consistent across publish metadata', () => {
    const packageJson = JSON.parse(
      fs.readFileSync(path.join(REPO_ROOT, 'package.json'), 'utf8'),
    ) as {
      author?: { name?: string; email?: string; url?: string };
      bugs?: { url?: string };
    };
    const codexPlugin = JSON.parse(
      fs.readFileSync(path.join(REPO_ROOT, '.codex-plugin', 'plugin.json'), 'utf8'),
    ) as {
      author?: { name?: string; email?: string; url?: string };
    };
    const marketplaces = [
      '.agents/plugins/marketplace.json',
      '.codex-plugin/marketplace.json',
      '.claude-plugin/marketplace.json',
    ].map(
      (relativePath) =>
        JSON.parse(fs.readFileSync(path.join(REPO_ROOT, relativePath), 'utf8')) as {
          owner?: { name?: string; email?: string; url?: string };
          support?: { url?: string; security?: string };
        },
    );

    expect(packageJson.author).toEqual(codexPlugin.author);
    for (const marketplace of marketplaces) {
      expect(marketplace.owner).toEqual(packageJson.author);
      expect(marketplace.support?.url).toBe(packageJson.bugs?.url);
      expect(marketplace.support?.security).toBe(
        'https://github.com/echoVic/boss-skill/security/advisories/new',
      );
    }
  });

  it('skill bundle ships its own CLI, hooks runtime, and assets for marketplace installs', () => {
    const skillRoot = path.join(REPO_ROOT, 'skill');
    for (const file of REQUIRED_SKILL_BUNDLE_FILES) {
      expect(fs.existsSync(path.join(skillRoot, file)), `skill bundle missing ${file}`).toBe(true);
    }
    for (const file of REQUIRED_REPO_FILES) {
      expect(fs.existsSync(path.join(REPO_ROOT, file)), `repo missing ${file}`).toBe(true);
    }
    expect(
      fs.existsSync(path.join(skillRoot, 'hooks', 'hooks.json')),
      'skill should not include legacy hook manifest',
    ).toBe(false);
  });

  it('bundled CLI runs from a marketplace-style copy without npm or PATH shims', () => {
    const home = makeHome();
    const copy = path.join(home, 'skills', 'boss');
    fs.cpSync(path.join(REPO_ROOT, 'skill'), copy, { recursive: true });

    // 模拟 marketplace 安装：只复制 skill 目录，没有 node_modules、没有 PATH 里的 boss。
    const version = spawnSync(
      process.execPath,
      [path.join(copy, 'cli', 'bin', 'boss.mts'), '--version'],
      { cwd: home, encoding: 'utf8', env: { PATH: '/nonexistent', HOME: home } },
    );
    expect(version.status, version.stderr).toBe(0);
    const skillVersion = /^version:\s*(.+)$/m.exec(
      fs.readFileSync(path.join(copy, 'SKILL.md'), 'utf8'),
    )?.[1];
    expect(version.stdout.trim()).toBe(skillVersion);

    // hooks 链路同样自包含：CLI → skill/scripts/lib/run-with-flags.js → hook 脚本。
    const hook = spawnSync(
      process.execPath,
      [
        path.join(copy, 'cli', 'bin', 'boss.mts'),
        'hooks',
        'run',
        'session:start',
        'scripts/hooks/session-start.js',
      ],
      {
        cwd: home,
        encoding: 'utf8',
        env: { PATH: '/nonexistent', HOME: home },
        input: `{"cwd":"${home}"}`,
      },
    );
    expect(hook.status, hook.stderr).toBe(0);
  });
});
