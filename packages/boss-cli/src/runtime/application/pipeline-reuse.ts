/**
 * Pipeline agent reuse — builds fingerprints and evaluates whether
 * an agent can reuse its prior completed run.
 */
import * as fs from 'node:fs';
import * as path from 'node:path';
import { EVENT_TYPES } from '../domain/event-types.js';
import { ensureFeatureName, readExecutionView } from './state.js';
import type { AgentReuseDecision, AgentReuseInput } from './pipeline-types.js';
import {
  hashFile,
  hashRuntimeValue,
  isArtifactDagStale,
  readRuntimeEvents,
  sha256Hex,
} from './pipeline-dag.js';

function readArtifactDigest(
  cwd: string,
  feature: string,
  artifact: string,
): ReturnType<typeof hashFile> | null {
  const artifactPath = path.join(cwd, '.boss', feature, artifact);
  if (!fs.existsSync(artifactPath) || !fs.statSync(artifactPath).isFile()) return null;
  return hashFile(artifactPath);
}

export function buildAgentFingerprints(
  feature: string,
  agent: string,
  stage: number,
  {
    cwd,
    prompt,
    promptFingerprint,
    dependencyArtifacts = [],
    opts = {},
  }: AgentReuseInput & { cwd: string },
): { promptFingerprint: ReturnType<typeof hashRuntimeValue>; inputDigest: ReturnType<typeof hashRuntimeValue> } {
  const promptHash = {
    algorithm: 'sha256' as const,
    value: promptFingerprint || sha256Hex(prompt || ''),
  };
  const dependencies = dependencyArtifacts
    .slice()
    .sort()
    .map((artifact) => ({
      artifact,
      hash: readArtifactDigest(cwd, feature, artifact),
    }));
  const inputDigest = hashRuntimeValue({
    agent,
    stage,
    promptFingerprint: promptHash,
    opts,
    dependencies,
  });
  return { promptFingerprint: promptHash, inputDigest };
}

export function evaluateAgentReuse(
  feature: string,
  stage: number | string,
  agent: string,
  {
    cwd = process.cwd(),
    prompt,
    promptFingerprint,
    dependencyArtifacts = [],
    opts = {},
  }: AgentReuseInput & { cwd?: string } = {},
): AgentReuseDecision {
  ensureFeatureName(feature);
  const stageNumber = Number(stage);
  if (!Number.isInteger(stageNumber)) {
    throw new Error('stage 必须是整数');
  }
  if (stageNumber < 1 || stageNumber > 4) {
    throw new Error('stage 必须是 1-4');
  }
  const execution = readExecutionView(cwd, feature);
  const dagStale = isArtifactDagStale(cwd, feature, execution);
  const fingerprints = buildAgentFingerprints(feature, agent, stageNumber, {
    cwd,
    prompt,
    promptFingerprint,
    dependencyArtifacts,
    opts,
  });

  const completed = readRuntimeEvents(cwd, feature)
    .slice()
    .reverse()
    .find(
      (event) =>
        event.type === EVENT_TYPES.AGENT_COMPLETED &&
        event.data.agent === agent &&
        Number(event.data.stage) === stageNumber,
    );

  if (!completed) {
    return {
      reusable: false,
      reason: 'no-completed-agent-event',
      dagStale,
      ...fingerprints,
    };
  }

  if (completed.data.promptFingerprint !== fingerprints.promptFingerprint.value) {
    return {
      reusable: false,
      reason: 'prompt-fingerprint-changed',
      dagStale,
      completedEventId: completed.id,
      ...fingerprints,
    };
  }

  if (completed.data.inputDigest !== fingerprints.inputDigest.value) {
    return {
      reusable: false,
      reason: 'input-digest-changed',
      dagStale,
      completedEventId: completed.id,
      ...fingerprints,
    };
  }

  return {
    reusable: !dagStale,
    reason: dagStale ? 'artifact-dag-stale' : 'input-digest-matched',
    dagStale,
    completedEventId: completed.id,
    ...fingerprints,
  };
}
