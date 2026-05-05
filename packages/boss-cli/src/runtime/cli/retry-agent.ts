#!/usr/bin/env node
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  assertConfirmed,
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
  toFeatureNotFoundError,
  writeActionPlan
} from './lib/agent-command-utils.js';
import { retryAgent } from './lib/pipeline-runtime.js';

interface RetryAgentInput {
  feature: string;
  stage: string;
  agent: string;
}

function showHelp(): void {
  process.stderr.write(
    [
      'Boss Harness - Agent 重试',
      '',
      '用法: retry-agent.js <feature> <stage> <agent-name>',
      '',
      '选项:',
      '  --dry-run             预览变更而不写入',
      '  -y, --yes             确认执行高风险重试',
      '  --json-input <json|-> 从 JSON 字符串或 stdin 读取输入',
      ''
    ].join('\n')
  );
}

function parseFlatInput(argv: string[]): RetryAgentInput {
  let feature = '';
  let stage = '';
  let agent = '';
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index]!;
    const contractOptionEnd = consumeCliContractOption(argv, index);
    if (contractOptionEnd !== null) {
      index = contractOptionEnd;
      continue;
    }
    if (arg.startsWith('-')) throw new Error(`未知选项: ${arg}`);
    if (!feature) feature = arg;
    else if (!stage) stage = arg;
    else if (!agent) agent = arg;
    else throw new Error(`多余的参数: ${arg}`);
  }
  return {
    feature: requireInputString(feature, 'feature'),
    stage: requireInputString(stage, 'stage'),
    agent: requireInputString(agent, 'agent')
  };
}

function resolveInput(argv: string[], context: CliContext): RetryAgentInput {
  const jsonInput = readJsonInput(context.values.jsonInput);
  if (jsonInput) {
    const input = jsonInput as Record<string, unknown>;
    return {
      feature: requireInputString(input.feature, 'feature'),
      stage: requireInputString(input.stage, 'stage'),
      agent: requireInputString(input.agent, 'agent')
    };
  }
  return parseFlatInput(argv);
}

function actionFor(input: RetryAgentInput) {
  return {
    type: 'retry_agent',
    feature: input.feature,
    stage: Number(input.stage),
    agent: input.agent
  };
}

export function main(argv: string[] = process.argv.slice(2), { cwd = process.cwd() }: { cwd?: string } = {}): number {
  const context = createCliContext(argv, { command: 'boss runtime retry-agent' });
  if (context.values.describe) {
    writeOutput(
      describeCommand(runtimeCommandDescriptions['retry-agent']!),
      context,
      () => `${JSON.stringify(runtimeCommandDescriptions['retry-agent'], null, 2)}\n`
    );
    return 0;
  }

  if (argv.length === 0 || argv.includes('-h') || argv.includes('--help')) {
    showHelp();
    return argv.length === 0 ? 1 : 0;
  }

  const input = resolveInput(argv, context);
  if (context.values.dryRun) {
    writeActionPlan([actionFor(input)], context, 'high');
    return 0;
  }

  assertConfirmed(context, 'retry_agent');

  try {
    const state = retryAgent(input.feature, Number(input.stage), input.agent, { cwd });
    const agentState = state.stages?.[input.stage]?.agents?.[input.agent];
    writeOutput(
      {
        feature: input.feature,
        stage: Number(input.stage),
        agent: input.agent,
        status: agentState?.status,
        retryCount: agentState?.retryCount
      },
      context,
      () => `${JSON.stringify({ feature: input.feature, stage: Number(input.stage), agent: input.agent, status: agentState?.status, retryCount: agentState?.retryCount }, null, 2)}\n`
    );
    return 0;
  } catch (err) {
    throw toFeatureNotFoundError(err, input.feature);
  }
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const context = createCliContext(process.argv.slice(2), { command: 'boss runtime retry-agent', validateOptionValues: false });
  process.exit(await runMain(() => main(process.argv.slice(2), { cwd: process.cwd() }), context));
}
