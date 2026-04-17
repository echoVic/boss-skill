import { execFileSync, spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { resolve } from 'node:path';

const root = resolve(import.meta.dirname, '..', '..');
const npmCmd = process.platform === 'win32' ? 'npm.cmd' : 'npm';

function ensureBuilt(entrypoint: string): void {
  const cliPath = resolve(root, entrypoint);
  if (existsSync(cliPath)) {
    return;
  }

  execFileSync(npmCmd, ['run', 'build'], {
    cwd: root,
    encoding: 'utf8'
  });
}

export function runCli(args: string[]) {
  ensureBuilt(args[0] ?? 'dist/bin/boss-skill.js');
  return spawnSync(process.execPath, args, {
    cwd: root,
    encoding: 'utf8'
  });
}

export function runCliOrThrow(args: string[]) {
  ensureBuilt(args[0] ?? 'dist/bin/boss-skill.js');
  return execFileSync(process.execPath, args, {
    cwd: root,
    encoding: 'utf8'
  });
}
