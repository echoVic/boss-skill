/**
 * Finalizes the materialized state — computes derived metrics, pipeline status,
 * and normalizes state after all events have been projected.
 */
import { PIPELINE_STATUS, STAGE_STATUS } from '../domain/state-constants.js';
import type { ExecutionState } from './types.js';
import {
  ensureConversationSections,
  normalizePlugins,
  refreshWorkflowSchedule,
} from './helpers.js';

function computeDurationSeconds(start: string | null, end: string | null): number | null {
  if (!start || !end) return null;
  return Math.max(0, (new Date(end).getTime() - new Date(start).getTime()) / 1000);
}

export function finalizeState(state: ExecutionState): ExecutionState {
  if (!state.createdAt) state.createdAt = state.updatedAt || new Date().toISOString();

  // Aggregate metrics from stages
  const stages = Object.values(state.stages ?? {});
  const stageCount = stages.length;

  if (stages.length > 0) {
    let totalSeconds = 0;
    for (const stage of stages) {
      const duration = computeDurationSeconds(stage.startTime, stage.endTime);
      totalSeconds += duration ?? 0;
    }
    state.metrics.totalDuration = totalSeconds > 0 ? totalSeconds : null;
  } else {
    state.metrics.totalDuration = null;
  }

  stageCount > 0
    ? (state.metrics.meanRetriesPerStage = Number(
        (state.metrics.retryTotal / stageCount).toFixed(2),
      ))
    : (state.metrics.meanRetriesPerStage = 0);

  let completedCount = 0;
  let runningCount = 0;
  let failedCount = 0;
  for (const stage of stages) {
    if (!stage.agents) continue;
    for (const agent of Object.values(stage.agents)) {
      if (agent.status === 'completed') completedCount += 1;
      else if (agent.status === 'running') runningCount += 1;
      else if (agent.status === 'failed') failedCount += 1;
    }
  }
  state.metrics.agentSuccessCount = completedCount;
  state.metrics.agentFailureCount = failedCount;

  const gateStates = Object.values(state.qualityGates ?? {}).filter(
    (gate) => gate.passed !== null,
  );
  if (gateStates.length > 0) {
    const passedCount = gateStates.filter((gate) => gate.passed).length;
    state.metrics.gatePassRate = Number(((passedCount / gateStates.length) * 100).toFixed(2));
  } else {
    state.metrics.gatePassRate = null;
  }

  const stageStatuses = Object.values(state.stages ?? {}).map((stage) => stage.status);
  if (
    stageStatuses.length > 0 &&
    stageStatuses.every(
      (status) => status === STAGE_STATUS.COMPLETED || status === STAGE_STATUS.SKIPPED,
    )
  ) {
    state.status = PIPELINE_STATUS.COMPLETED;
  } else if (
    stageStatuses.some(
      (status) => status === STAGE_STATUS.RUNNING || status === STAGE_STATUS.RETRYING,
    )
  ) {
    state.status = PIPELINE_STATUS.RUNNING;
  } else if (state.pause?.paused === true) {
    state.status = PIPELINE_STATUS.PAUSED;
  }

  state.plugins = normalizePlugins(state.plugins);
  if (!state.pluginLifecycle || typeof state.pluginLifecycle !== 'object') {
    state.pluginLifecycle = { discovered: [], activated: [], executed: [], failed: [] };
  }
  state.pluginLifecycle.discovered = normalizePlugins(state.pluginLifecycle.discovered);
  state.pluginLifecycle.activated = normalizePlugins(state.pluginLifecycle.activated);
  state.pluginLifecycle.executed = Array.isArray(state.pluginLifecycle.executed)
    ? state.pluginLifecycle.executed
    : [];
  state.pluginLifecycle.failed = Array.isArray(state.pluginLifecycle.failed)
    ? state.pluginLifecycle.failed
    : [];
  state.metrics.pluginFailureCount = state.pluginLifecycle.failed.length;
  ensureConversationSections(state);
  refreshWorkflowSchedule(state, state.updatedAt);
  state.conversationMetrics.unresolved = state.conversations.threads.filter(
    (thread) => thread.status !== 'closed' && thread.status !== 'materialized',
  ).length;
  return state;
}
