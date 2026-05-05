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
import { buildFeatureSummary } from './lib/memory-runtime.js';

function printHelp(): void {
  process.stdout.write(
    [
      'Boss Harness - 构建 memory summary',
      '',
      '用法: build-memory-summary.js <feature>',
      ''
    ].join('\n')
  );
}

export function main(argv: string[] = process.argv.slice(2), { cwd = process.cwd() }: { cwd?: string } = {}): number {
  const context = createCliContext(argv, { command: 'boss runtime build-memory-summary' });
  if (context.values.describe) {
    writeOutput(
      describeCommand(runtimeCommandDescriptions['build-memory-summary']!),
      context,
      () => `${JSON.stringify(runtimeCommandDescriptions['build-memory-summary'], null, 2)}\n`
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

  const payload = buildFeatureSummary(feature, { cwd });
  writeOutput(payload, context, () => `${JSON.stringify(payload, null, 2)}\n`);
  return 0;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const context = createCliContext(process.argv.slice(2), { command: 'boss runtime build-memory-summary' });
  process.exit(await runMain(() => main(process.argv.slice(2), { cwd: process.cwd() }), context));
}
