#!/usr/bin/env node
import * as fs from 'node:fs';
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
  printRuntimeHelp,
  requireInputString,
  requireOptionValue,
  toFeatureNotFoundError,
  writeActionPlan
} from './lib/agent-command-utils.js';
import { updateStage } from './lib/pipeline-runtime.js';

interface UpdateStageInput {
  feature: string;
  stage: string;
  status: string;
  reason?: string;
  artifacts: string[];
  gate?: string;
  gatePassed?: boolean | null;
}

function showHelp(): void {
  printRuntimeHelp('update-stage', 'boss runtime update-stage FEATURE STAGE STATUS [options]');
}

function readCurrentStatus(cwd: string, feature: string, stage: string): string {
  const execPath = path.join(cwd, '.boss', feature, '.meta', 'execution.json');
  if (!fs.existsSync(execPath)) return 'unknown';
  try {
    const execution = JSON.parse(fs.readFileSync(execPath, 'utf8')) as {
      stages?: Record<string, { status?: string }>;
    };
    const stageState = execution.stages ? execution.stages[String(stage)] : null;
    return stageState && stageState.status ? stageState.status : 'unknown';
  } catch {
    return 'unknown';
  }
}

function parseFlatInput(argv: string[]): UpdateStageInput {
  let feature = '';
  let stage = '';
  let status = '';
  let reason: string | undefined;
  const artifacts: string[] = [];
  let gate: string | undefined;
  let gatePassed: boolean | null = null;

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index]!;
    switch (arg) {
      case '--reason':
        reason = requireOptionValue('--reason', argv[index + 1]);
        index += 1;
        continue;
      case '--artifact':
        artifacts.push(requireOptionValue('--artifact', argv[index + 1]));
        index += 1;
        continue;
      case '--gate':
        gate = requireOptionValue('--gate', argv[index + 1]);
        index += 1;
        continue;
      case '--gate-passed':
        gatePassed = true;
        continue;
      case '--gate-failed':
        gatePassed = false;
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
    if (!feature) {
      feature = arg;
    } else if (!stage) {
      stage = arg;
    } else if (!status) {
      status = arg;
    } else {
      throw new Error(`多余的参数: ${arg}`);
    }
  }

  return {
    feature: requireInputString(feature, 'feature'),
    stage: requireInputString(stage, 'stage'),
    status: requireInputString(status, 'status'),
    reason,
    artifacts,
    gate,
    gatePassed
  };
}

function resolveInput(argv: string[], context: CliContext): UpdateStageInput {
  const jsonInput = readJsonInput(context.values.jsonInput);
  if (jsonInput) {
    const input = jsonInput as Record<string, unknown>;
    return {
      feature: requireInputString(input.feature, 'feature'),
      stage: requireInputString(input.stage, 'stage'),
      status: requireInputString(input.status, 'status'),
      reason: optionalInputString(input.reason),
      artifacts: Array.isArray(input.artifacts) ? input.artifacts.map(String) : [],
      gate: optionalInputString(input.gate),
      gatePassed: typeof input.gatePassed === 'boolean' ? input.gatePassed : null
    };
  }
  return parseFlatInput(argv);
}

function actionFor(input: UpdateStageInput) {
  return {
    type: 'update_stage',
    feature: input.feature,
    stage: Number(input.stage),
    target_status: input.status,
    artifacts: input.artifacts,
    gate: input.gate,
    gatePassed: input.gatePassed
  };
}

export function main(argv: string[] = process.argv.slice(2), { cwd = process.cwd() }: { cwd?: string } = {}): number {
  const context = createCliContext(argv, { command: 'boss runtime update-stage' });
  if (context.values.describe) {
    writeOutput(
      describeCommand(runtimeCommandDescriptions['update-stage']!),
      context,
      () => `${JSON.stringify(runtimeCommandDescriptions['update-stage'], null, 2)}\n`
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
    const currentStatus = readCurrentStatus(cwd, input.feature, input.stage);
    updateStage(input.feature, input.stage, input.status, {
      cwd,
      reason: input.reason || '',
      artifacts: input.artifacts,
      gate: input.gate || '',
      gatePassed: input.gatePassed ?? null
    });

    writeOutput(
      {
        feature: input.feature,
        stage: Number(input.stage),
        previousStatus: currentStatus,
        status: input.status,
        executionPath: `.boss/${input.feature}/.meta/execution.json`
      },
      context,
      () => `阶段 ${input.stage}: ${currentStatus} -> ${input.status}\n文件: .boss/${input.feature}/.meta/execution.json\n`
    );
    return 0;
  } catch (err) {
    throw toFeatureNotFoundError(err, input.feature);
  }
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const context = createCliContext(process.argv.slice(2), { command: 'boss runtime update-stage', validateOptionValues: false });
  process.exit(await runMain(() => main(process.argv.slice(2), { cwd: process.cwd() }), context));
}
