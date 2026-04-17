import fs from 'node:fs';
import path from 'node:path';

import * as pipelineRuntime from './pipeline-runtime.js';
import { projectState } from '../../projectors/materialize-state.js';

function ensureFeatureName(feature) {
  if (!feature) {
    throw new Error('缺少 feature 参数');
  }
}

function readExecution(feature, cwd = process.cwd()) {
  const executionPath = path.join(cwd, '.boss', feature, '.meta', 'execution.json');
  if (!fs.existsSync(executionPath)) {
    throw new Error(`未找到执行文件: ${path.relative(cwd, executionPath)}`);
  }
  return JSON.parse(fs.readFileSync(executionPath, 'utf8'));
}

function readEvents(feature, cwd = process.cwd()) {
  const eventsPath = path.join(cwd, '.boss', feature, '.meta', 'events.jsonl');
  if (!fs.existsSync(eventsPath)) {
    throw new Error(`未找到事件文件: ${path.relative(cwd, eventsPath)}`);
  }
  const raw = fs.readFileSync(eventsPath, 'utf8').trim();
  if (!raw) {
    return [];
  }
  return raw.split('\n').filter(Boolean).map((line) => JSON.parse(line));
}

function readProgress(feature, cwd = process.cwd()) {
  const progressPath = path.join(cwd, '.boss', feature, '.meta', 'progress.jsonl');
  if (!fs.existsSync(progressPath)) {
    return [];
  }
  const raw = fs.readFileSync(progressPath, 'utf8').trim();
  if (!raw) {
    return [];
  }
  return raw.split('\n').filter(Boolean).map((line) => JSON.parse(line));
}

function sortedStageEntries(stages) {
  return Object.entries(stages || {}).sort((a, b) => Number(a[0]) - Number(b[0]));
}

function getActiveAgents(execution) {
  const activeAgents = [];
  for (const [stageId, stage] of sortedStageEntries(execution.stages)) {
    const agents = stage && stage.agents ? stage.agents : {};
    for (const [agentName, agentState] of Object.entries(agents)) {
      if (!agentState || (agentState.status !== 'running' && agentState.status !== 'retrying')) {
        continue;
      }
      activeAgents.push({
        stage: Number(stageId),
        agent: agentName,
        status: agentState.status
      });
    }
  }
  return activeAgents;
}

function getCurrentStage(execution, activeAgents) {
  for (const [stageId, stage] of sortedStageEntries(execution.stages)) {
    if (stage && (stage.status === 'running' || stage.status === 'retrying')) {
      return {
        id: Number(stageId),
        name: stage.name || '',
        status: stage.status
      };
    }
  }

  if (activeAgents.length > 0) {
    const stageId = activeAgents[0].stage;
    const stage = execution.stages[String(stageId)] || {};
    return {
      id: stageId,
      name: stage.name || '',
      status: stage.status || 'pending'
    };
  }

  for (const [stageId, stage] of sortedStageEntries(execution.stages)) {
    if (stage && stage.status === 'failed') {
      return {
        id: Number(stageId),
        name: stage.name || '',
        status: stage.status
      };
    }
  }

  for (const [stageId, stage] of sortedStageEntries(execution.stages)) {
    if (stage && stage.status === 'pending') {
      return {
        id: Number(stageId),
        name: stage.name || '',
        status: stage.status
      };
    }
  }

  const stageEntries = sortedStageEntries(execution.stages);
  if (stageEntries.length === 0) {
    return null;
  }
  const [stageId, stage] = stageEntries[stageEntries.length - 1];
  return {
    id: Number(stageId),
    name: stage.name || '',
    status: stage.status || 'pending'
  };
}

function getRecentFailures(execution) {
  const failures = [];
  for (const [stageId, stage] of sortedStageEntries(execution.stages)) {
    if (stage && stage.status === 'failed') {
      failures.push({
        scope: 'stage',
        stage: Number(stageId),
        reason: stage.failureReason || ''
      });
    }
    const agents = stage && stage.agents ? stage.agents : {};
    for (const [agentName, agentState] of Object.entries(agents)) {
      if (!agentState || agentState.status !== 'failed') {
        continue;
      }
      failures.push({
        scope: 'agent',
        stage: Number(stageId),
        agent: agentName,
        reason: agentState.failureReason || ''
      });
    }
  }
  return failures;
}

function readFeatureSummary(feature, cwd = process.cwd()) {
  const summaryPath = path.join(cwd, '.boss', feature, '.meta', 'memory-summary.json');
  try {
    if (!fs.existsSync(summaryPath)) {
      throw new Error('missing summary');
    }
    return JSON.parse(fs.readFileSync(summaryPath, 'utf8'));
  } catch {
    return {
      feature,
      generatedAt: null,
      startupSummary: [],
      agentSections: {}
    };
  }
}

