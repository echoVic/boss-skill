#!/usr/bin/env node
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';

import { rebuildFeatureMemory } from './lib/memory-runtime.js';

function printHelp(): void {
  process.stdout.write(
    [
      'Boss Harness - 提炼 feature memory',
      '',
      '用法: extract-memory.js <feature>',
      ''
    ].join('\n')
  );
}

export function main(argv: string[] = process.argv.slice(2), { cwd = process.cwd() }: { cwd?: string } = {}): number {
  const feature = argv[0];
  if (!feature || feature === '--help' || feature === '-h') {
    printHelp();
    return feature ? 0 : 1;
  }

  try {
    const payload = rebuildFeatureMemory(feature, { cwd });
    process.stdout.write(`${JSON.stringify({ feature, count: payload.records.length })}\n`);
    return 0;
  } catch (err) {
    process.stderr.write(`${(err as Error).message}\n`);
    return 1;
  }
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  process.exit(main(process.argv.slice(2), { cwd: process.cwd() }));
}
