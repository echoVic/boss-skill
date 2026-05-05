#!/usr/bin/env node
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  consumeCliContractOption,
  createCliContext,
  describeCommand,
  readJsonInput,
  runMain,
  writeOutput,
  type CliContext
} from '../../cli/contract.js';
import { runtimeCommandDescriptions } from '../../cli/command-registry.js';
import {
  requireInputString,
  writeActionPlan
} from './lib/agent-command-utils.js';
import { initPipeline } from './lib/pipeline-runtime.js';

interface InitPipelineInput {
  feature: string;
}

function showHelp(): void {
  process.stderr.write(
    [
      'Boss Harness - 初始化流水线',
      '',
      '用法: init-pipeline.js <feature>',
      '',
      '选项:',
      '  --dry-run             预览变更而不写入',
      '  --json-input <json|-> 从 JSON 字符串或 stdin 读取输入',
      '  --json                输出 JSON',
      ''
    ].join('\n')
  );
}

function parseFlatInput(argv: string[]): InitPipelineInput {
  let feature = '';
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index]!;
    const contractOptionEnd = consumeCliContractOption(argv, index);
    if (contractOptionEnd !== null) {
      index = contractOptionEnd;
      continue;
    }
    if (arg.startsWith('-')) throw new Error(`未知选项: ${arg}`);
    if (!feature) feature = arg;
    else throw new Error(`多余的参数: ${arg}`);
  }
  return { feature: requireInputString(feature, 'feature') };
}

function resolveInput(argv: string[], context: CliContext): InitPipelineInput {
  const jsonInput = readJsonInput(context.values.jsonInput);
  if (jsonInput) {
    return { feature: requireInputString((jsonInput as Record<string, unknown>).feature, 'feature') };
  }
  return parseFlatInput(argv);
}

function actionFor(input: InitPipelineInput) {
  return {
    type: 'init_pipeline',
    feature: input.feature,
    path: `.boss/${input.feature}/.meta/execution.json`
  };
}

export function main(argv: string[] = process.argv.slice(2), { cwd = process.cwd() }: { cwd?: string } = {}): number {
  const context = createCliContext(argv, { command: 'boss runtime init-pipeline' });
  if (context.values.describe) {
    writeOutput(
      describeCommand(runtimeCommandDescriptions['init-pipeline']!),
      context,
      () => `${JSON.stringify(runtimeCommandDescriptions['init-pipeline'], null, 2)}\n`
    );
    return 0;
  }

  if (argv.length === 0 || argv.includes('-h') || argv.includes('--help')) {
    showHelp();
    return argv.length === 0 ? 1 : 0;
  }

  const input = resolveInput(argv, context);
  if (context.values.dryRun) {
    writeActionPlan([actionFor(input)], context, 'medium');
    return 0;
  }

  const execution = initPipeline(input.feature, { cwd });
  writeOutput(
    {
      feature: execution.feature,
      status: execution.status,
      executionPath: `.boss/${execution.feature}/.meta/execution.json`
    },
    context,
    () => `${JSON.stringify({ feature: execution.feature, status: execution.status, executionPath: `.boss/${execution.feature}/.meta/execution.json` }, null, 2)}\n`
  );
  return 0;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const context = createCliContext(process.argv.slice(2), { command: 'boss runtime init-pipeline', validateOptionValues: false });
  process.exit(await runMain(() => main(process.argv.slice(2), { cwd: process.cwd() }), context));
}
