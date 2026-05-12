import { inspectPipeline, type CurrentStageSummary } from './inspection.js';
import { resolveDriverCapabilities, type BossDriverCapabilities } from './drivers.js';
import { readWaves, type EvidenceWave } from './waves.js';

export interface RequiredCheck {
  id: string;
  command: string;
  required: boolean;
}

export interface BossCheckpoint {
  checkpointRequired: boolean;
  reason: string;
  changedFiles: string[];
  requiredChecks: RequiredCheck[];
  continueCommand: string;
}

export interface BossStatus {
  feature: string;
  status: string;
  driver: BossDriverCapabilities;
  capabilities: Omit<BossDriverCapabilities, 'name'>;
  currentStage: CurrentStageSummary | null;
  currentWave: EvidenceWave | null;
  readyArtifacts: string[];
  blockedReason: string | null;
  checkpoint: BossCheckpoint;
}

function defaultRequiredChecks(stage: CurrentStageSummary | null): RequiredCheck[] {
  if (!stage || stage.id < 3) {
    return [];
  }

  return [
    { id: 'typecheck', command: 'npm run typecheck', required: true },
    { id: 'tests', command: 'npm test', required: true }
  ];
}

export function buildBossStatus(
  feature: string,
  { cwd = process.cwd(), driver = 'generic' }: { cwd?: string; driver?: string } = {}
): BossStatus {
  const inspection = inspectPipeline(feature, { cwd });
  const driverCapabilities = resolveDriverCapabilities(driver);
  const requiredChecks = defaultRequiredChecks(inspection.currentStage);
  const blockedReason = inspection.recentFailures[0]?.reason || null;
  const checkpointRequired = requiredChecks.length > 0 || blockedReason !== null;
  const currentWave = readWaves(feature, { cwd }).find((wave) => wave.status !== 'completed') ?? null;

  return {
    feature,
    status: inspection.status,
    driver: driverCapabilities,
    capabilities: {
      hooks: driverCapabilities.hooks,
      checkpointPrompt: driverCapabilities.checkpointPrompt,
      stopGuards: driverCapabilities.stopGuards,
      subagents: driverCapabilities.subagents
    },
    currentStage: inspection.currentStage,
    currentWave,
    readyArtifacts: inspection.readyArtifacts,
    blockedReason,
    checkpoint: {
      checkpointRequired,
      reason: checkpointRequired ? 'next-action-requires-explicit-confirmation' : 'next-action-ready',
      changedFiles: [],
      requiredChecks,
      continueCommand: `boss continue ${feature}`
    }
  };
}
