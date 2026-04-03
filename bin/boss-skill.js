#!/usr/bin/env node

const path = require("path");
const fs = require("fs");
const os = require("os");

const PKG_ROOT = path.resolve(__dirname, "..");
const pkg = require(path.join(PKG_ROOT, "package.json"));
const HOME = os.homedir();

const METADATA = {
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

const BRAINSTORM_METADATA = {
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

const AGENTS = [
  {
    name: "OpenClaw",
    detect: () => fs.existsSync(path.join(HOME, ".openclaw")),
    dest: () => path.join(HOME, ".openclaw", "skills", "boss"),
    method: "copy",
  },
  {
    name: "Codex",
    detect: () => fs.existsSync(path.join(HOME, ".codex")),
    dest: () => path.join(HOME, ".codex", "skills", "boss"),
    method: "copy",
  },
  {
    name: "Antigravity",
    detect: () => fs.existsSync(path.join(HOME, ".gemini", "antigravity")),
    dest: () => path.join(HOME, ".gemini", "antigravity", "skills", "boss"),
    method: "copy",
  },
  {
    name: "Claude Code",
    detect: () => true,
    dest: () => path.resolve(process.cwd(), ".claude"),
    method: "hooks",
  },
];

const USAGE = `
@blade-ai/boss-skill v${pkg.version}
BMAD Harness Engineer — pluggable pipeline skill for coding agents.
Compatible with Claude Code, OpenClaw, Codex & Antigravity.

Usage:
  boss-skill                Auto-detect all agents and install
  boss-skill install        Same as above
  boss-skill path           Print the installed skill root directory
  boss-skill --version      Print version
  boss-skill --help         Show this help

Auto-detect logic (checks all, installs to every detected agent):
  ~/.openclaw/                →  ~/.openclaw/skills/boss/     (copy + inject metadata)
  ~/.codex/                   →  ~/.codex/skills/boss/        (copy + inject metadata)
  ~/.gemini/antigravity/      →  ~/.gemini/.../skills/boss/   (copy + inject metadata)
  (always)                    →  .claude/settings.json        (hooks)
`;

function injectMetadata(content, agentName) {
  const meta = METADATA[agentName];
  if (!meta) return content;
  return content.replace(/^(---\n[\s\S]*?)(^---)/m, `$1${meta}\n$2`);
}

function injectBrainstormMetadata(content, agentName) {
  const meta = BRAINSTORM_METADATA[agentName];
  if (!meta) return content;
  return content.replace(/^(---\n[\s\S]*?)(^---)/m, `$1${meta}\n$2`);
}

function copyDir(src, dest, exclude) {
  if (!fs.existsSync(dest)) {
    fs.mkdirSync(dest, { recursive: true });
  }

  const entries = fs.readdirSync(src, { withFileTypes: true });
  for (const entry of entries) {
    if (exclude && exclude.includes(entry.name)) continue;

    const srcPath = path.join(src, entry.name);
    const destPath = path.join(dest, entry.name);

    if (entry.isDirectory()) {
      copyDir(srcPath, destPath, exclude);
    } else {
      fs.copyFileSync(srcPath, destPath);
    }
  }
}

function copyInstall(agent) {
  const dest = agent.dest();

  if (fs.existsSync(dest)) {
    fs.rmSync(dest, { recursive: true });
  }

  const exclude = [".git", ".github", "node_modules", ".npmrc", ".DS_Store", "dist", ".claude"];
  copyDir(PKG_ROOT, dest, exclude);

  const skillMd = path.join(dest, "SKILL.md");
  if (fs.existsSync(skillMd)) {
    const content = fs.readFileSync(skillMd, "utf8");
    fs.writeFileSync(skillMd, injectMetadata(content, agent.name));
  }

  const brainstormMd = path.join(dest, "skills", "brainstorming", "SKILL.md");
  if (fs.existsSync(brainstormMd)) {
    const content = fs.readFileSync(brainstormMd, "utf8");
    fs.writeFileSync(brainstormMd, injectBrainstormMetadata(content, agent.name));
  }

  console.log(`  ✅ ${agent.name}: ${dest} (copied + metadata injected)`);
}

function hooksInstall() {
  const dest = path.resolve(process.cwd(), ".claude");
  const src = path.join(PKG_ROOT, ".claude", "settings.json");

  if (!fs.existsSync(src)) {
    console.log("  ⚠️  Claude Code: .claude/settings.json not found in package, skipped.");
    return;
  }

  if (!fs.existsSync(dest)) {
    fs.mkdirSync(dest, { recursive: true });
  }

  const settings = JSON.parse(fs.readFileSync(src, "utf8"));
  const hookEvents = Object.keys(settings.hooks || {});

  hookEvents.forEach((event) => {
    const hooks = settings.hooks[event];
    if (!Array.isArray(hooks)) return;
    hooks.forEach((hook) => {
      if (hook.command && hook.command.includes("$CLAUDE_PROJECT_DIR")) {
        hook.command = hook.command.replace(
          /"\$CLAUDE_PROJECT_DIR"/g,
          JSON.stringify(PKG_ROOT)
        );
      }
    });
  });

  const destFile = path.join(dest, "settings.json");
  if (fs.existsSync(destFile)) {
    const existing = JSON.parse(fs.readFileSync(destFile, "utf8"));
    existing.hooks = { ...existing.hooks, ...settings.hooks };
    fs.writeFileSync(destFile, JSON.stringify(existing, null, 2) + "\n");
  } else {
    fs.writeFileSync(destFile, JSON.stringify(settings, null, 2) + "\n");
  }

  console.log(`  ✅ Claude Code: ${hookEvents.length} hook events → .claude/settings.json`);
}

function autoInstall() {
  console.log(`@blade-ai/boss-skill v${pkg.version}\n`);

  const detected = AGENTS.filter((a) => a.detect());
  console.log(`Detected ${detected.length} agent(s):\n`);

  for (const agent of detected) {
    if (agent.method === "copy") {
      copyInstall(agent);
    } else {
      hooksInstall();
    }
  }

  console.log("\nDone! Restart your agent or start a new session to pick up boss-skill.");
}

const cmd = process.argv[2];

switch (cmd) {
  case "install":
  case undefined:
    autoInstall();
    break;

  case "path":
    process.stdout.write(PKG_ROOT + "\n");
    break;

  case "--version":
  case "-v":
    console.log(pkg.version);
    break;

  case "--help":
  case "-h":
    console.log(USAGE);
    break;

  default:
    console.error(`Unknown command: ${cmd}\n`);
    console.log(USAGE);
    process.exit(1);
}
