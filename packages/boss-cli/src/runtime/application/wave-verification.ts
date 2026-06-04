import { spawnSync } from 'node:child_process';

import { EVENT_TYPES } from '../domain/event-types.js';
import { readWaves, type EvidenceWave } from './waves.js';
import { appendRuntimeEvent, ensureFeatureName } from './state.js';
import type { RuntimeEvent } from '../projectors/materialize-state.js';
import { materializeState } from '../projectors/materialize-state.js';

export type VerifyPhase = 'red' | 'green' | 'full';

export interface CommandResult {
  command: string;
  exitCode: number;
  passed: boolean;
  stdout: string;
  stderr: string;
}

export interface PhaseResult {
  results: CommandResult[];
  allCorrect: boolean;
}

export interface WaveVerificationResult {
  feature: string;
  waveId: string;
  phase: VerifyPhase;
  redTests?: PhaseResult;
  greenGates?: PhaseResult;
  verified: boolean;
  event?: { id: number; type: string };
}

function runShellCommand(cmd: string, cwd: string): { exitCode: number; stdout: string; stderr: string } {
  const result = spawnSync(cmd, {
    cwd,
    shell: true,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
    timeout: 120_000
  });
  return {
    exitCode: result.status ?? 1,
    stdout: (result.stdout || '').trim().split('\n').slice(-30).join('\n'),
    stderr: (result.stderr || '').trim().split('\n').slice(-30).join('\n')
  };
}

function verifyRedPhase(commands: string[], cwd: string): PhaseResult {
  const results = commands.map((cmd) => {
    const { exitCode, stdout, stderr } = runShellCommand(cmd, cwd);
    return { command: cmd, exitCode, passed: exitCode !== 0, stdout, stderr };
  });
  return { results, allCorrect: results.every((r) => r.passed) };
}

function verifyGreenPhase(commands: string[], cwd: string): PhaseResult {
  const results = commands.map((cmd) => {
    const { exitCode, stdout, stderr } = runShellCommand(cmd, cwd);
    return { command: cmd, exitCode, passed: exitCode === 0, stdout, stderr };
  });
  return { results, allCorrect: results.every((r) => r.passed) };
}

export function findWave(feature: string, waveId: string, cwd: string): EvidenceWave {
  const waves = readWaves(feature, { cwd });
  const wave = waves.find((w) => w.id === waveId);
  if (!wave) {
    const available = waves.map((w) => w.id).join(', ') || '(none)';
    throw new Error(`未找到 wave: ${waveId}，可用的 waves: ${available}`);
  }
  return wave;
}

export function verifyWave(
  feature: string,
  waveId: string,
  phase: VerifyPhase,
  { cwd = process.cwd(), dryRun = false }: { cwd?: string; dryRun?: boolean } = {}
): WaveVerificationResult {
  ensureFeatureName(feature);
  const wave = findWave(feature, waveId, cwd);

  let redTests: PhaseResult | undefined;
  let greenGates: PhaseResult | undefined;

  if (phase === 'red' || phase === 'full') {
    if (wave.redTests.length === 0) {
      throw new Error(`Wave ${waveId} 没有定义 redTests`);
    }
    redTests = verifyRedPhase(wave.redTests, cwd);
  }

  if (phase === 'green' || phase === 'full') {
    if (wave.greenGates.length === 0) {
      throw new Error(`Wave ${waveId} 没有定义 greenGates`);
    }
    greenGates = verifyGreenPhase(wave.greenGates, cwd);
  }

  let verified = true;
  if (redTests && !redTests.allCorrect) verified = false;
  if (greenGates && !greenGates.allCorrect) verified = false;

  const result: WaveVerificationResult = { feature, waveId, phase, redTests, greenGates, verified };

  if (!dryRun) {
    let event: RuntimeEvent;
    try {
      event = appendRuntimeEvent(cwd, feature, EVENT_TYPES.WAVE_VERIFIED, {
        waveId,
        phase,
        verified,
        redTestsCorrect: redTests?.allCorrect ?? null,
        greenGatesCorrect: greenGates?.allCorrect ?? null
      });
      materializeState(feature, cwd);
      result.event = { id: event.id, type: event.type };
    } catch {
      // events file may not exist in some contexts
    }
  }

  return result;
}
