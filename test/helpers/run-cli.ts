import { execFileSync, spawnSync } from 'node:child_process';
import { existsSync, readdirSync, statSync } from 'node:fs';
import { join, resolve } from 'node:path';

const root = resolve(import.meta.dirname, '..', '..');
const npmCmd = process.platform === 'win32' ? 'npm.cmd' : 'npm';
let built = false;

interface RunCliOptions {
  cwd?: string;
  env?: NodeJS.ProcessEnv;
}

function newestSourceMtimeMs(dir: string): number {
  let newest = 0;
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    if (entry.name === 'dist') continue;
    const entryPath = join(dir, entry.name);
    if (entry.isDirectory()) {
      newest = Math.max(newest, newestSourceMtimeMs(entryPath));
      continue;
    }
    if (!entry.isFile()) continue;
    newest = Math.max(newest, statSync(entryPath).mtimeMs);
  }
  return newest;
}

export function ensureBuilt(entrypoint: string): void {
  const cliPath = resolve(root, entrypoint);
  if (built && existsSync(cliPath)) {
    return;
  }

  const srcRoot = resolve(root, 'packages/boss-cli/src');
  if (existsSync(cliPath) && statSync(cliPath).mtimeMs >= newestSourceMtimeMs(srcRoot)) {
    built = true;
    return;
  }

  execFileSync(npmCmd, ['run', 'build'], {
    cwd: root,
    encoding: 'utf8'
  });
  built = true;
}

export function runCli(args: string[], options: RunCliOptions = {}) {
  const entrypoint = args[0] ?? 'packages/boss-cli/dist/bin/boss.js';
  ensureBuilt(entrypoint);
  const resolvedArgs = [resolve(root, entrypoint), ...args.slice(1)];
  return spawnSync(process.execPath, resolvedArgs, {
    cwd: options.cwd ?? root,
    env: options.env ?? process.env,
    encoding: 'utf8'
  });
}

export function runCliOrThrow(args: string[], options: RunCliOptions = {}) {
  const entrypoint = args[0] ?? 'packages/boss-cli/dist/bin/boss.js';
  ensureBuilt(entrypoint);
  const resolvedArgs = [resolve(root, entrypoint), ...args.slice(1)];
  return execFileSync(process.execPath, resolvedArgs, {
    cwd: options.cwd ?? root,
    env: options.env ?? process.env,
    encoding: 'utf8'
  });
}
