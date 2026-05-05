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
  optionalInputString,
  requireInputString,
  requireOptionValue,
  toFeatureNotFoundError,
  writeActionPlan
} from './lib/agent-command-utils.js';
import { updateAgent } from './lib/pipeline-runtime.js';

interface UpdateAgentInput {
  feature: string;
  stage: string;
  agent: string;
  status: string;
  reason?: string;
}

function showHelp(): void {
  process.stderr.write(
    [
      'Boss Harness - Agent 状态更新',
      '',
      '用法: update-agent.js <feature> <stage> <agent-name> <status> [options]',
      '',
      '选项:',
      '  --reason <text>       失败原因（status=failed 时使用）',
      '  --dry-run             预览变更而不写入',
      '  --json-input <json|-> 从 JSON 字符串或 stdin 读取输入',
      '  --json                输出 JSON',
      ''
    ].join('\n')
  );
}

function parseFlatInput(argv: string[]): UpdateAgentInput {
  let feature = '';
  let stage = '';
  let agent = '';
  let status = '';
  let reason: string | undefined;

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index]!;
    if (arg === '--reason') {
      reason = requireOptionValue('--reason', argv[index + 1]);
      index += 1;
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
    if (!feature) feature = arg;
    else if (!stage) stage = arg;
    else if (!agent) agent = arg;
    else if (!status) status = arg;
    else throw new Error(`多余的参数: ${arg}`);
  }

  return {
    feature: requireInputString(feature, 'feature'),
    stage: requireInputString(stage, 'stage'),
    agent: requireInputString(agent, 'agent'),
    status: requireInputString(status, 'status'),
    reason
  };
}

function resolveInput(argv: string[], context: CliContext): UpdateAgentInput {
  const jsonInput = readJsonInput(context.values.jsonInput);
  if (jsonInput) {
    const input = jsonInput as Record<string, unknown>;
    return {
      feature: requireInputString(input.feature, 'feature'),
      stage: requireInputString(input.stage, 'stage'),
      agent: requireInputString(input.agent, 'agent'),
      status: requireInputString(input.status, 'status'),
      reason: optionalInputString(input.reason)
    };
  }
  return parseFlatInput(argv);
}

function actionFor(input: UpdateAgentInput) {
  return {
    type: 'update_agent',
    feature: input.feature,
    stage: Number(input.stage),
    agent: input.agent,
    target_status: input.status,
    reason: input.reason
  };
}

export function main(argv: string[] = process.argv.slice(2), { cwd = process.cwd() }: { cwd?: string } = {}): number {
  const context = createCliContext(argv, { command: 'boss runtime update-agent' });
  if (context.values.describe) {
    writeOutput(
      describeCommand(runtimeCommandDescriptions['update-agent']!),
      context,
      () => `${JSON.stringify(runtimeCommandDescriptions['update-agent'], null, 2)}\n`
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

  try {
    updateAgent(input.feature, input.stage, input.agent, input.status, { reason: input.reason || '', cwd });
    writeOutput(
      {
        feature: input.feature,
        stage: Number(input.stage),
        agent: input.agent,
        status: input.status
      },
      context,
      () => `Agent ${input.agent} (阶段 ${input.stage}): -> ${input.status}\n`
    );
    return 0;
  } catch (err) {
    throw toFeatureNotFoundError(err, input.feature);
  }
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const context = createCliContext(process.argv.slice(2), { command: 'boss runtime update-agent', validateOptionValues: false });
  process.exit(await runMain(() => main(process.argv.slice(2), { cwd: process.cwd() }), context));
}
