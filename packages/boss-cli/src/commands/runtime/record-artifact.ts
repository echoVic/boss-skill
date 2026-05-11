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
import { runtimeCommandDescriptions } from '../../cli/registry.js';
import {
  printRuntimeHelp,
  requireInputString,
  toFeatureNotFoundError,
  writeActionPlan
} from './agent-command-utils.js';
import { recordArtifact, recordArtifacts } from '../../runtime/application/pipeline.js';
import { writeArtifactHtmlCompanion } from '../../runtime/report/render-artifact-html.js';

interface RecordArtifactInput {
  feature: string;
  artifact: string;
  stage: string;
  noOpen: boolean;
}

function showHelp(): void {
  printRuntimeHelp('record-artifact', 'boss runtime record-artifact FEATURE ARTIFACT STAGE [options]');
}

function parseFlatInput(argv: string[]): RecordArtifactInput {
  let feature = '';
  let artifact = '';
  let stage = '';
  let noOpen = false;
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index]!;
    const contractOptionEnd = consumeCliContractOption(argv, index);
    if (contractOptionEnd !== null) {
      index = contractOptionEnd;
      continue;
    }
    if (arg === '--no-open') {
      noOpen = true;
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
    stage: requireInputString(stage, 'stage'),
    noOpen
  };
}

function resolveInput(argv: string[], context: CliContext): RecordArtifactInput {
  const jsonInput = readJsonInput(context.values.jsonInput);
  if (jsonInput) {
    const input = jsonInput as Record<string, unknown>;
    return {
      feature: requireInputString(input.feature, 'feature'),
      artifact: requireInputString(input.artifact, 'artifact'),
      stage: requireInputString(input.stage, 'stage'),
      noOpen: input.noOpen === true || input['no-open'] === true
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

function isMarkdownArtifact(artifact: string): boolean {
  return artifact.endsWith('.md');
}

function htmlArtifactFor(markdownArtifact: string): string {
  return markdownArtifact.replace(/\.md$/, '.html');
}

function validateMarkdownArtifactName(artifact: string): void {
  if (
    !isMarkdownArtifact(artifact) ||
    artifact !== path.basename(artifact) ||
    artifact.includes('/') ||
    artifact.includes('\\') ||
    artifact.includes('..')
  ) {
    throw new Error(`无效 Markdown 产物: ${artifact}`);
  }
}

function markdownPathFor(input: RecordArtifactInput, cwd: string): string {
  validateMarkdownArtifactName(input.artifact);
  const featureDir = path.resolve(cwd, '.boss', input.feature);
  const markdownPath = path.resolve(featureDir, input.artifact);
  if (path.dirname(markdownPath) !== featureDir) {
    throw new Error(`无效 Markdown 产物: ${input.artifact}`);
  }
  return markdownPath;
}

function actionsFor(input: RecordArtifactInput) {
  if (!isMarkdownArtifact(input.artifact)) {
    return [actionFor(input)];
  }
  validateMarkdownArtifactName(input.artifact);
  const htmlArtifact = htmlArtifactFor(input.artifact);
  return [
    actionFor(input),
    {
      type: 'write_file',
      path: path.posix.join('.boss', input.feature, htmlArtifact),
      format: 'html'
    },
    {
      type: 'record_artifact',
      feature: input.feature,
      artifact: htmlArtifact,
      stage: Number(input.stage)
    }
  ];
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
    writeActionPlan(actionsFor(input), context, 'medium');
    return 0;
  }

  try {
    let htmlArtifact: string | undefined;
    let htmlPath: string | undefined;
    let markdown: string | undefined;

    if (isMarkdownArtifact(input.artifact)) {
      const markdownPath = markdownPathFor(input, cwd);
      if (!fs.existsSync(markdownPath)) {
        throw new Error(`未找到 Markdown 产物: ${path.relative(cwd, markdownPath)}`);
      }
      markdown = fs.readFileSync(markdownPath, 'utf8');
    }

    let execution;

    if (markdown !== undefined) {
      htmlArtifact = writeArtifactHtmlCompanion({
        cwd,
        feature: input.feature,
        sourceArtifact: input.artifact,
        markdown
      });
      htmlPath = path.posix.join('.boss', input.feature, htmlArtifact);
      execution = recordArtifacts(input.feature, [input.artifact, htmlArtifact], Number(input.stage), { cwd });
    } else {
      execution = recordArtifact(input.feature, input.artifact, Number(input.stage), { cwd });
    }

    const stageKey = String(input.stage);
    const artifacts =
      execution.stages && execution.stages[stageKey] ? execution.stages[stageKey]!.artifacts : [];
    const previewCommand =
      input.artifact === 'ui-design.json'
        ? `boss design preview ${input.feature}${input.noOpen ? ' --no-open' : ''}`
        : undefined;
    const payload = {
      feature: input.feature,
      artifact: input.artifact,
      stage: Number(input.stage),
      artifacts,
      previewCommand,
      ...(htmlArtifact ? { htmlArtifact, htmlPath } : {})
    };
    writeOutput(
      payload,
      context,
      () => `${JSON.stringify(payload, null, 2)}\n${previewCommand ? `Preview: ${previewCommand}\n` : ''}`
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
