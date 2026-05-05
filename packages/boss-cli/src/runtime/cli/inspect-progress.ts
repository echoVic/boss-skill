#!/usr/bin/env node
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  CliUserError,
  createCliContext,
  describeCommand,
  parseLimit,
  runMain,
  writeOutput
} from '../../cli/contract.js';
import { runtimeCommandDescriptions } from '../../cli/command-registry.js';
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

  const parsed = { feature: '', json: false, limit: undefined as string | undefined, type: '' };

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index]!;
    if (arg === '--json') {
      parsed.json = true;
      continue;
    }
    if (arg === '--limit') {
      parsed.limit = argv[index + 1];
      index += 1;
      continue;
    }
    if (arg === '--type') {
      parsed.type = argv[index + 1] || '';
      index += 1;
      continue;
    }
    if (arg.startsWith('-')) {
      if (arg === '--describe' || arg === '--dry-run') {
        continue;
      }
      if (arg === '--fields' || arg === '--json-input') {
        if (argv[index + 1] && !argv[index + 1]!.startsWith('-')) index += 1;
        continue;
      }
      if (arg.startsWith('--limit=')) {
        parsed.limit = arg.slice('--limit='.length);
        continue;
      }
      if (arg.startsWith('--type=')) {
        parsed.type = arg.slice('--type='.length);
        continue;
      }
      if (arg.startsWith('--fields=') || arg.startsWith('--json-input=')) {
        continue;
      }
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

function renderText(payload: ReturnType<typeof inspectProgress>): string {
  return `${payload.events.map((event) => `${event.timestamp} ${event.type}`).join('\n')}${payload.events.length ? '\n' : ''}`;
}

function toFeatureNotFoundError(err: unknown, feature: string): unknown {
  const message = err instanceof Error ? err.message : String(err);
  if (message.includes('未找到执行文件') || message.includes('未找到事件文件')) {
    return new CliUserError({
      code: 'feature_not_found',
      message,
      input: { feature },
      retryable: false,
      suggestion: 'Run boss runtime init-pipeline <feature> first'
    });
  }
  return err;
}

export function main(argv: string[] = process.argv.slice(2), { cwd = process.cwd() }: { cwd?: string } = {}): number {
  const context = createCliContext(argv, { command: 'boss runtime inspect-progress' });
  if (context.values.describe) {
    writeOutput(
      describeCommand(runtimeCommandDescriptions['inspect-progress']!),
      context,
      () => `${JSON.stringify(runtimeCommandDescriptions['inspect-progress'], null, 2)}\n`
    );
    return 0;
  }

  const parsed = parseArgs(argv);
  if ('help' in parsed) {
    printHelp();
    return 0;
  }

  try {
    const payload = inspectProgress(parsed.feature, {
      cwd,
      limit: parseLimit(parsed.limit ?? '20'),
      type: parsed.type
    });
    writeOutput(payload, context, (data) => renderText(data as ReturnType<typeof inspectProgress>));
    return 0;
  } catch (err) {
    throw toFeatureNotFoundError(err, parsed.feature);
  }
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const context = createCliContext(process.argv.slice(2), { command: 'boss runtime inspect-progress' });
  process.exit(await runMain(() => main(process.argv.slice(2), { cwd: process.cwd() }), context));
}
