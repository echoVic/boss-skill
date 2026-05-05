#!/usr/bin/env node
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';

import { inspectProgress } from './lib/inspection-runtime.js';

function printHelp(): void {
  process.stdout.write(
    [
      'Boss Harness - 进度诊断',
      '',
      '用法: inspect-progress.js <feature> [options]',
      '',
      '选项:',
      '  --json            输出 JSON',
      '  --limit <n>       返回最近 n 条进度事件（默认 20）',
      '  --type <type>     仅返回指定类型',
      '  -h, --help        查看帮助',
      ''
    ].join('\n')
  );
}

export function parseArgs(argv: string[]) {
  if (argv.length === 0 || argv.includes('-h') || argv.includes('--help')) {
    return { help: true } as const;
  }

  const parsed = { feature: '', json: false, limit: 20, type: '' };

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index]!;
    if (arg === '--json') {
      parsed.json = true;
      continue;
    }
    if (arg === '--limit') {
      parsed.limit = Number(argv[index + 1]);
      index += 1;
      continue;
    }
    if (arg === '--type') {
      parsed.type = argv[index + 1] || '';
      index += 1;
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

function renderText(payload: ReturnType<typeof inspectProgress>): void {
  for (const event of payload.events) {
    process.stdout.write(`${event.timestamp} ${event.type}\n`);
  }
}

export function main(argv: string[] = process.argv.slice(2), { cwd = process.cwd() }: { cwd?: string } = {}): number {
  const parsed = parseArgs(argv);
  if ('help' in parsed) {
    printHelp();
    return 0;
  }

  const payload = inspectProgress(parsed.feature, {
    cwd,
    limit: parsed.limit,
    type: parsed.type
  });

  if (parsed.json) {
    process.stdout.write(`${JSON.stringify(payload)}\n`);
  } else {
    renderText(payload);
  }
  return 0;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    process.exit(main(process.argv.slice(2), { cwd: process.cwd() }));
  } catch (err) {
    process.stderr.write(`${(err as Error).message}\n`);
    process.exit(1);
  }
}
