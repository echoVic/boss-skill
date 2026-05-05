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
import { inspectPipeline } from './lib/inspection-runtime.js';

function printHelp(): void {
  process.stdout.write(
    [
      'Boss Harness - 插件诊断',
      '',
      '用法: inspect-plugins.js <feature> [options]',
      '',
      '选项:',
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
    json: false
  };

  for (const arg of argv) {
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

function renderText(payload: {
  active: Array<{ name: string }>;
  discovered: Array<{ name: string }>;
  activated: Array<{ name: string }>;
  executed: unknown[];
  failed: unknown[];
}): string {
  return [
    `active: ${payload.active.map((plugin) => plugin.name).join(', ') || 'none'}`,
    `discovered: ${payload.discovered.map((plugin) => plugin.name).join(', ') || 'none'}`,
    `activated: ${payload.activated.map((plugin) => plugin.name).join(', ') || 'none'}`,
    `executed: ${payload.executed.length}`,
    `failed: ${payload.failed.length}`
  ].join('\n') + '\n';
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
  const context = createCliContext(argv, { command: 'boss runtime inspect-plugins' });
  if (context.values.describe) {
    writeOutput(
      describeCommand(runtimeCommandDescriptions['inspect-plugins']!),
      context,
      () => `${JSON.stringify(runtimeCommandDescriptions['inspect-plugins'], null, 2)}\n`
    );
    return 0;
  }

  const parsed = parseArgs(argv);
  if ('help' in parsed) {
    printHelp();
    return 0;
  }

  try {
    const summary = inspectPipeline(parsed.feature, { cwd });
    const payload = {
      feature: parsed.feature,
      active: summary.plugins.active,
      discovered: summary.plugins.discovered,
      activated: summary.plugins.activated,
      executed: summary.plugins.executed,
      failed: summary.plugins.failed
    };
    writeOutput(payload, context, (data) => renderText(data as typeof payload));
    return 0;
  } catch (err) {
    throw toFeatureNotFoundError(err, parsed.feature);
  }
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const context = createCliContext(process.argv.slice(2), { command: 'boss runtime inspect-plugins' });
  process.exit(await runMain(() => main(process.argv.slice(2), { cwd: process.cwd() }), context));
}
