#!/usr/bin/env node
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';

import { readFeatureSummary } from './lib/memory-runtime.js';

function printHelp(): void {
  process.stdout.write(
    [
      'Boss Harness - 查询 memory',
      '',
      '用法: query-memory.js <feature> [options]',
      '',
      '选项:',
      '  --startup         输出 startup summary',
      '  --json            输出 JSON',
      '  -h, --help        查看帮助',
      ''
    ].join('\n')
  );
}

export function parseArgs(argv: string[]) {
  if (argv.length === 0 || argv.includes('-h') || argv.includes('--help')) {
    return { help: true } as const;
  }

  const parsed = {
    feature: '',
    startup: false,
    json: false
  };

  for (const arg of argv) {
    if (arg === '--startup') {
      parsed.startup = true;
      continue;
    }
    if (arg === '--json') {
      parsed.json = true;
      continue;
    }
    if (arg.startsWith('-')) {
      throw new Error(`未知选项: ${arg}`);
    }
    if (!parsed.feature) {
      parsed.feature = arg;
      continue;
    }
    throw new Error(`多余的参数: ${arg}`);
  }

  if (!parsed.feature) {
    throw new Error('缺少 feature 参数');
  }

  return parsed;
}

export function main(argv: string[] = process.argv.slice(2), { cwd = process.cwd() }: { cwd?: string } = {}): number {
  try {
    const parsed = parseArgs(argv);
    if ('help' in parsed) {
      printHelp();
      return 0;
    }

    const summary = readFeatureSummary(parsed.feature, { cwd });
    const payload = parsed.startup
      ? { feature: parsed.feature, startupSummary: summary.startupSummary || [] }
      : summary;

    if (parsed.json) {
      process.stdout.write(`${JSON.stringify(payload)}\n`);
    } else if (parsed.startup) {
      for (const item of payload.startupSummary) {
        process.stdout.write(`- [${item.category}] ${item.summary}\n`);
      }
    } else {
      process.stdout.write(`${JSON.stringify(payload, null, 2)}\n`);
    }
    return 0;
  } catch (err) {
    process.stderr.write(`${(err as Error).message}\n`);
    return 1;
  }
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  process.exit(main(process.argv.slice(2), { cwd: process.cwd() }));
}
