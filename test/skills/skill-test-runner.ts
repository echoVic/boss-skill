import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  assertSkillBeforeActions,
  parseTranscriptLines,
  summarizeTranscript,
  type TranscriptUsage
} from './transcript-parser.js';

export interface SkillBehaviorCase {
  id: string;
  transcriptPath: string;
  requiredSkill: string;
  requiredMethodologySkills?: string[];
}

export interface SkillBehaviorReport {
  id: string;
  passed: boolean;
  requiredSkill: string;
  skillLoaded: boolean;
  noPrematureAction: boolean;
  methodologySkillsLoaded: string[];
  missingMethodologySkills: string[];
  firstSkillIndex: number;
  firstActionIndex: number;
  toolNames: string[];
  usage: TranscriptUsage;
  failures: string[];
}

export function evaluateTranscriptFile(testCase: SkillBehaviorCase): SkillBehaviorReport {
  const lines = fs.readFileSync(testCase.transcriptPath, 'utf8').split(/\r?\n/);
  const transcript = parseTranscriptLines(lines);
  const summary = summarizeTranscript(transcript);
  const order = assertSkillBeforeActions(transcript, testCase.requiredSkill);
  const requiredMethodologySkills = testCase.requiredMethodologySkills ?? [];
  const missingMethodologySkills = requiredMethodologySkills.filter(
    (skill) => !summary.methodologySkills.includes(skill)
  );
  const failures: string[] = [];
  const skillLoaded = transcript.skillCalls.some((call) => call.skill === testCase.requiredSkill);

  if (!skillLoaded) {
    failures.push(`missing required skill: ${testCase.requiredSkill}`);
  }
  if (!order.ok && order.reason) {
    failures.push(order.reason);
  }
  for (const skill of missingMethodologySkills) {
    failures.push(`missing methodology skill: ${skill}`);
  }

  return {
    id: testCase.id,
    passed: failures.length === 0,
    requiredSkill: testCase.requiredSkill,
    skillLoaded,
    noPrematureAction: order.ok,
    methodologySkillsLoaded: summary.methodologySkills,
    missingMethodologySkills,
    firstSkillIndex: order.firstSkillIndex,
    firstActionIndex: order.firstActionIndex,
    toolNames: summary.toolNames,
    usage: summary.usage,
    failures
  };
}

function parseCliArgs(argv: string[]): SkillBehaviorCase {
  let id = '';
  let transcriptPath = '';
  let requiredSkill = 'boss';
  const requiredMethodologySkills: string[] = [];

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index]!;
    if (arg === '--id') {
      id = argv[++index] ?? '';
      continue;
    }
    if (arg === '--transcript') {
      transcriptPath = argv[++index] ?? '';
      continue;
    }
    if (arg === '--skill') {
      requiredSkill = argv[++index] ?? '';
      continue;
    }
    if (arg === '--methodology') {
      requiredMethodologySkills.push(argv[++index] ?? '');
      continue;
    }
    throw new Error(`Unknown option: ${arg}`);
  }

  if (!id) throw new Error('Missing --id');
  if (!transcriptPath) throw new Error('Missing --transcript');
  if (!requiredSkill) throw new Error('Missing --skill');
  return {
    id,
    transcriptPath,
    requiredSkill,
    requiredMethodologySkills: requiredMethodologySkills.filter(Boolean)
  };
}

const currentFile = fileURLToPath(import.meta.url);
const isCliExecution = process.argv.some((arg) => {
  if (!arg.endsWith('skill-test-runner.ts')) return false;
  return path.resolve(arg) === currentFile;
});
if (isCliExecution) {
  try {
    const report = evaluateTranscriptFile(parseCliArgs(process.argv.slice(2)));
    process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
    process.exit(report.passed ? 0 : 1);
  } catch (err) {
    process.stderr.write(`${err instanceof Error ? err.message : String(err)}\n`);
    process.exit(1);
  }
}
