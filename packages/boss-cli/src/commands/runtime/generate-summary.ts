#!/usr/bin/env node
import * as fs from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  CliUserError,
  consumeCliContractOption,
  createCliContext,
  describeCommand,
  runMain,
  writeOutput
} from '../../cli/contract.js';
import { runtimeCommandDescriptions } from '../../cli/registry.js';
import { printRuntimeHelp } from './agent-command-utils.js';
import { renderJson } from '../../runtime/report/render-json.js';
import { renderMarkdown } from '../../runtime/report/render-markdown.js';
import { buildSummaryModel } from '../../runtime/report/summary-model.js';

function printHelp(): void {
  printRuntimeHelp('generate-summary', 'boss runtime generate-summary FEATURE [options]');
}

export function parseArgs(argv: string[]) {
  if (argv.length === 0 || argv.includes('-h') || argv.includes('--help')) {
    return { help: true } as const;
  }

  const parsed = {
    feature: '',
    json: false,
    stdout: false
  };

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index]!;
    if (arg === '--json') {
      parsed.json = true;
      continue;
    }
    if (arg === '--stdout') {
      parsed.stdout = true;
      continue;
    }
    const contractOptionEnd = consumeCliContractOption(argv, index);
    if (contractOptionEnd !== null) {
      index = contractOptionEnd;
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
  if (message.includes('未找到执行文件')) {
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
  const context = createCliContext(argv, { command: 'boss runtime generate-summary' });
  if (context.values.describe) {
    writeOutput(
      describeCommand(runtimeCommandDescriptions['generate-summary']!),
      context,
      () => `${JSON.stringify(runtimeCommandDescriptions['generate-summary'], null, 2)}\n`
    );
    return 0;
  }

  const parsed = parseArgs(argv);
  if ('help' in parsed) {
    printHelp();
    return 0;
  }

  const format = parsed.json ? 'json' : 'markdown';
  const relativeOutputPath = path.posix.join(
    '.boss',
    parsed.feature,
    parsed.json ? 'summary-report.json' : 'summary-report.md'
  );
  const outputPath = path.join(cwd, '.boss', parsed.feature, parsed.json ? 'summary-report.json' : 'summary-report.md');

  try {
    if (context.values.dryRun && !parsed.stdout) {
      writeOutput(
        {
          actions: [{ type: 'write_file', path: relativeOutputPath, format }],
          risk_tier: 'medium',
          requires_approval: false
        },
        context,
        () => `would write ${relativeOutputPath}\n`
      );
      return 0;
    }

    const model = buildSummaryModel(parsed.feature, { cwd });
    const rendered = parsed.json ? renderJson(model) : renderMarkdown(model);

    if (parsed.stdout) {
      process.stdout.write(rendered);
      return 0;
    }

    fs.writeFileSync(outputPath, rendered, 'utf8');
    writeOutput(
      { feature: parsed.feature, outputPath: relativeOutputPath, format },
      context,
      () => `报告已生成: ${outputPath}\n`
    );
    return 0;
  } catch (err) {
    throw toFeatureNotFoundError(err, parsed.feature);
  }
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const context = createCliContext(process.argv.slice(2), { command: 'boss runtime generate-summary', validateOptionValues: false });
  process.exit(await runMain(() => main(process.argv.slice(2), { cwd: process.cwd() }), context));
}
