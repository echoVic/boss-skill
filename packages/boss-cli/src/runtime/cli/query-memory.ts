#!/usr/bin/env node
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  CliUserError,
  createCliContext,
  describeCommand,
  runMain,
  writeOutput
} from '../../cli/contract.js';
import { runtimeCommandDescriptions } from '../../cli/command-registry.js';
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
    if (arg === '--json' || arg === '--describe' || arg === '--dry-run') {
      parsed.json = true;
      continue;
    }
    if (arg === '--fields' || arg === '--limit' || arg === '--json-input') {
      continue;
    }
    if (arg.startsWith('--fields=') || arg.startsWith('--limit=') || arg.startsWith('--json-input=')) {
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
  const context = createCliContext(argv, { command: 'boss runtime query-memory' });
  if (context.values.describe) {
    writeOutput(
      describeCommand(runtimeCommandDescriptions['query-memory']!),
      context,
      () => `${JSON.stringify(runtimeCommandDescriptions['query-memory'], null, 2)}\n`
    );
    return 0;
  }

  let feature = '';
  try {
    const parsed = parseArgs(argv);
    if ('help' in parsed) {
      printHelp();
      return 0;
    }
    feature = parsed.feature;

    const summary = readFeatureSummary(parsed.feature, { cwd });
    const payload = parsed.startup
      ? { feature: parsed.feature, startupSummary: summary.startupSummary || [] }
      : summary;

    writeOutput(payload, context, () =>
      parsed.startup
        ? payload.startupSummary.map((item) => `- [${item.category}] ${item.summary}`).join('\n') + '\n'
        : `${JSON.stringify(payload, null, 2)}\n`
    );
    return 0;
  } catch (err) {
    throw toFeatureNotFoundError(err, feature);
  }
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const context = createCliContext(process.argv.slice(2), { command: 'boss runtime query-memory' });
  process.exit(await runMain(() => main(process.argv.slice(2), { cwd: process.cwd() }), context));
}
