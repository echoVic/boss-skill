import { execFileSync, spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { resolve } from 'node:path';

const root = resolve(import.meta.dirname, '..', '..');
const DEFAULT_ENTRYPOINT = 'skill/cli/bin/boss.mts';

interface RunCliOptions {
  cwd?: string;
  env?: NodeJS.ProcessEnv;
}

/**
 * CLI 源码即产物（skill/cli 下的 .mts，Node >=22.18 原生类型擦除运行）。
 * 没有构建步骤：这里只确认入口存在。
 */
export function ensureCli(entrypoint: string = DEFAULT_ENTRYPOINT): string {
  const cliPath = resolve(root, entrypoint);
  if (!existsSync(cliPath)) {
    throw new Error(`Boss CLI entrypoint not found: ${cliPath}`);
  }
  return cliPath;
}

export function runCli(args: string[], options: RunCliOptions = {}) {
  const entrypoint = args[0] ?? DEFAULT_ENTRYPOINT;
  const resolvedArgs = [ensureCli(entrypoint), ...args.slice(1)];
  return spawnSync(process.execPath, resolvedArgs, {
    cwd: options.cwd ?? root,
    env: options.env ?? process.env,
    encoding: 'utf8',
  });
}

export function runCliOrThrow(args: string[], options: RunCliOptions = {}) {
  const entrypoint = args[0] ?? DEFAULT_ENTRYPOINT;
  const resolvedArgs = [ensureCli(entrypoint), ...args.slice(1)];
  return execFileSync(process.execPath, resolvedArgs, {
    cwd: options.cwd ?? root,
    env: options.env ?? process.env,
    encoding: 'utf8',
  });
}