function inspectPipeline(feature, { cwd = process.cwd() } = {}) {
  ensureFeatureName(feature);
  const execution = readExecution(feature, cwd);
  const activeAgents = getActiveAgents(execution);
  const readyArtifacts = pipelineRuntime.getReadyArtifacts(feature, { cwd }).map((item) => item.artifact);

  return {
    feature,
    status: execution.status,
    currentStage: getCurrentStage(execution, activeAgents),
    readyArtifacts,
    activeAgents,
    recentFailures: getRecentFailures(execution),
    memory: readFeatureSummary(feature, cwd),
    pack: {
      name: execution.parameters && execution.parameters.pipelinePack ? execution.parameters.pipelinePack : 'default',
      version: execution.parameters && execution.parameters.pipelinePackVersion ? execution.parameters.pipelinePackVersion : ''
    },
    plugins: {
      active: Array.isArray(execution.plugins) ? execution.plugins : [],
      discovered: execution.pluginLifecycle && Array.isArray(execution.pluginLifecycle.discovered)
        ? execution.pluginLifecycle.discovered
        : [],
      activated: execution.pluginLifecycle && Array.isArray(execution.pluginLifecycle.activated)
        ? execution.pluginLifecycle.activated
        : [],
      executed: execution.pluginLifecycle && Array.isArray(execution.pluginLifecycle.executed)
        ? execution.pluginLifecycle.executed
        : [],
      failed: execution.pluginLifecycle && Array.isArray(execution.pluginLifecycle.failed)
        ? execution.pluginLifecycle.failed
        : []
    },
    metrics: execution.metrics || {}
  };
}

function inspectEvents(feature, { cwd = process.cwd(), limit = 20, type = '' } = {}) {
  ensureFeatureName(feature);
  const max = Number(limit);
  if (!Number.isInteger(max) || max < 1) {
    throw new Error('limit 必须是正整数');
  }

  let events = readEvents(feature, cwd).slice().reverse();
  if (type) {
    events = events.filter((event) => event.type === type);
  }

  return {
    feature,
    limit: max,
    type: type || null,
    events: events.slice(0, max)
  };
}

function inspectProgress(feature, { cwd = process.cwd(), limit = 20, type = '' } = {}) {
  ensureFeatureName(feature);
  const max = Number(limit);
  if (!Number.isInteger(max) || max < 1) {
    throw new Error('limit 必须是正整数');
  }

  let events = readProgress(feature, cwd).slice().reverse();
  if (type) {
    events = events.filter((event) => event.type === type);
  }

  return {
    feature,
    limit: max,
    type: type || null,
    events: events.slice(0, max)
  };
}

function buildStageSummary(execution) {
  const stages = {};
  for (const [stageId, stage] of sortedStageEntries(execution.stages)) {
    stages[stageId] = stage;
  }
  return {
    status: execution.status,
    stages,
    qualityGates: execution.qualityGates || {},
    metrics: execution.metrics || {}
  };
}

function checkStage(feature, stageId = '', { cwd = process.cwd() } = {}) {
  ensureFeatureName(feature);
  const execution = readExecution(feature, cwd);
  if (!stageId) {
    return buildStageSummary(execution);
  }
  const key = String(stageId);
  return execution.stages && execution.stages[key] ? execution.stages[key] : null;
}

function checkCanProceed(feature, stageId, { cwd = process.cwd() } = {}) {
  ensureFeatureName(feature);
  if (!stageId) {
    throw new Error('stage 必须是 1-4');
  }
  const execution = readExecution(feature, cwd);
  const key = String(stageId);
  const stage = execution.stages && execution.stages[key] ? execution.stages[key] : {};
  const status = stage.status || 'pending';
  if (status === 'completed' || status === 'skipped') {
    return { ok: false, reason: `阶段 ${stageId} 已经完成（${status}），无需再执行` };
  }
  if (Number(stageId) === 1) {
    return { ok: status === 'pending', reason: status === 'pending' ? '' : `阶段 1 当前状态为 ${status}` };
  }
  const prevStage = execution.stages && execution.stages[String(Number(stageId) - 1)]
    ? execution.stages[String(Number(stageId) - 1)]
    : {};
  const prevStatus = prevStage.status || 'pending';
  const ok = prevStatus === 'completed' || prevStatus === 'skipped';
  return {
    ok,
    reason: ok ? '' : `阶段 ${stageId} 不能开始：阶段 ${Number(stageId) - 1} 状态为 ${prevStatus}（需要 completed 或 skipped）`
  };
}

function checkCanRetry(feature, stageId, { cwd = process.cwd() } = {}) {
  ensureFeatureName(feature);
  if (!stageId) {
    throw new Error('stage 必须是 1-4');
  }
  const execution = readExecution(feature, cwd);
  const stage = execution.stages && execution.stages[String(stageId)] ? execution.stages[String(stageId)] : {};
  const status = stage.status || 'pending';
  const retryCount = Number(stage.retryCount || 0);
  const maxRetries = Number(stage.maxRetries || 0);
  if (status !== 'failed') {
    return { ok: false, reason: `阶段 ${stageId} 状态为 ${status}，只有 failed 状态可以重试` };
  }
  if (retryCount >= maxRetries) {
    return { ok: false, reason: `阶段 ${stageId} 已达到最大重试次数（${retryCount}/${maxRetries}）` };
  }
  return { ok: true, reason: '' };
}

function replayEvents(feature, { cwd = process.cwd(), limit = 20, type = '' } = {}) {
  return inspectEvents(feature, { cwd, limit, type });
}

function replaySnapshot(feature, at, { cwd = process.cwd() } = {}) {
  ensureFeatureName(feature);
  const target = Number(at);
  if (!Number.isInteger(target) || target < 1) {
    throw new Error('at 必须是正整数');
  }
  const allEvents = readEvents(feature, cwd);
  return {
    feature,
    at: target,
    snapshot: projectState(allEvents.slice(0, target), feature)
  };
}

export {
  inspectPipeline,
  inspectEvents,
  inspectProgress,
  checkStage,
  checkCanProceed,
  checkCanRetry,
  replayEvents,
  replaySnapshot,
  readExecution,
  readEvents,
  readProgress
};
