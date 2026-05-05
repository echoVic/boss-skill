#!/usr/bin/env node
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  createCliContext,
  describeCommand,
  runMain,
  writeOutput
} from '../../cli/contract.js';
import { runtimeCommandDescriptions } from '../../cli/command-registry.js';
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
  const context = createCliContext(argv, { command: 'boss runtime extract-memory' });
  if (context.values.describe) {
    writeOutput(
      describeCommand(runtimeCommandDescriptions['extract-memory']!),
      context,
      () => `${JSON.stringify(runtimeCommandDescriptions['extract-memory'], null, 2)}\n`
    );
    return 0;
  }

  if (argv.includes('--help') || argv.includes('-h')) {
    printHelp();
    return 0;
  }

  const feature = context.positionals[0];
  if (!feature || feature === '--help' || feature === '-h') {
    printHelp();
    return feature ? 0 : 1;
  }

  const payload = rebuildFeatureMemory(feature, { cwd });
  writeOutput({ feature, count: payload.records.length }, context, () => `${JSON.stringify({ feature, count: payload.records.length }, null, 2)}\n`);
  return 0;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const context = createCliContext(process.argv.slice(2), { command: 'boss runtime extract-memory' });
  process.exit(await runMain(() => main(process.argv.slice(2), { cwd: process.cwd() }), context));
}
