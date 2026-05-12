import {
  inspectPipeline,
  readExecution,
  type ActiveAgentSummary,
  type FailureSummary
} from './inspection.js';
import { runQaAttack, type QaFinding } from './qa-attack.js';

const REQUIRED_ARTIFACTS = ['prd.md', 'architecture.md', 'tasks.md', 'qa-report.md'] as const;

export type FinalGateCheck =
  | {
      name: 'required-artifacts';
      passed: boolean;
      required: string[];
      recorded: string[];
      missing: string[];
    }
  | {
      name: 'no-active-agents';
      passed: boolean;
      activeAgents: ActiveAgentSummary[];
    }
  | {
      name: 'no-recent-failures';
      passed: boolean;
      recentFailures: FailureSummary[];
    }
  | {
      name: 'qa-attack-findings';
      passed: boolean;
      findings: QaFinding[];
    };

export interface FinalGateResult {
  feature: string;
  passed: boolean;
  checks: FinalGateCheck[];
}

function collectRecordedArtifacts(feature: string, cwd: string): string[] {
  const execution = readExecution(feature, cwd);
  const recorded = new Set<string>();
  for (const stage of Object.values(execution.stages ?? {})) {
    for (const artifact of stage?.artifacts ?? []) {
      if (artifact) recorded.add(artifact);
    }
  }
  return [...recorded].sort();
}

export function evaluateFinalGate(
  feature: string,
  { cwd = process.cwd() }: { cwd?: string } = {}
): FinalGateResult {
  const recorded = collectRecordedArtifacts(feature, cwd);
  const missing = REQUIRED_ARTIFACTS.filter((artifact) => !recorded.includes(artifact));
  const inspection = inspectPipeline(feature, { cwd });
  const qaAttack = runQaAttack(feature, { cwd });

  const checks: FinalGateCheck[] = [
    {
      name: 'required-artifacts',
      passed: missing.length === 0,
      required: [...REQUIRED_ARTIFACTS],
      recorded,
      missing
    },
    {
      name: 'no-active-agents',
      passed: inspection.activeAgents.length === 0,
      activeAgents: inspection.activeAgents
    },
    {
      name: 'no-recent-failures',
      passed: inspection.recentFailures.length === 0,
      recentFailures: inspection.recentFailures
    },
    {
      name: 'qa-attack-findings',
      passed: qaAttack.findings.filter((finding) => finding.status === 'open').length === 0,
      findings: qaAttack.findings
    }
  ];

  return {
    feature,
    passed: checks.every((check) => check.passed),
    checks
  };
}
