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
  method: 'copy' | 'hooks' | 'plugin';
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
    dest: () => PKG_ROOT,
    method: 'plugin',
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
  Claude Code                 →  plugin mode (--plugin-dir)
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

function pluginInstall(dryRun: boolean): void {
  if (dryRun) {
    console.log(`  [dry-run] Claude Code: would register plugin at ${PKG_ROOT}`);
    return;
  }

  console.log(`  ✅ Claude Code: plugin ready at ${PKG_ROOT}`);
  console.log(`     Use:  claude --plugin-dir "${PKG_ROOT}"`);
  console.log(`     Or:   claude --plugin-dir "$(boss-skill path)"`);
}

function autoInstall(dryRun: boolean): void {
  console.log(`@blade-ai/boss-skill v${pkg.version}${dryRun ? ' (dry-run)' : ''}\n`);

  const detected = AGENTS.filter((a) => a.detect());
  console.log(`Detected ${detected.length} agent(s):\n`);

  for (const agent of detected) {
    if (agent.method === 'copy') {
      copyInstall(agent, dryRun);
    } else {
      pluginInstall(dryRun);
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

  console.log(`  ℹ️  Claude Code: plugin mode — no files to clean up.`);
  console.log(`     If loaded via --plugin-dir, simply stop passing the flag.`);

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
