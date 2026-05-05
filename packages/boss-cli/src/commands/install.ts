#!/usr/bin/env node
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  assertConfirmed,
  createCliContext,
  describeCommand,
  renderHelp,
  writeOutput
} from '../cli/contract.js';
import { commandDescriptions } from '../cli/command-registry.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const PKG_ROOT = path.resolve(__dirname, '..', '..', '..', '..');
const SKILL_ROOT = path.join(PKG_ROOT, 'skill');
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

type InstallAction = {
  type: 'install_skill' | 'register_plugin';
  agent: string;
  path: string;
};

type UninstallAction = {
  type: 'remove_skill' | 'skip_missing';
  agent: string;
  path: string;
};

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

const installDescription = commandDescriptions['boss install']!;
const uninstallDescription = commandDescriptions['boss uninstall']!;
const pathDescription = commandDescriptions['boss path']!;
const INSTALL_HELP = renderHelp(installDescription, 'boss install [options]');

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

function copyInstall(agent: Agent, dryRun: boolean, silent = false): void {
  const dest = agent.dest();

  if (dryRun) {
    if (!silent) console.log(`  [dry-run] ${agent.name}: would install to ${dest}`);
    return;
  }

  if (fs.existsSync(dest)) {
    fs.rmSync(dest, { recursive: true });
  }

  copyDir(SKILL_ROOT, dest);

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

  if (!silent) console.log(`  ✅ ${agent.name}: ${dest} (copied + metadata injected)`);
}

function pluginInstall(dryRun: boolean, silent = false): void {
  if (dryRun) {
    if (!silent) console.log(`  [dry-run] Claude Code: would register plugin at ${PKG_ROOT}`);
    return;
  }

  if (silent) return;
  console.log(`  ✅ Claude Code: plugin ready at ${PKG_ROOT}`);
  console.log(`     Use:  claude --plugin-dir "${PKG_ROOT}"`);
  console.log(`     Or:   claude --plugin-dir "$(boss-skill path)"`);
}

export function buildInstallPlan(): InstallAction[] {
  return AGENTS.filter((agent) => agent.detect()).map((agent) => ({
    type: agent.method === 'plugin' ? 'register_plugin' : 'install_skill',
    agent: agent.name,
    path: agent.dest()
  }));
}

export function buildUninstallPlan(): UninstallAction[] {
  return AGENTS.filter((agent) => agent.method === 'copy' && agent.detect()).map((agent) => {
    const dest = agent.dest();
    return {
      type: fs.existsSync(dest) ? 'remove_skill' : 'skip_missing',
      agent: agent.name,
      path: dest
    };
  });
}

function autoInstall(dryRun: boolean, silent = false): void {
  if (!silent) console.log(`@blade-ai/boss-skill v${pkg.version}${dryRun ? ' (dry-run)' : ''}\n`);

  const detected = AGENTS.filter((a) => a.detect());
  if (!silent) console.log(`Detected ${detected.length} agent(s):\n`);

  for (const agent of detected) {
    if (agent.method === 'copy') {
      copyInstall(agent, dryRun, silent);
    } else {
      pluginInstall(dryRun, silent);
    }
  }

  if (silent) return;
  if (dryRun) {
    console.log('\nDry-run complete. No files were modified.');
  } else {
    console.log('\nDone! Restart your agent or start a new session to pick up boss-skill.');
  }
}

function uninstall(silent = false): void {
  if (!silent) console.log(`@blade-ai/boss-skill v${pkg.version} — uninstall\n`);

  const copyAgents = AGENTS.filter((a) => a.method === 'copy' && a.detect());

  for (const agent of copyAgents) {
    const dest = agent.dest();
    if (fs.existsSync(dest)) {
      fs.rmSync(dest, { recursive: true });
      if (!silent) console.log(`  ✅ ${agent.name}: removed ${dest}`);
    } else {
      if (!silent) console.log(`  ⏭️  ${agent.name}: not installed, skipped`);
    }
  }

  if (silent) return;
  console.log(`  ℹ️  Claude Code: plugin mode — no files to clean up.`);
  console.log(`     If loaded via --plugin-dir, simply stop passing the flag.`);

  console.log('\nUninstall complete.');
}

export function showHelp(): void {
  console.log(`${USAGE}\n${INSTALL_HELP}`);
}

export function installMain(argv: string[] = process.argv.slice(2)): number {
  const context = createCliContext(argv, { command: 'boss install' });
  const cmd = argv[0];
  const rest = argv.slice(1);
  const dryRun = context.values.dryRun;

  switch (cmd) {
    case 'install':
    case undefined:
      if (context.values.describe) {
        writeOutput(describeCommand(installDescription), context, (data) => `${JSON.stringify(data, null, 2)}\n`);
        return 0;
      }
      if (dryRun && context.useJson) {
        writeOutput(
          { actions: buildInstallPlan(), risk_tier: 'medium', requires_approval: false },
          context,
          () => ''
        );
        return 0;
      }
      if (context.values.json) {
        const actions = buildInstallPlan();
        autoInstall(false, true);
        writeOutput(
          { actions, risk_tier: 'medium', requires_approval: false, status: 'installed' },
          context,
          () => ''
        );
        return 0;
      }
      autoInstall(dryRun);
      return 0;

    case 'uninstall':
      if (context.values.describe) {
        writeOutput(describeCommand(uninstallDescription), context, (data) => `${JSON.stringify(data, null, 2)}\n`);
        return 0;
      }
      if (dryRun && context.useJson) {
        writeOutput(
          { actions: buildUninstallPlan(), risk_tier: 'high', requires_approval: true },
          context,
          () => ''
        );
        return 0;
      }
      assertConfirmed(context, 'uninstall');
      if (context.values.json) {
        const actions = buildUninstallPlan();
        uninstall(true);
        writeOutput(
          { actions, risk_tier: 'high', requires_approval: true, status: 'uninstalled' },
          context,
          () => ''
        );
        return 0;
      }
      uninstall();
      return 0;

    case 'path':
      if (context.values.describe) {
        writeOutput(describeCommand(pathDescription), context, (data) => `${JSON.stringify(data, null, 2)}\n`);
        return 0;
      }
      if (context.values.json) {
        writeOutput({ path: PKG_ROOT }, context, () => `${PKG_ROOT}\n`);
      } else {
        process.stdout.write(`${PKG_ROOT}\n`);
      }
      return 0;

    case '--version':
    case '-v':
      console.log(pkg.version);
      return 0;

    case '--help':
    case '-h':
      console.log(USAGE);
      return 0;

    default:
      console.error(`Unknown command: ${cmd}\n`);
      console.log(USAGE);
      return 1;
  }
}

export const main = installMain;

const entrypoint = process.argv[1];
if (entrypoint && fs.realpathSync(entrypoint) === fs.realpathSync(__filename)) {
  process.exit(installMain());
}
