import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { parseTranscriptLines, summarizeTranscript, type TranscriptUsage } from '../skills/transcript-parser.js';

export interface EvalCase {
  id: string;
  prompt: string;
  feature: string;
  transcript: string;
  requiredArtifacts: string[];
  requiredBehaviors: string[];
  metrics: {
    maxCostUsd: number;
    maxDurationSeconds: number;
    minArtifactCompleteness: number;
  };
}

export interface EvalReport {
  id: string;
  passed: boolean;
  artifactCompleteness: number;
  requiredArtifactsPresent: string[];
  missingArtifacts: string[];
  behaviorResults: Record<string, boolean>;
  usage: TranscriptUsage;
  estimatedCostUsd: number;
  durationSeconds: number | null;
  failures: string[];
}

function readJson<T>(filePath: string): T {
  return JSON.parse(fs.readFileSync(filePath, 'utf8')) as T;
}

export function loadEvalCase(casePath: string): EvalCase {
  const data = readJson<EvalCase>(casePath);
  if (!data.id || !data.feature || !Array.isArray(data.requiredArtifacts)) {
    throw new Error(`Invalid eval case: ${casePath}`);
  }
  return data;
}

function artifactPath(caseDir: string, evalCase: EvalCase, artifact: string): string {
  return path.join(caseDir, 'workspace', '.boss', evalCase.feature, artifact);
}

function readArtifact(caseDir: string, evalCase: EvalCase, artifact: string): string {
  const filePath = artifactPath(caseDir, evalCase, artifact);
  return fs.existsSync(filePath) ? fs.readFileSync(filePath, 'utf8') : '';
}

function loadTranscript(caseDir: string, evalCase: EvalCase) {
  const transcriptPath = path.join(caseDir, evalCase.transcript);
  return parseTranscriptLines(fs.readFileSync(transcriptPath, 'utf8').split(/\r?\n/));
}

function estimateCostUsd(usage: TranscriptUsage): number {
  const inputCost = (usage.inputTokens + usage.cacheCreationInputTokens + usage.cacheReadInputTokens) * 0.000003;
  const outputCost = usage.outputTokens * 0.000015;
  return Number((inputCost + outputCost).toFixed(6));
}

function readDurationSeconds(caseDir: string, evalCase: EvalCase): number | null {
  const executionPath = path.join(caseDir, 'workspace', '.boss', evalCase.feature, '.meta', 'execution.json');
  if (!fs.existsSync(executionPath)) return null;
  const execution = readJson<{ metrics?: { totalDuration?: unknown } }>(executionPath);
  return typeof execution.metrics?.totalDuration === 'number' ? execution.metrics.totalDuration : null;
}

function commandStrings(transcript: ReturnType<typeof loadTranscript>): string[] {
  return transcript.toolCalls
    .map((call) => call.input.command)
    .filter((value): value is string => typeof value === 'string');
}

function hasQaEvidence(caseDir: string, evalCase: EvalCase): boolean {
  const qaReport = readArtifact(caseDir, evalCase, 'qa-report.md');
  return /未验证|unverified|replay|evidence/i.test(qaReport);
}

function evaluateBehavior(
  behavior: string,
  context: {
    summary: ReturnType<typeof summarizeTranscript>;
    transcript: ReturnType<typeof loadTranscript>;
    caseDir: string;
    evalCase: EvalCase;
  }
): boolean {
  if (behavior === 'uses-boss-skill') {
    return context.summary.skills.includes('boss');
  }
  if (behavior === 'runs-tests') {
    return commandStrings(context.transcript).some((command) => /\b(?:npm|pnpm|yarn|bun|pytest|go)\s+test\b/.test(command));
  }
  if (behavior === 'records-qa-evidence') {
    return hasQaEvidence(context.caseDir, context.evalCase);
  }
  if (behavior === 'produces-evidence-wave') {
    const tasks = readArtifact(context.caseDir, context.evalCase, 'tasks.md');
    return /Evidence Wave/i.test(tasks) && /Contract Matrix/i.test(tasks);
  }
  return false;
}

export function evaluateEvalCase(casePath: string): EvalReport {
  const caseDir = path.dirname(casePath);
  const evalCase = loadEvalCase(casePath);
  const transcript = loadTranscript(caseDir, evalCase);
  const summary = summarizeTranscript(transcript);
  const requiredArtifactsPresent = evalCase.requiredArtifacts.filter((artifact) =>
    fs.existsSync(artifactPath(caseDir, evalCase, artifact))
  );
  const missingArtifacts = evalCase.requiredArtifacts.filter((artifact) => !requiredArtifactsPresent.includes(artifact));
  const artifactCompleteness = Number((requiredArtifactsPresent.length / evalCase.requiredArtifacts.length).toFixed(2));
  const behaviorResults = Object.fromEntries(
    evalCase.requiredBehaviors.map((behavior) => [
      behavior,
      evaluateBehavior(behavior, { summary, transcript, caseDir, evalCase })
    ])
  );
  const usage = summary.usage;
  const estimatedCostUsd = estimateCostUsd(usage);
  const durationSeconds = readDurationSeconds(caseDir, evalCase);
  const failures: string[] = [
    ...missingArtifacts.map((artifact) => `missing artifact: ${artifact}`),
    ...Object.entries(behaviorResults)
      .filter(([, passed]) => !passed)
      .map(([behavior]) => `behavior failed: ${behavior}`)
  ];

  if (artifactCompleteness < evalCase.metrics.minArtifactCompleteness) {
    failures.push(`artifact completeness below threshold: ${artifactCompleteness}`);
  }
  if (estimatedCostUsd > evalCase.metrics.maxCostUsd) {
    failures.push(`cost above threshold: ${estimatedCostUsd}`);
  }
  if (durationSeconds != null && durationSeconds > evalCase.metrics.maxDurationSeconds) {
    failures.push(`duration above threshold: ${durationSeconds}`);
  }

  return {
    id: evalCase.id,
    passed: failures.length === 0,
    artifactCompleteness,
    requiredArtifactsPresent,
    missingArtifacts,
    behaviorResults,
    usage,
    estimatedCostUsd,
    durationSeconds,
    failures
  };
}

function parseCliArgs(argv: string[]): string[] {
  const casePaths: string[] = [];
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index]!;
    if (arg === '--case') {
      casePaths.push(argv[++index] ?? '');
      continue;
    }
    throw new Error(`Unknown option: ${arg}`);
  }
  return casePaths.filter(Boolean);
}

const currentFile = fileURLToPath(import.meta.url);
const isCliExecution = process.argv.some((arg) => arg.endsWith('eval-runner.ts') && path.resolve(arg) === currentFile);
if (isCliExecution) {
  try {
    const casePaths = parseCliArgs(process.argv.slice(2));
    if (casePaths.length === 0) {
      throw new Error('Missing --case');
    }
    const reports = casePaths.map((casePath) => evaluateEvalCase(casePath));
    process.stdout.write(`${JSON.stringify({ reports, passed: reports.every((report) => report.passed) }, null, 2)}\n`);
    process.exit(reports.every((report) => report.passed) ? 0 : 1);
  } catch (err) {
    process.stderr.write(`${err instanceof Error ? err.message : String(err)}\n`);
    process.exit(1);
  }
}
