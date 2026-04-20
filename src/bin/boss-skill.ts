#!/usr/bin/env node
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const PKG_ROOT = path.resolve(__dirname, '..', '..');
const pkg = JSON.parse(fs.readFileSync(path.join(PKG_ROOT, 'package.json'), 'utf8')) as {
  version: string;
};
const HOME = os.homedir();

interface Agent {
  name: string;
  detect: () => boolean;
  dest: () => string;
  method: 'copy' | 'hooks';
}

const METADATA: Record<string, string> = {
  OpenClaw: `metadata:
  openclaw:
    emoji: "👔"
    primaryEnv: BOSS_HOOK_PROFILE
    requires:
      bins:
        - node
        - bash
    install:
      - id: node-boss-skill
        kind: node
        package: "@blade-ai/boss-skill"
        bins:
          - boss-skill
        label: "Install Boss Skill (npm)"`,

  Codex: `metadata:
  codex:
    emoji: "👔"
    requires:
      bins:
        - node
        - bash`,

  Antigravity: `metadata:
  antigravity:
    emoji: "👔"
    requires:
      bins:
        - node
        - bash`,
};

const BRAINSTORM_METADATA: Record<string, string> = {
  OpenClaw: `metadata:
  openclaw:
    emoji: "🧠"`,
  Codex: `metadata:
  codex:
    emoji: "🧠"`,
  Antigravity: `metadata:
  antigravity:
    emoji: "🧠"`,
};

const AGENTS: Agent[] = [
  {
    name: 'OpenClaw',
    detect: () => fs.existsSync(path.join(HOME, '.openclaw')),
    dest: () => path.join(HOME, '.openclaw', 'skills', 'boss'),
    method: 'copy',
  },
  {
    name: 'Codex',
    detect: () => fs.existsSync(path.join(HOME, '.codex')),
    dest: () => path.join(HOME, '.codex', 'skills', 'boss'),
    method: 'copy',
  },
  {
    name: 'Antigravity',
    detect: () => fs.existsSync(path.join(HOME, '.gemini', 'antigravity')),
    dest: () => path.join(HOME, '.gemini', 'antigravity', 'skills', 'boss'),
    method: 'copy',
  },
  {
    name: 'Claude Code',
    detect: () => true,
    dest: () => path.resolve(process.cwd(), '.claude'),
    method: 'hooks',
  },
];

const USAGE = `
@blade-ai/boss-skill v${pkg.version}
BMAD Harness Engineer — pluggable pipeline skill for coding agents.
Compatible with Claude Code, OpenClaw, Codex & Antigravity.

Usage:
  boss-skill                Auto-detect all agents and install
  boss-skill install        Same as above
  boss-skill install --dry-run   Preview install actions without writing
  boss-skill uninstall      Remove boss-skill from all detected agents
  boss-skill path           Print the installed skill root directory
  boss-skill --version      Print version
  boss-skill --help         Show this help

Auto-detect logic (checks all, installs to every detected agent):
  ~/.openclaw/                →  ~/.openclaw/skills/boss/     (copy + inject metadata)
  ~/.codex/                   →  ~/.codex/skills/boss/        (copy + inject metadata)
  ~/.gemini/antigravity/      →  ~/.gemini/.../skills/boss/   (copy + inject metadata)
  (always)                    →  .claude/settings.json        (hooks)
`;

function injectMetadata(content: string, agentName: string): string {
  const meta = METADATA[agentName];
  if (!meta) return content;
  return content.replace(/^(---\n[\s\S]*?)(^---)/m, `$1${meta}\n$2`);
}

function injectBrainstormMetadata(content: string, agentName: string): string {
  const meta = BRAINSTORM_METADATA[agentName];
  if (!meta) return content;
  return content.replace(/^(---\n[\s\S]*?)(^---)/m, `$1${meta}\n$2`);
}

