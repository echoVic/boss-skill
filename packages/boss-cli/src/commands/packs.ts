#!/usr/bin/env node
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';

import { detectPipelinePacks } from '../runtime/cli/lib/pack-runtime.js';

function showHelp(): void {
  process.stdout.write(
    [
      'Boss Harness - Pipeline Pack 自动检测',
      '',
      '用法: boss packs detect [project-dir] [--json]',
      ''
    ].join('\n')
  );
}

export function main(argv: string[] = process.argv.slice(2), { cwd = process.cwd() }: { cwd?: string } = {}): number {
  if (argv.includes('-h') || argv.includes('--help')) {
    showHelp();
    return 0;
  }

  let projectDir = cwd;
  let jsonOutput = false;
  for (const arg of argv) {
    if (arg === '--json') {
      jsonOutput = true;
    } else if (arg.startsWith('-')) {
      throw new Error(`未知选项: ${arg}`);
    } else {
      projectDir = path.isAbsolute(arg) ? arg : path.resolve(cwd, arg);
    }
  }

  const result = detectPipelinePacks(projectDir);
  for (const pack of result.matched) {
    process.stderr.write(`[PACK-DETECT] 匹配: ${pack.name} (priority=${pack.priority})\n`);
  }

  if (jsonOutput) {
    process.stdout.write(
      `${JSON.stringify({
        detected: result.detected.name,
        matched: result.matched.map((pack) => pack.name),
        reason: result.matched.length === 0 ? 'no pack matched' : undefined
      })}\n`
    );
  } else {
    process.stdout.write(`${result.detected.name}\n`);
  }
  return 0;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  process.exit(main(process.argv.slice(2), { cwd: process.cwd() }));
}
