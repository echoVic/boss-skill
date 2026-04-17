import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { EVENT_TYPES, EVENT_TYPE_VALUES } from '../domain/event-types.js';
import {
  PIPELINE_STATUS,
  STAGE_STATUS,
  AGENT_STATUS,
  DEFAULT_SCHEMA_VERSION
} from '../domain/state-constants.js';

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function isObject(value) {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function mergeDeep(base, override) {
  if (Array.isArray(base) || Array.isArray(override)) {
    return clone(override === undefined ? base : override);
  }

  if (!isObject(base) || !isObject(override)) {
    return clone(override === undefined ? base : override);
  }

  const result = {};
  const keys = new Set([...Object.keys(base), ...Object.keys(override)]);
  for (const key of keys) {
    if (override[key] === undefined) {
      result[key] = clone(base[key]);
    } else if (base[key] === undefined) {
      result[key] = clone(override[key]);
    } else {
      result[key] = mergeDeep(base[key], override[key]);
    }
  }
  return result;
}

function defaultStageState(name = '') {
  return {
    name,
    status: STAGE_STATUS.PENDING,
    startTime: null,
    endTime: null,
    retryCount: 0,
    maxRetries: 2,
    failureReason: null,
    artifacts: [],
    gateResults: {}
  };
}

function defaultGateState() {
  return {
    status: STAGE_STATUS.PENDING,
    passed: null,
    checks: [],
    executedAt: null
  };
}

function defaultAgentState() {
  return {
    status: AGENT_STATUS.PENDING,
    startTime: null,
    endTime: null,
    retryCount: 0,
    maxRetries: 2,
    failureReason: null
  };
}

function defaultExecutionState(feature = '') {
  return {
    schemaVersion: DEFAULT_SCHEMA_VERSION,
    feature,
    createdAt: '',
    updatedAt: '',
    status: PIPELINE_STATUS.INITIALIZED,
    parameters: {},
    stages: {},
    qualityGates: {},
    metrics: {
      totalDuration: null,
      stageTimings: {},
      gatePassRate: null,
      retryTotal: 0,
      agentSuccessCount: 0,
      agentFailureCount: 0,
      meanRetriesPerStage: 0,
      revisionLoopCount: 0,
      pluginFailureCount: 0
    },
    plugins: [],
    pluginLifecycle: {
      discovered: [],
      activated: [],
      executed: [],
      failed: []
    },
    humanInterventions: [],
    revisionRequests: [],
    feedbackLoops: { maxRounds: 2, currentRound: 0 }
  };
}

function ensureStage(state, stageId) {
  const key = String(stageId);
  if (!state.stages[key]) {
    state.stages[key] = defaultStageState();
  }
  const stage = state.stages[key];
  stage.artifacts = Array.isArray(stage.artifacts) ? stage.artifacts : [];
  stage.gateResults = isObject(stage.gateResults) ? stage.gateResults : {};
  if (stage.retryCount == null) stage.retryCount = 0;
  if (stage.maxRetries == null) stage.maxRetries = 2;
  if (stage.failureReason === undefined) stage.failureReason = null;
  return stage;
}

function ensureGate(state, gateName) {
  if (!state.qualityGates[gateName]) {
    state.qualityGates[gateName] = defaultGateState();
  }
  const gate = state.qualityGates[gateName];
  gate.checks = Array.isArray(gate.checks) ? gate.checks : [];
  if (gate.executedAt === undefined) gate.executedAt = null;
  if (gate.passed === undefined) gate.passed = null;
  if (gate.status === undefined) gate.status = STAGE_STATUS.PENDING;
  return gate;
}

function ensureAgent(stage, agentName) {
  if (!stage.agents) stage.agents = {};
  if (!stage.agents[agentName]) {
    stage.agents[agentName] = defaultAgentState();
  }
  return stage.agents[agentName];
}

function uniqueArtifacts(artifacts) {
  return [...new Set(artifacts)];
}

function normalizePlugins(plugins) {
  if (!Array.isArray(plugins)) return [];
  const deduped = new Map();
  for (const plugin of plugins) {
    if (!plugin || typeof plugin !== 'object') continue;
    const key = `${plugin.name || ''}:${plugin.version || ''}:${plugin.type || ''}`;
    const normalized = {
      name: plugin.name || '',
      version: plugin.version || '',
      type: plugin.type || ''
    };
    const dependencies = Array.isArray(plugin.dependencies)
      ? plugin.dependencies.filter((dep) => typeof dep === 'string')
      : [];
    if (dependencies.length > 0) {
      normalized.dependencies = dependencies;
    }
    if (typeof plugin.manifestPath === 'string' && plugin.manifestPath.length > 0) {
      normalized.manifestPath = plugin.manifestPath;
    }
    deduped.set(key, normalized);
  }
  return [...deduped.values()];
}

function failValidation(message, context = '') {
  throw new Error(context ? `${context}: ${message}` : message);
}

function isNonEmptyString(value) {
  return typeof value === 'string' && value.length > 0;
}

function isBoolean(value) {
  return value === true || value === false;
}

function isPositiveInteger(value) {
  return Number.isInteger(value) && value >= 1;
}

function validatePluginSummary(plugin, context) {
  if (!isObject(plugin)) {
    failValidation('plugin 必须是对象', context);
  }
  if (!isNonEmptyString(plugin.name)) {
    failValidation('plugin.name 必须是非空字符串', context);
  }
  if (!isNonEmptyString(plugin.version)) {
    failValidation('plugin.version 必须是非空字符串', context);
  }
  if (!isNonEmptyString(plugin.type)) {
    failValidation('plugin.type 必须是非空字符串', context);
  }
}

function validateEvent(event) {
  if (!isObject(event)) {
    failValidation('event 必须是对象');
  }
  if (!isPositiveInteger(event.id)) {
    failValidation('event.id 必须是正整数');
  }
  if (!EVENT_TYPE_VALUES.includes(event.type)) {
    failValidation(`未知事件类型 ${JSON.stringify(event.type)}`);
  }
  if (!isNonEmptyString(event.timestamp) || !Number.isFinite(Date.parse(event.timestamp))) {
    failValidation(`事件 ${event.type} 的 timestamp 无效`);
  }
  if (!isObject(event.data)) {
    failValidation(`事件 ${event.type} 的 data 必须是对象`);
  }

  const context = `事件 ${event.type}`;
  switch (event.type) {
    case EVENT_TYPES.PIPELINE_INITIALIZED:
      if (!isObject(event.data.initialState)) {
        failValidation('initialState 必须是对象', context);
      }
      break;
    case EVENT_TYPES.PACK_APPLIED:
      if (!isNonEmptyString(event.data.pack)) {
        failValidation('pack 必须是非空字符串', context);
      }
      break;
    case EVENT_TYPES.STAGE_STARTED:
    case EVENT_TYPES.STAGE_COMPLETED:
    case EVENT_TYPES.STAGE_RETRYING:
    case EVENT_TYPES.STAGE_SKIPPED:
      if (!isPositiveInteger(event.data.stage)) {
        failValidation('stage 必须是正整数', context);
      }
      break;
    case EVENT_TYPES.STAGE_FAILED:
      if (!isPositiveInteger(event.data.stage)) {
        failValidation('stage 必须是正整数', context);
      }
      if (event.data.reason !== undefined && event.data.reason !== null && typeof event.data.reason !== 'string') {
        failValidation('reason 必须是字符串或 null', context);
      }
      break;
    case EVENT_TYPES.ARTIFACT_RECORDED:
      if (!isPositiveInteger(event.data.stage)) {
        failValidation('stage 必须是正整数', context);
      }
      if (!isNonEmptyString(event.data.artifact)) {
        failValidation('artifact 必须是非空字符串', context);
      }
      break;
    case EVENT_TYPES.GATE_EVALUATED:
      if (!isPositiveInteger(event.data.stage)) {
        failValidation('stage 必须是正整数', context);
      }
      if (!isNonEmptyString(event.data.gate)) {
        failValidation('gate 必须是非空字符串', context);
      }
      if (!isBoolean(event.data.passed)) {
        failValidation('passed 必须是布尔值', context);
      }
      if (event.data.checks !== undefined && !Array.isArray(event.data.checks)) {
        failValidation('checks 必须是数组', context);
      }
      break;
    case EVENT_TYPES.AGENT_STARTED:
    case EVENT_TYPES.AGENT_COMPLETED:
      if (!isPositiveInteger(event.data.stage)) {
        failValidation('stage 必须是正整数', context);
      }
      if (!isNonEmptyString(event.data.agent)) {
        failValidation('agent 必须是非空字符串', context);
      }
      break;
    case EVENT_TYPES.AGENT_FAILED:
    case EVENT_TYPES.AGENT_RETRY_SCHEDULED:
      if (!isPositiveInteger(event.data.stage)) {
        failValidation('stage 必须是正整数', context);
      }
      if (!isNonEmptyString(event.data.agent)) {
        failValidation('agent 必须是非空字符串', context);
      }
      if (event.data.reason !== undefined && event.data.reason !== null && typeof event.data.reason !== 'string') {
        failValidation('reason 必须是字符串或 null', context);
      }
      break;
    case EVENT_TYPES.REVISION_REQUESTED:
      if (!isNonEmptyString(event.data.from)) {
        failValidation('from 必须是非空字符串', context);
      }
      if (!isNonEmptyString(event.data.to)) {
        failValidation('to 必须是非空字符串', context);
      }
      if (!isNonEmptyString(event.data.artifact)) {
        failValidation('artifact 必须是非空字符串', context);
      }
      if (!isNonEmptyString(event.data.reason)) {
        failValidation('reason 必须是非空字符串', context);
      }
      break;
    case EVENT_TYPES.PLUGIN_DISCOVERED:
    case EVENT_TYPES.PLUGIN_ACTIVATED:
      validatePluginSummary(event.data.plugin, `${context}.plugin`);
      break;
    case EVENT_TYPES.PLUGIN_HOOK_EXECUTED:
    case EVENT_TYPES.PLUGIN_HOOK_FAILED:
      validatePluginSummary(event.data.plugin, `${context}.plugin`);
      if (!isNonEmptyString(event.data.hook)) {
        failValidation('hook 必须是非空字符串', context);
      }
      if (!Number.isInteger(event.data.exitCode) || event.data.exitCode < 0) {
        failValidation('exitCode 必须是大于等于 0 的整数', context);
      }
      if (event.data.stage !== undefined && event.data.stage !== null && !isPositiveInteger(event.data.stage)) {
        failValidation('stage 必须是正整数或 null', context);
      }
      break;
    case EVENT_TYPES.PLUGINS_REGISTERED:
      if (!Array.isArray(event.data.plugins)) {
        failValidation('plugins 必须是数组', context);
      }
      for (const plugin of event.data.plugins) {
        validatePluginSummary(plugin, `${context}.plugins`);
      }
      break;
    default:
      break;
  }
}

function validateExecutionState(state, feature) {
  if (!isObject(state)) {
    failValidation('execution state 必须是对象');
  }
  if (!isNonEmptyString(state.schemaVersion)) {
    failValidation('execution.schemaVersion 必须是非空字符串');
  }
  if (state.feature !== feature) {
    failValidation(`execution.feature 必须为 ${feature}`);
  }
  if (!Object.values(PIPELINE_STATUS).includes(state.status)) {
    failValidation(`execution.status 无效: ${JSON.stringify(state.status)}`);
  }
  if (!isObject(state.stages)) {
    failValidation('execution.stages 必须是对象');
  }
  if (!isObject(state.qualityGates)) {
    failValidation('execution.qualityGates 必须是对象');
  }
  if (!isObject(state.metrics)) {
    failValidation('execution.metrics 必须是对象');
  }
  for (const key of [
    'totalDuration',
    'stageTimings',
    'gatePassRate',
    'retryTotal',
    'agentSuccessCount',
    'agentFailureCount',
    'meanRetriesPerStage',
    'revisionLoopCount',
    'pluginFailureCount'
  ]) {
    if (!(key in state.metrics)) {
      failValidation(`execution.metrics.${key} 缺失`);
    }
  }
  if (!Array.isArray(state.plugins)) {
    failValidation('execution.plugins 必须是数组');
  }
  if (!isObject(state.pluginLifecycle)) {
    failValidation('execution.pluginLifecycle 必须是对象');
  }
  if (!Array.isArray(state.pluginLifecycle.discovered)) {
    failValidation('execution.pluginLifecycle.discovered 必须是数组');
  }
  if (!Array.isArray(state.pluginLifecycle.activated)) {
    failValidation('execution.pluginLifecycle.activated 必须是数组');
  }
  if (!Array.isArray(state.pluginLifecycle.executed)) {
    failValidation('execution.pluginLifecycle.executed 必须是数组');
  }
  if (!Array.isArray(state.pluginLifecycle.failed)) {
    failValidation('execution.pluginLifecycle.failed 必须是数组');
  }
}

function applyEvent(currentState, event, feature) {
  const state = currentState;
  state.updatedAt = event.timestamp || state.updatedAt;

  switch (event.type) {
    case EVENT_TYPES.PIPELINE_INITIALIZED: {
      const initial = mergeDeep(defaultExecutionState(feature), event.data.initialState || {});
      initial.updatedAt = event.timestamp || initial.updatedAt;
      if (!initial.createdAt) initial.createdAt = event.timestamp || '';
      if (!initial.feature) initial.feature = feature;
      return initial;
    }

    case EVENT_TYPES.PACK_APPLIED: {
      const eventData = isObject(event.data) ? event.data : {};
      const config = isObject(eventData.config) ? eventData.config : {};
      const parameters = isObject(eventData.parameters) ? eventData.parameters : {};
      const derived = {
        pipelinePack: eventData.pack || 'default',
        pipelinePackVersion: eventData.version || '',
        enabledStages: Array.isArray(config.stages) ? clone(config.stages) : [],
        enabledGates: Array.isArray(config.gates) ? clone(config.gates) : [],
        activeAgents: Array.isArray(config.agents) ? clone(config.agents) : [],
        packConfig: clone(config)
      };
      state.parameters = mergeDeep(state.parameters || {}, mergeDeep(derived, parameters));
      return state;
    }

    case EVENT_TYPES.STAGE_STARTED: {
      const stage = ensureStage(state, event.data.stage);
      stage.status = STAGE_STATUS.RUNNING;
      if (!stage.startTime) stage.startTime = event.timestamp;
      state.status = PIPELINE_STATUS.RUNNING;
      return state;
    }

    case EVENT_TYPES.STAGE_COMPLETED: {
      const stage = ensureStage(state, event.data.stage);
      stage.status = STAGE_STATUS.COMPLETED;
      stage.endTime = event.timestamp;
      return state;
    }

    case EVENT_TYPES.STAGE_FAILED: {
      const stage = ensureStage(state, event.data.stage);
      stage.status = STAGE_STATUS.FAILED;
      stage.endTime = event.timestamp;
      stage.failureReason = event.data.reason || null;
      state.status = PIPELINE_STATUS.FAILED;
      return state;
    }

    case EVENT_TYPES.STAGE_RETRYING: {
      const stage = ensureStage(state, event.data.stage);
      stage.status = STAGE_STATUS.RETRYING;
      stage.retryCount += 1;
      state.metrics.retryTotal += 1;
      state.status = PIPELINE_STATUS.RUNNING;
      return state;
    }

    case EVENT_TYPES.STAGE_SKIPPED: {
      const stage = ensureStage(state, event.data.stage);
      stage.status = STAGE_STATUS.SKIPPED;
      stage.endTime = event.timestamp;
      return state;
    }

    case EVENT_TYPES.ARTIFACT_RECORDED: {
      const stage = ensureStage(state, event.data.stage);
      stage.artifacts = uniqueArtifacts(stage.artifacts.concat(event.data.artifact));
      return state;
    }

    case EVENT_TYPES.GATE_EVALUATED: {
      const stage = ensureStage(state, event.data.stage);
      const checks = Array.isArray(event.data.checks) ? clone(event.data.checks) : [];
      stage.gateResults[event.data.gate] = {
        passed: event.data.passed,
        executedAt: event.timestamp,
        checks
      };
      const gate = ensureGate(state, event.data.gate);
      gate.status = STAGE_STATUS.COMPLETED;
      gate.passed = event.data.passed;
      gate.executedAt = event.timestamp;
      gate.checks = checks;
      return state;
    }

    case EVENT_TYPES.AGENT_STARTED: {
      const stage = ensureStage(state, event.data.stage);
      const agent = ensureAgent(stage, event.data.agent);
      agent.status = AGENT_STATUS.RUNNING;
      if (!agent.startTime) agent.startTime = event.timestamp;
      return state;
    }

    case EVENT_TYPES.AGENT_COMPLETED: {
      const stage = ensureStage(state, event.data.stage);
      const agent = ensureAgent(stage, event.data.agent);
      agent.status = AGENT_STATUS.COMPLETED;
      agent.endTime = event.timestamp;
      return state;
    }

    case EVENT_TYPES.AGENT_FAILED: {
      const stageId = event.data.stage;
      if (stageId != null) {
        const stage = ensureStage(state, stageId);
        const agent = ensureAgent(stage, event.data.agent);
        agent.status = AGENT_STATUS.FAILED;
        agent.endTime = event.timestamp;
        agent.failureReason = event.data.reason || null;
      }
      return state;
    }

    case EVENT_TYPES.AGENT_RETRY_SCHEDULED: {
      const stage = ensureStage(state, event.data.stage);
      const agent = ensureAgent(stage, event.data.agent);
      agent.retryCount += 1;
      agent.status = 'retrying';
      agent.failureReason = null;
      return state;
    }

    case EVENT_TYPES.REVISION_REQUESTED: {
      if (!Array.isArray(state.revisionRequests)) state.revisionRequests = [];
      if (!state.feedbackLoops || typeof state.feedbackLoops !== 'object') {
        state.feedbackLoops = { maxRounds: 2, currentRound: 0 };
      }
      state.revisionRequests.push({
        from: event.data.from,
        to: event.data.to,
        artifact: event.data.artifact,
        reason: event.data.reason,
        priority: event.data.priority || 'recommended',
        timestamp: event.timestamp,
        resolved: false
      });
      state.feedbackLoops.currentRound = (state.feedbackLoops.currentRound || 0) + 1;
      return state;
    }

    case EVENT_TYPES.PLUGIN_DISCOVERED: {
      if (!state.pluginLifecycle || typeof state.pluginLifecycle !== 'object') {
        state.pluginLifecycle = { discovered: [], activated: [], executed: [], failed: [] };
      }
      state.pluginLifecycle.discovered = normalizePlugins(
        (state.pluginLifecycle.discovered || []).concat(event.data.plugin || {})
      );
      return state;
    }

    case EVENT_TYPES.PLUGIN_ACTIVATED: {
      if (!state.pluginLifecycle || typeof state.pluginLifecycle !== 'object') {
        state.pluginLifecycle = { discovered: [], activated: [], executed: [], failed: [] };
      }
      state.pluginLifecycle.activated = normalizePlugins(
        (state.pluginLifecycle.activated || []).concat(event.data.plugin || {})
      );
      state.plugins = normalizePlugins((state.plugins || []).concat(event.data.plugin || {}));
      return state;
    }

    case EVENT_TYPES.PLUGIN_HOOK_EXECUTED: {
      if (!state.pluginLifecycle || typeof state.pluginLifecycle !== 'object') {
        state.pluginLifecycle = { discovered: [], activated: [], executed: [], failed: [] };
      }
      state.pluginLifecycle.executed = (state.pluginLifecycle.executed || []).concat({
        plugin: clone(event.data.plugin || {}),
        hook: event.data.hook,
        stage: event.data.stage == null ? null : event.data.stage,
        exitCode: event.data.exitCode,
        timestamp: event.timestamp
      });
      return state;
    }

    case EVENT_TYPES.PLUGIN_HOOK_FAILED: {
      if (!state.pluginLifecycle || typeof state.pluginLifecycle !== 'object') {
        state.pluginLifecycle = { discovered: [], activated: [], executed: [], failed: [] };
      }
      state.pluginLifecycle.failed = (state.pluginLifecycle.failed || []).concat({
        plugin: clone(event.data.plugin || {}),
        hook: event.data.hook,
        stage: event.data.stage == null ? null : event.data.stage,
        exitCode: event.data.exitCode,
        timestamp: event.timestamp
      });
      return state;
    }

    case EVENT_TYPES.PLUGINS_REGISTERED: {
      state.plugins = normalizePlugins(event.data.plugins);
      return state;
    }

    default:
      return state;
  }
}

function computeDurationSeconds(start, end) {
  if (!start || !end) return null;
  const startMs = Date.parse(start);
  const endMs = Date.parse(end);
  if (!Number.isFinite(startMs) || !Number.isFinite(endMs) || endMs < startMs) {
    return null;
  }
  return Math.round((endMs - startMs) / 1000);
}

function finalizeState(state) {
  const stageTimings = {};
  let stageRetryCount = 0;
  let stageCount = 0;
  let agentSuccessCount = 0;
  let agentFailureCount = 0;
  for (const [stageId, stage] of Object.entries(state.stages || {})) {
    const duration = computeDurationSeconds(stage.startTime, stage.endTime);
    if (duration != null) {
      stageTimings[stageId] = duration;
    }
    stageRetryCount += Number(stage.retryCount || 0);
    stageCount += 1;
    if (Array.isArray(stage.artifacts)) {
      stage.artifacts = uniqueArtifacts(stage.artifacts);
    } else {
      stage.artifacts = [];
    }
    stage.gateResults = isObject(stage.gateResults) ? stage.gateResults : {};
    const agents = isObject(stage.agents) ? stage.agents : {};
    for (const agentState of Object.values(agents)) {
      if (!agentState || typeof agentState !== 'object') continue;
      if (agentState.status === AGENT_STATUS.COMPLETED) {
        agentSuccessCount += 1;
      } else if (agentState.status === AGENT_STATUS.FAILED) {
        agentFailureCount += 1;
      }
    }
  }

  state.metrics.stageTimings = stageTimings;
  state.metrics.totalDuration = computeDurationSeconds(state.createdAt, state.updatedAt);
  state.metrics.agentSuccessCount = agentSuccessCount;
  state.metrics.agentFailureCount = agentFailureCount;
  state.metrics.meanRetriesPerStage = stageCount > 0
    ? Number((stageRetryCount / stageCount).toFixed(2))
    : 0;
  state.metrics.revisionLoopCount = Number(
    (state.feedbackLoops && Number.isFinite(Number(state.feedbackLoops.currentRound)))
      ? state.feedbackLoops.currentRound
      : 0
  );

  const completedGates = Object.values(state.qualityGates || {}).filter(gate => gate.status === STAGE_STATUS.COMPLETED);
  if (completedGates.length > 0) {
    const passedCount = completedGates.filter(gate => gate.passed === true).length;
    state.metrics.gatePassRate = Number(((passedCount * 100) / completedGates.length).toFixed(2));
  } else {
    state.metrics.gatePassRate = null;
  }

  const stageStatuses = Object.values(state.stages || {}).map(stage => stage.status);
  if (stageStatuses.length > 0 && stageStatuses.every(status => status === STAGE_STATUS.COMPLETED || status === STAGE_STATUS.SKIPPED)) {
    state.status = PIPELINE_STATUS.COMPLETED;
  } else if (stageStatuses.some(status => status === STAGE_STATUS.RUNNING || status === STAGE_STATUS.RETRYING)) {
    state.status = PIPELINE_STATUS.RUNNING;
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
  return state;
}

function readEvents(eventsFile) {
  const raw = fs.readFileSync(eventsFile, 'utf8').trim();
  if (!raw) return [];
  return raw
    .split('\n')
    .filter(Boolean)
    .map((line, index) => {
      let event;
      try {
        event = JSON.parse(line);
      } catch (err) {
        failValidation(`第 ${index + 1} 条事件不是合法 JSON: ${err.message}`);
      }
      validateEvent(event);
      return event;
    });
}

function materializeState(feature, cwd = process.cwd()) {
  if (!feature) {
    throw new Error('缺少 feature 参数');
  }

  const metaDir = path.join(cwd, '.boss', feature, '.meta');
  const eventsFile = path.join(metaDir, 'events.jsonl');
  const execJsonPath = path.join(metaDir, 'execution.json');

  if (!fs.existsSync(eventsFile)) {
    throw new Error(`未找到事件文件: ${path.relative(cwd, eventsFile)}`);
  }

  const events = readEvents(eventsFile);
  const state = projectState(events, feature);
  validateExecutionState(state, feature);
  fs.writeFileSync(execJsonPath, JSON.stringify(state, null, 2) + '\n', 'utf8');

  return {
    eventCount: events.length,
    execJsonPath,
    state
  };
}

function projectState(events, feature) {
  let state = defaultExecutionState(feature);
  for (const event of events) {
    state = applyEvent(state, event, feature);
  }
  return finalizeState(state);
}

function runCli(argv = process.argv.slice(2)) {
  const [feature] = argv;
  if (!feature || feature === '-h' || feature === '--help') {
    process.stderr.write('用法: materialize-state.js <feature>\n');
    process.exit(feature ? 0 : 1);
  }

  try {
    const result = materializeState(feature, process.cwd());
    process.stderr.write(`[MATERIALIZE] 状态已从 ${result.eventCount} 条事件物化到 ${path.relative(process.cwd(), result.execJsonPath)}\n`);
  } catch (err) {
    process.stderr.write(`[MATERIALIZE] ${err.message}\n`);
    process.exit(1);
  }
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  runCli();
}

export {
  materializeState,
  defaultExecutionState,
  finalizeState,
  applyEvent,
  projectState,
  readEvents
};