function copyDir(src: string, dest: string, exclude?: string[]): void {
  if (!fs.existsSync(dest)) {
    fs.mkdirSync(dest, { recursive: true });
  }

  const entries = fs.readdirSync(src, { withFileTypes: true });
  for (const entry of entries) {
    if (exclude?.includes(entry.name)) continue;

    const srcPath = path.join(src, entry.name);
    const destPath = path.join(dest, entry.name);

    if (entry.isDirectory()) {
      copyDir(srcPath, destPath, exclude);
    } else {
      fs.copyFileSync(srcPath, destPath);
    }
  }
}

function copyInstall(agent: Agent, dryRun: boolean): void {
  const dest = agent.dest();

  if (dryRun) {
    console.log(`  [dry-run] ${agent.name}: would install to ${dest}`);
    return;
  }

  if (fs.existsSync(dest)) {
    fs.rmSync(dest, { recursive: true });
  }

  const exclude = ['.git', '.github', 'node_modules', '.npmrc', '.DS_Store', 'dist', '.claude'];
  copyDir(PKG_ROOT, dest, exclude);

  const skillMd = path.join(dest, 'SKILL.md');
  if (fs.existsSync(skillMd)) {
    const content = fs.readFileSync(skillMd, 'utf8');
    fs.writeFileSync(skillMd, injectMetadata(content, agent.name));
  }

  const brainstormMd = path.join(dest, 'skills', 'brainstorming', 'SKILL.md');
  if (fs.existsSync(brainstormMd)) {
    const content = fs.readFileSync(brainstormMd, 'utf8');
    fs.writeFileSync(brainstormMd, injectBrainstormMetadata(content, agent.name));
  }

  console.log(`  ✅ ${agent.name}: ${dest} (copied + metadata injected)`);
}

interface HookEntry {
  id?: string;
  command?: string;
  [key: string]: unknown;
}

interface SettingsJson {
  hooks?: Record<string, HookEntry[]>;
  [key: string]: unknown;
}

function hooksInstall(dryRun: boolean): void {
  const dest = path.resolve(process.cwd(), '.claude');
  const src = path.join(PKG_ROOT, '.claude', 'settings.json');

  if (!fs.existsSync(src)) {
    console.log('  ⚠️  Claude Code: .claude/settings.json not found in package, skipped.');
    return;
  }

  if (!fs.existsSync(dest)) {
    fs.mkdirSync(dest, { recursive: true });
  }

  const settings = JSON.parse(fs.readFileSync(src, 'utf8')) as SettingsJson;
  const hookEvents = Object.keys(settings.hooks ?? {});

  for (const event of hookEvents) {
    const hooks = settings.hooks?.[event];
    if (!Array.isArray(hooks)) continue;
    for (const hook of hooks) {
      if (hook.command?.includes('$CLAUDE_PROJECT_DIR')) {
        hook.command = hook.command.replace(
          /"\$CLAUDE_PROJECT_DIR"/g,
          JSON.stringify(PKG_ROOT),
        );
      }
    }
  }

  const destFile = path.join(dest, 'settings.json');

  if (dryRun) {
    console.log(`  [dry-run] Claude Code: would merge ${hookEvents.length} hook events → ${destFile}`);
    return;
  }

  if (fs.existsSync(destFile)) {
    const existing = JSON.parse(fs.readFileSync(destFile, 'utf8')) as SettingsJson;
    if (!existing.hooks) existing.hooks = {};

    for (const event of Object.keys(settings.hooks ?? {})) {
      const bossHooks = settings.hooks?.[event];
      if (!Array.isArray(bossHooks)) continue;
      if (!Array.isArray(existing.hooks[event])) {
        existing.hooks[event] = [];
      }

      for (const bossHook of bossHooks) {
        const bossId = bossHook.id ?? '';
        const idx = bossId
          ? existing.hooks[event]!.findIndex((h) => h.id === bossId)
          : -1;

        if (idx >= 0) {
          existing.hooks[event]![idx] = bossHook;
        } else {
          existing.hooks[event]!.push(bossHook);
        }
      }
    }

    fs.writeFileSync(destFile, JSON.stringify(existing, null, 2) + '\n');
  } else {
    fs.writeFileSync(destFile, JSON.stringify(settings, null, 2) + '\n');
  }

  console.log(`  ✅ Claude Code: ${hookEvents.length} hook events → .claude/settings.json`);
}

