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
  printRuntimeHelp,
  requireInputString,
  toFeatureNotFoundError,
  writeActionPlan
} from './lib/agent-command-utils.js';
import { recordArtifact } from './lib/pipeline-runtime.js';

interface RecordArtifactInput {
  feature: string;
  artifact: string;
  stage: string;
}

function showHelp(): void {
  printRuntimeHelp('record-artifact', 'boss runtime record-artifact FEATURE ARTIFACT STAGE [options]');
}

function parseFlatInput(argv: string[]): RecordArtifactInput {
  let feature = '';
  let artifact = '';
  let stage = '';
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index]!;
    const contractOptionEnd = consumeCliContractOption(argv, index);
    if (contractOptionEnd !== null) {
      index = contractOptionEnd;
      continue;
    }
    if (arg.startsWith('-')) throw new Error(`未知选项: ${arg}`);
    if (!feature) feature = arg;
    else if (!artifact) artifact = arg;
    else if (!stage) stage = arg;
    else throw new Error(`多余的参数: ${arg}`);
  }
  return {
    feature: requireInputString(feature, 'feature'),
    artifact: requireInputString(artifact, 'artifact'),
    stage: requireInputString(stage, 'stage')
  };
}

function resolveInput(argv: string[], context: CliContext): RecordArtifactInput {
  const jsonInput = readJsonInput(context.values.jsonInput);
  if (jsonInput) {
    const input = jsonInput as Record<string, unknown>;
    return {
      feature: requireInputString(input.feature, 'feature'),
      artifact: requireInputString(input.artifact, 'artifact'),
      stage: requireInputString(input.stage, 'stage')
    };
  }
  return parseFlatInput(argv);
}

function actionFor(input: RecordArtifactInput) {
  return {
    type: 'record_artifact',
    feature: input.feature,
    artifact: input.artifact,
    stage: Number(input.stage)
  };
}

export function main(argv: string[] = process.argv.slice(2), { cwd = process.cwd() }: { cwd?: string } = {}): number {
  const context = createCliContext(argv, { command: 'boss runtime record-artifact' });
  if (context.values.describe) {
    writeOutput(
      describeCommand(runtimeCommandDescriptions['record-artifact']!),
      context,
      () => `${JSON.stringify(runtimeCommandDescriptions['record-artifact'], null, 2)}\n`
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
    const execution = recordArtifact(input.feature, input.artifact, Number(input.stage), { cwd });
    const stageKey = String(input.stage);
    const artifacts =
      execution.stages && execution.stages[stageKey] ? execution.stages[stageKey]!.artifacts : [];
    writeOutput(
      {
        feature: input.feature,
        artifact: input.artifact,
        stage: Number(input.stage),
        artifacts
      },
      context,
      () => `${JSON.stringify({ feature: input.feature, artifact: input.artifact, stage: Number(input.stage), artifacts }, null, 2)}\n`
    );
    return 0;
  } catch (err) {
    throw toFeatureNotFoundError(err, input.feature);
  }
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const context = createCliContext(process.argv.slice(2), { command: 'boss runtime record-artifact', validateOptionValues: false });
  process.exit(await runMain(() => main(process.argv.slice(2), { cwd: process.cwd() }), context));
}
