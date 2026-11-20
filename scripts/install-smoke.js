#!/usr/bin/env node

/**
 * install-smoke.js - 走真实安装路径的冒烟检查
 *
 * 用各宿主自己的工具读取本仓库，确认 Boss 能被发现和加载：
 *   1. skills CLI：`skills add <repo> --list` 必须列出 boss
 *   2. Claude Code：`claude plugin validate` 不得报错，且注册了 /boss:<stage> 命令
 *
 * 用法:
 *   node scripts/install-smoke.js [--require-claude]
 *
 * 未安装 claude CLI 时默认跳过第 2 项；CI 里传 --require-claude 强制要求。
 */

import { execFileSync, spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const ROOT = path.resolve(import.meta.dirname, '..');
const SKILLS_CLI = 'skills@1.9.0';
const COMMANDS = [
  'pm',
  'architect',
  'ui',
  'review',
  'tasks',
  'dev',
  'qa',
  'ship',
  'verify',
  'upgrade',
];
const requireClaude = process.argv.includes('--require-claude');
const failures = [];

function strip(text) {
  // biome-ignore lint/suspicious/noControlCharactersInRegex: strips ANSI colour codes from CLI output
  return text.replace(/\x1b\[[0-9;?]*[A-Za-z]/g, '');
}

function run(bin, args, options = {}) {
  const result = spawnSync(bin, args, { cwd: ROOT, encoding: 'utf8', ...options });
  return { status: result.status, output: strip(`${result.stdout ?? ''}\n${result.stderr ?? ''}`) };
}

function check(name, ok, detail) {
  console.log(`${ok ? '✅' : '❌'} ${name}`);
  if (!ok) {
    failures.push(name);
    if (detail) console.log(detail.trim().split('\n').slice(-15).join('\n'));
  }
}

// 1. skills CLI：在空 HOME 下列出本仓库的 skill，避免读到本机已安装的副本。
const home = fs.mkdtempSync(path.join(os.tmpdir(), 'boss-install-smoke-'));
try {
  const listed = run('npx', ['--yes', SKILLS_CLI, 'add', ROOT, '--list'], {
    cwd: home,
    env: { ...process.env, HOME: home, CI: '1' },
  });
  check(
    `${SKILLS_CLI} lists the boss skill`,
    listed.status === 0 &&
      /Found 1 skill\b/.test(listed.output) &&
      /^\W*boss\s*$/m.test(listed.output),
    listed.output,
  );
} finally {
  fs.rmSync(home, { recursive: true, force: true });
}

// 2. Claude Code 插件校验。
let hasClaude = true;
try {
  execFileSync('claude', ['--version'], { stdio: 'ignore' });
} catch {
  hasClaude = false;
}

if (!hasClaude) {
  if (requireClaude) check('claude CLI is installed', false, 'claude not found on PATH');
  else console.log('⏭️  claude CLI not found; skipping the Claude Code plugin checks');
} else {
  const validated = run('claude', ['plugin', 'validate', '.']);
  check(
    'claude plugin validate reports no error',
    validated.status === 0 && !validated.output.includes('✘'),
    validated.output,
  );
  check(
    'Claude Code registers the boss skill',
    /skills: boss:boss\b/.test(validated.output),
    validated.output,
  );
  for (const command of COMMANDS) {
    check(
      `Claude Code registers /boss:${command}`,
      new RegExp(`commands: boss:${command}\\b`).test(validated.output),
    );
  }
}

if (failures.length > 0) {
  console.error(`\n${failures.length} install check(s) failed.`);
  process.exit(1);
}
console.log('\nInstall smoke checks passed.');