function autoInstall(dryRun: boolean): void {
  console.log(`@blade-ai/boss-skill v${pkg.version}${dryRun ? ' (dry-run)' : ''}\n`);

  const detected = AGENTS.filter((a) => a.detect());
  console.log(`Detected ${detected.length} agent(s):\n`);

  for (const agent of detected) {
    if (agent.method === 'copy') {
      copyInstall(agent, dryRun);
    } else {
      hooksInstall(dryRun);
    }
  }

  if (dryRun) {
    console.log('\nDry-run complete. No files were modified.');
  } else {
    console.log('\nDone! Restart your agent or start a new session to pick up boss-skill.');
  }
}

function uninstall(): void {
  console.log(`@blade-ai/boss-skill v${pkg.version} — uninstall\n`);

  const copyAgents = AGENTS.filter((a) => a.method === 'copy' && a.detect());

  for (const agent of copyAgents) {
    const dest = agent.dest();
    if (fs.existsSync(dest)) {
      fs.rmSync(dest, { recursive: true });
      console.log(`  ✅ ${agent.name}: removed ${dest}`);
    } else {
      console.log(`  ⏭️  ${agent.name}: not installed, skipped`);
    }
  }

  const destFile = path.resolve(process.cwd(), '.claude', 'settings.json');
  if (fs.existsSync(destFile)) {
    try {
      const existing = JSON.parse(fs.readFileSync(destFile, 'utf8')) as SettingsJson;
      if (existing.hooks) {
        let removedCount = 0;
        for (const event of Object.keys(existing.hooks)) {
          if (!Array.isArray(existing.hooks[event])) continue;
          const before = existing.hooks[event]!.length;
          existing.hooks[event] = existing.hooks[event]!.filter(
            (h) => !h.id || !h.id.startsWith('boss-'),
          );
          removedCount += before - existing.hooks[event]!.length;
          if (existing.hooks[event]!.length === 0) {
            delete existing.hooks[event];
          }
        }
        if (Object.keys(existing.hooks).length === 0) {
          delete existing.hooks;
        }
        fs.writeFileSync(destFile, JSON.stringify(existing, null, 2) + '\n');
        console.log(`  ✅ Claude Code: removed ${removedCount} boss-skill hooks from ${destFile}`);
      } else {
        console.log('  ⏭️  Claude Code: no hooks found in settings.json');
      }
    } catch (err) {
      console.error(`  ❌ Claude Code: failed to clean settings.json: ${(err as Error).message}`);
    }
  } else {
    console.log('  ⏭️  Claude Code: .claude/settings.json not found');
  }

  console.log('\nUninstall complete.');
}

export function showHelp(): void {
  console.log(USAGE);
}

export function main(argv: string[] = process.argv.slice(2)): void {
  const cmd = argv[0];
  const rest = argv.slice(1);
  const dryRun = rest.includes('--dry-run');

  switch (cmd) {
    case 'install':
    case undefined:
      autoInstall(dryRun);
      break;

    case 'uninstall':
      uninstall();
      break;

    case 'path':
      process.stdout.write(PKG_ROOT + '\n');
      break;

    case '--version':
    case '-v':
      console.log(pkg.version);
      break;

    case '--help':
    case '-h':
      console.log(USAGE);
      break;

    default:
      console.error(`Unknown command: ${cmd}\n`);
      console.log(USAGE);
      process.exit(1);
  }
}

const entrypoint = process.argv[1];
if (entrypoint && fs.realpathSync(entrypoint) === fs.realpathSync(__filename)) {
  main();
}
