import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

import { EVENT_TYPES, EVENT_TYPE_VALUES } from '../../domain/event-types.js';
import { materializeState } from '../../projectors/materialize-state.js';
import { getPackStateParameters, resolvePipelinePack } from './pack-runtime.js';
import { registerPlugins as registerPluginsRuntime } from './plugin-runtime.js';
import { emitProgress } from '../../../scripts/lib/progress-emitter.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const REPO_ROOT = path.resolve(__dirname, '..', '..', '..');
const DEFAULT_DAG_PATH = path.join(REPO_ROOT, 'harness', 'artifact-dag.json');
const MEMORY_RUNTIME_MODULE_URL = pathToFileURL(path.join(__dirname, 'memory-runtime.js')).href;
const MEMORY_REFRESH_RUNNER = [
  'const [, feature, cwd, moduleUrl] = process.argv;',
  'const memoryRuntime = await import(moduleUrl);',
  'memoryRuntime.rebuildFeatureMemory(feature, { cwd });',
  'memoryRuntime.rebuildGlobalMemory({ cwd });',
  'memoryRuntime.buildFeatureSummary(feature, { cwd });'
].join(' ');

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

function writeJson(filePath, data) {
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2) + '\n', 'utf8');
}

function ensureDir(dirPath) {
  fs.mkdirSync(dirPath, { recursive: true });
}

function ensureFeatureName(feature) {
  if (!feature) throw new Error('缺少 feature 参数');
}

function readExecutionView(cwd, feature) {
  const execJsonPath = path.join(cwd, '.boss', feature, '.meta', 'execution.json');
  if (!fs.existsSync(execJsonPath)) {
    throw new Error(`未找到执行文件: ${path.relative(cwd, execJsonPath)}`);
  }
  return readJson(execJsonPath);
}

function resolveDagPath(cwd, feature, dagPath) {
  if (dagPath) {
    return path.isAbsolute(dagPath) ? dagPath : path.resolve(cwd, dagPath);
  }

  let packName = 'default';
  try {
    const execution = readExecutionView(cwd, feature);
    if (execution.parameters && execution.parameters.pipelinePack) {
      packName = execution.parameters.pipelinePack;
    }
  } catch (err) {
    // Ignore if execution view is missing when resolving initial DAG.
  }

  const packDag = path.join(REPO_ROOT, 'harness', 'pipeline-packs', packName, 'artifact-dag.json');
  if (fs.existsSync(packDag)) {
    return packDag;
  }
  return DEFAULT_DAG_PATH;
}

function loadDagForFeature(cwd, feature, dagPath) {
  const resolvedPath = resolveDagPath(cwd, feature, dagPath);
  if (!fs.existsSync(resolvedPath)) {
    throw new Error(`未找到 DAG 文件: ${path.relative(cwd, resolvedPath)}`);
  }
  const dag = readJson(resolvedPath);
  return { dag, dagPath: resolvedPath };
}

function collectCompletedArtifacts(execution) {
  const artifacts = new Set();
  const stages = execution.stages || {};
  for (const stage of Object.values(stages)) {
    if (stage && Array.isArray(stage.artifacts)) {
      for (const artifact of stage.artifacts) {
        if (artifact) artifacts.add(artifact);
      }
    }
  }
  return artifacts;
}

function isArtifactDone(artifact, context) {
  if (artifact === 'design-brief') {
    const designBriefPath = path.join(context.cwd, '.boss', context.feature, 'design-brief.md');
    if (fs.existsSync(designBriefPath)) return true;
    return context.completedArtifacts.has('prd.md');
  }

  if (artifact === 'code') {
    const stage3 = (context.execution.stages || {})['3'];
    const agents = (stage3 && stage3.agents) || {};
    const frontendStatus = agents['boss-frontend'] ? agents['boss-frontend'].status : 'N/A';
    const backendStatus = agents['boss-backend'] ? agents['boss-backend'].status : 'N/A';
    const frontendOk = frontendStatus === 'completed' || frontendStatus === 'N/A';
    const backendOk = backendStatus === 'completed' || backendStatus === 'N/A';
    if (frontendOk && backendOk) {
      return frontendStatus === 'completed' || backendStatus === 'completed';
    }
    return false;
  }

  return context.completedArtifacts.has(artifact);
}

function isArtifactSkipped(artifact, context) {
  const params = context.execution.parameters || {};
  if (artifact === 'ui-spec.md' && params.skipUI === true) return true;
  if (artifact === 'deploy-report.md' && params.skipDeploy === true) return true;
  return false;
}

function isInputSatisfied(input, context) {
  if (isArtifactDone(input, context)) return true;
  if (isArtifactSkipped(input, context)) return true;
  const def = context.dag.artifacts ? context.dag.artifacts[input] : null;
  if (def && def.optional === true) return true;
  return false;
}

function resolveReadyArtifacts(context) {
  const results = [];
  const artifacts = context.dag.artifacts || {};

  for (const name of Object.keys(artifacts)) {
    const def = artifacts[name];
    if (!def) continue;
    if (isArtifactDone(name, context)) continue;
    if (isArtifactSkipped(name, context)) continue;
    if (def.agent == null) continue;

    const inputs = Array.isArray(def.inputs) ? def.inputs : [];
    let allReady = true;
    for (const input of inputs) {
      if (!isInputSatisfied(input, context)) {
        allReady = false;
        break;
      }
    }
    if (allReady) {
      results.push({
        artifact: name,
        agent: def.agent,
        stage: def.stage
      });
    }
  }
  return results.sort((a, b) => {
    const stageA = Number.isFinite(Number(a.stage)) ? Number(a.stage) : 0;
    const stageB = Number.isFinite(Number(b.stage)) ? Number(b.stage) : 0;
    if (stageA !== stageB) return stageA - stageB;
    return a.artifact.localeCompare(b.artifact);
  });
}

function getArtifactStatus(feature, artifact, { cwd = process.cwd(), dagPath, ignoreSkipped = false } = {}) {
  ensureFeatureName(feature);
  if (!artifact) throw new Error('缺少 artifact 参数');
  const execution = readExecutionView(cwd, feature);
  const { dag } = loadDagForFeature(cwd, feature, dagPath);
  const def = dag.artifacts ? dag.artifacts[artifact] : null;
  if (!def) {
    throw new Error(`DAG 中未定义产物: ${artifact}`);
  }

  const context = {
    cwd,
    feature,
    execution,
    dag,
    completedArtifacts: collectCompletedArtifacts(execution)
  };

  if (isArtifactDone(artifact, context)) {
    return { status: 'completed' };
  }
  if (!ignoreSkipped && isArtifactSkipped(artifact, context)) {
    return { status: 'skipped' };
  }

  const inputs = Array.isArray(def.inputs) ? def.inputs : [];
  const missing = inputs.filter((input) => !isInputSatisfied(input, context));
  if (missing.length === 0) {
    return { status: 'ready' };
  }

  return { status: 'blocked', missing };
}

function listArtifactStatuses(feature, { cwd = process.cwd(), dagPath } = {}) {
  ensureFeatureName(feature);
  const { dag } = loadDagForFeature(cwd, feature, dagPath);
  return Object.keys(dag.artifacts || {}).map((artifact) => ({
    artifact,
    ...getArtifactStatus(feature, artifact, { cwd, dagPath })
  }));
}

function initPipeline(feature, { cwd = process.cwd() } = {}) {
  ensureFeatureName(feature);
  const bossDir = path.join(cwd, '.boss', feature);
  const metaDir = path.join(bossDir, '.meta');
  ensureDir(metaDir);

  const execJsonPath = path.join(metaDir, 'execution.json');
  const eventsFile = path.join(metaDir, 'events.jsonl');
  const execExists = fs.existsSync(execJsonPath);
  const eventsExists = fs.existsSync(eventsFile);
  if (execExists && eventsExists) {
    throw new Error(`流水线已存在: ${path.relative(cwd, metaDir)}`);
  }
  if (execExists || eventsExists) {
    throw new Error(`检测到不完整的流水线状态: ${path.relative(cwd, metaDir)}`);
  }

  const now = new Date().toISOString();
  const stageState = (name) => ({
    name,
    status: 'pending',
    startTime: null,
    endTime: null,
    retryCount: 0,
    maxRetries: 2,
    failureReason: null,
    artifacts: [],
    gateResults: {}
  });
  const gateState = () => ({
    status: 'pending',
    passed: null,
    checks: [],
    executedAt: null
  });

  const initialState = {
    schemaVersion: '0.2.0',
    feature,
    createdAt: now,
    updatedAt: now,
    status: 'initialized',
    parameters: {
      skipUI: false,
      skipDeploy: false,
      quick: false,
      hitlLevel: 'auto',
      roles: 'full'
    },
    stages: {
      '1': stageState('planning'),
      '2': stageState('review'),
      '3': stageState('development'),
      '4': stageState('deployment')
    },
    qualityGates: {
      gate0: gateState(),
      gate1: gateState(),
      gate2: gateState()
    },
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

  const pack = resolvePipelinePack(cwd);
  const packParameters = getPackStateParameters(pack);
  const initializedWithPack = {
    ...initialState,
    parameters: {
      ...initialState.parameters,
      ...packParameters
    }
  };

  writeJson(execJsonPath, initializedWithPack);
  const initEvent = {
    id: 1,
    type: EVENT_TYPES.PIPELINE_INITIALIZED,
    timestamp: now,
    data: { initialState: initializedWithPack }
  };
  const events = [initEvent];
  if (pack.name !== 'default') {
    events.push({
      id: 2,
      type: EVENT_TYPES.PACK_APPLIED,
      timestamp: now,
      data: {
        pack: pack.name,
        version: pack.version,
        config: pack.config,
        parameters: packParameters
      }
    });
  }
  fs.writeFileSync(eventsFile, `${events.map((event) => JSON.stringify(event)).join('\n')}\n`, 'utf8');
  const { state } = materializeState(feature, cwd);
  refreshMemory(feature, cwd);
  return state;
}

function appendEvent(eventsFile, event) {
  let id = 1;
  if (fs.existsSync(eventsFile)) {
    const raw = fs.readFileSync(eventsFile, 'utf8').trim();
    if (raw) {
      id = raw.split('\n').length + 1;
    }
  }
  const payload = { ...event, id };
  fs.appendFileSync(eventsFile, `${JSON.stringify(payload)}\n`, 'utf8');
  return payload;
}

function appendRuntimeEvent(cwd, feature, eventType, data = {}) {
  if (!EVENT_TYPE_VALUES.includes(eventType)) {
    throw new Error(`无效事件类型: ${eventType}`);
  }
  const eventsFile = ensureEventsFile(cwd, feature);
  return appendEvent(eventsFile, {
    type: eventType,
    timestamp: new Date().toISOString(),
    data
  });
}

function refreshMemory(feature, cwd) {
  try {
    const child = spawnSync(
      process.execPath,
      ['--input-type=module', '-e', MEMORY_REFRESH_RUNNER, feature, cwd, MEMORY_RUNTIME_MODULE_URL],
      {
        cwd,
        encoding: 'utf8',
        timeout: 30000,
        maxBuffer: 1024 * 1024
      }
    );

    if (child.error) {
      throw child.error;
    }

    if (child.status !== 0) {
      throw new Error((child.stderr || child.stdout || `exit ${child.status}`).trim());
    }
  } catch (err) {
    process.stderr.write(`[boss-skill] memory refresh skipped: ${err.message}\n`);
  }
}

function recordArtifact(feature, artifact, stage, { cwd = process.cwd() } = {}) {
  ensureFeatureName(feature);
  if (!artifact) throw new Error('缺少 artifact 参数');
  if (stage == null) {
    throw new Error('缺少 stage 参数');
  }
  const stageNumber = Number(stage);
  if (!Number.isInteger(stageNumber)) {
    throw new Error('stage 必须是整数');
  }
  if (stageNumber < 1 || stageNumber > 4) {
    throw new Error('stage 必须是 1-4');
  }

  const metaDir = path.join(cwd, '.boss', feature, '.meta');
  const eventsFile = path.join(metaDir, 'events.jsonl');
  if (!fs.existsSync(eventsFile)) {
    throw new Error(`未找到事件文件: ${path.relative(cwd, eventsFile)}`);
  }

  const now = new Date().toISOString();
  appendEvent(eventsFile, {
    type: 'ArtifactRecorded',
    timestamp: now,
    data: {
      artifact,
      stage: stageNumber
    }
  });

  const { state } = materializeState(feature, cwd);
  refreshMemory(feature, cwd);
  return state;
}

function validateStageTransition(from, to) {
  switch (`${from}:${to}`) {
    case 'pending:running':
    case 'pending:skipped':
    case 'running:completed':
    case 'running:failed':
    case 'failed:retrying':
    case 'retrying:running':
    case 'completed:running':
      return true;
    default:
      return false;
  }
}

function normalizeStageNumber(stage) {
  if (stage == null) throw new Error('缺少 stage 参数');
  const stageNumber = Number(stage);
  if (!Number.isInteger(stageNumber)) {
    throw new Error('stage 必须是整数');
  }
  if (stageNumber < 1 || stageNumber > 4) {
    throw new Error('stage 必须是 1-4');
  }
  return stageNumber;
}

function ensureEventsFile(cwd, feature) {
  const metaDir = path.join(cwd, '.boss', feature, '.meta');
  const eventsFile = path.join(metaDir, 'events.jsonl');
  if (!fs.existsSync(eventsFile)) {
    throw new Error(`未找到事件文件: ${path.relative(cwd, eventsFile)}`);
  }
  return eventsFile;
}

function mapStageStatusToEvent(status) {
  switch (status) {
    case 'running':
      return EVENT_TYPES.STAGE_STARTED;
    case 'completed':
      return EVENT_TYPES.STAGE_COMPLETED;
    case 'failed':
      return EVENT_TYPES.STAGE_FAILED;
    case 'retrying':
      return EVENT_TYPES.STAGE_RETRYING;
    case 'skipped':
      return EVENT_TYPES.STAGE_SKIPPED;
    default:
      return null;
  }
}

function mapAgentStatusToEvent(status) {
  switch (status) {
    case 'running':
      return EVENT_TYPES.AGENT_STARTED;
    case 'completed':
      return EVENT_TYPES.AGENT_COMPLETED;
    case 'failed':
      return EVENT_TYPES.AGENT_FAILED;
    default:
      return null;
  }
}

function normalizeArtifacts(value) {
  if (!value) return [];
  if (Array.isArray(value)) return value.filter(Boolean);
  return [value].filter(Boolean);
}

function parseGatePassed(value) {
  if (value === undefined || value === null) return null;
  if (typeof value === 'boolean') return value;
  if (value === 'true') return true;
  if (value === 'false') return false;
  throw new Error('gate-passed 必须是 true 或 false');
}

function updateStage(feature, stage, status, {
  cwd = process.cwd(),
  reason,
  artifacts,
  gate,
  gatePassed
} = {}) {
  ensureFeatureName(feature);
  if (!status) throw new Error('缺少 status 参数');
  const validStatuses = ['running', 'completed', 'failed', 'retrying', 'skipped'];
  if (!validStatuses.includes(status)) {
    throw new Error(`无效状态: ${status}（允许: ${validStatuses.join(' ')}）`);
  }

  const stageNumber = normalizeStageNumber(stage);
  const { state: currentState } = materializeState(feature, cwd);
  const currentStage = currentState.stages ? currentState.stages[String(stageNumber)] : null;
  const currentStatus = currentStage ? currentStage.status : 'pending';
  if (!validateStageTransition(currentStatus, status)) {
    throw new Error(`无效的状态转换: ${currentStatus} → ${status}（阶段 ${stageNumber}）`);
  }

  const eventType = mapStageStatusToEvent(status);
  if (!eventType) throw new Error(`无效状态: ${status}`);

  appendRuntimeEvent(cwd, feature, eventType, {
    stage: stageNumber,
    ...(reason ? { reason } : {})
  });

  if (status === 'running') {
    emitProgress(cwd, feature, { type: 'stage-start', data: { stage: stageNumber } });
  } else if (status === 'completed') {
    emitProgress(cwd, feature, { type: 'stage-complete', data: { stage: stageNumber } });
  } else if (status === 'failed') {
    emitProgress(cwd, feature, { type: 'stage-failed', data: { stage: stageNumber } });
  }

  const artifactList = normalizeArtifacts(artifacts);
  for (const artifact of artifactList) {
    appendRuntimeEvent(cwd, feature, EVENT_TYPES.ARTIFACT_RECORDED, {
      artifact,
      stage: stageNumber
    });
  }

  const passed = parseGatePassed(gatePassed);
  if (gate && passed !== null) {
    appendRuntimeEvent(cwd, feature, EVENT_TYPES.GATE_EVALUATED, {
      gate,
      passed,
      stage: stageNumber
    });
  }

  const { state } = materializeState(feature, cwd);
  refreshMemory(feature, cwd);
  return state;
}

function updateAgent(feature, stage, agent, status, {
  cwd = process.cwd(),
  reason
} = {}) {
  ensureFeatureName(feature);
  if (!agent) throw new Error('缺少 agent 参数');
  if (!status) throw new Error('缺少 status 参数');
  const validStatuses = ['running', 'completed', 'failed'];
  if (!validStatuses.includes(status)) {
    throw new Error(`无效状态: ${status}`);
  }
  const stageNumber = normalizeStageNumber(stage);
  const eventType = mapAgentStatusToEvent(status);
  if (!eventType) throw new Error(`无效状态: ${status}`);

  appendRuntimeEvent(cwd, feature, eventType, {
    agent,
    stage: stageNumber,
    ...(reason ? { reason } : {})
  });

  const { state } = materializeState(feature, cwd);
  refreshMemory(feature, cwd);
  return state;
}

function getReadyArtifacts(feature, { cwd = process.cwd(), dagPath } = {}) {
  ensureFeatureName(feature);
  const execution = readExecutionView(cwd, feature);
  const { dag } = loadDagForFeature(cwd, feature, dagPath);
  const context = {
    cwd,
    feature,
    execution,
    dag,
    completedArtifacts: collectCompletedArtifacts(execution)
  };
  return resolveReadyArtifacts(context);
}

function resolveGateScript(cwd, gateName, skipOnError) {
  let scriptPath = '';
  switch (gateName) {
    case 'gate0':
      scriptPath = path.join(REPO_ROOT, 'scripts', 'gates', 'gate0-code-quality.sh');
      break;
    case 'gate1':
      scriptPath = path.join(REPO_ROOT, 'scripts', 'gates', 'gate1-testing.sh');
      break;
    case 'gate2':
      scriptPath = path.join(REPO_ROOT, 'scripts', 'gates', 'gate2-performance.sh');
      break;
    default: {
      const cwdPlugin = path.join(cwd, 'harness', 'plugins', gateName, 'gate.sh');
      if (fs.existsSync(cwdPlugin)) {
        return cwdPlugin;
      }
      scriptPath = path.join(REPO_ROOT, 'harness', 'plugins', gateName, 'gate.sh');
      break;
    }
  }

  if (!fs.existsSync(scriptPath)) {
    if (skipOnError) return '';
    throw new Error(`门禁脚本未找到: ${gateName}`);
  }
  return scriptPath;
}

function resolveGateStage(cwd, gateName) {
  if (gateName === 'gate0' || gateName === 'gate1' || gateName === 'gate2') {
    return 3;
  }
  const cwdPluginJson = path.join(cwd, 'harness', 'plugins', gateName, 'plugin.json');
  let pluginJson = cwdPluginJson;
  if (!fs.existsSync(pluginJson)) {
    pluginJson = path.join(REPO_ROOT, 'harness', 'plugins', gateName, 'plugin.json');
  }
  if (!fs.existsSync(pluginJson)) return 3;
  try {
    const plugin = readJson(pluginJson);
    if (plugin && Array.isArray(plugin.stages) && plugin.stages.length > 0) {
      const stage = Number(plugin.stages[0]);
      if (Number.isInteger(stage) && stage >= 1 && stage <= 4) return stage;
    }
  } catch {
    return 3;
  }
  return 3;
}

function parseGateChecks(output) {
  if (!output) return [];
  const trimmed = output.trim();
  if (!trimmed) return [];
  if (trimmed.startsWith('[')) {
    try {
      const parsed = JSON.parse(trimmed);
      if (Array.isArray(parsed)) return parsed;
    } catch {
      // fall through to line parsing
    }
  }
  return trimmed.split('\n').map(line => line.trim()).filter(Boolean);
}

function evaluateGates(feature, gateName, { cwd = process.cwd(), dryRun = false, skipOnError = false } = {}) {
  ensureFeatureName(feature);
  if (!gateName) throw new Error('缺少 gate-name 参数');
  readExecutionView(cwd, feature);

  const gateScript = resolveGateScript(cwd, gateName, skipOnError);
  if (!gateScript) {
    return {
      gate: gateName,
      passed: true,
      checks: [],
      skipped: true,
      execution: readExecutionView(cwd, feature)
    };
  }

  const result = spawnSync('bash', [gateScript, feature], {
    cwd,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe']
  });

  if (result.error) {
    throw result.error;
  }

  const combinedOutput = `${result.stdout || ''}${result.stderr || ''}`;
  const checks = parseGateChecks(combinedOutput);
  const passed = result.status === 0;

  if (result.stderr) {
    process.stderr.write(result.stderr);
  }

  if (dryRun) {
    return {
      gate: gateName,
      passed,
      checks,
      dryRun: true,
      execution: readExecutionView(cwd, feature)
    };
  }

  const stage = resolveGateStage(cwd, gateName);
  appendRuntimeEvent(cwd, feature, EVENT_TYPES.GATE_EVALUATED, {
    gate: gateName,
    passed,
    stage,
    checks
  });

  const { state } = materializeState(feature, cwd);
  refreshMemory(feature, cwd);
  return {
    gate: gateName,
    passed,
    checks,
    execution: state
  };
}

function registerPlugins(feature, { cwd = process.cwd(), type } = {}) {
  ensureFeatureName(feature);
  return registerPluginsRuntime(feature, { cwd, type });
}

const _internal = {
  getArtifactStatus,
  loadDagForFeature
};

export {
  initPipeline,
  getReadyArtifacts,
  getArtifactStatus,
  listArtifactStatuses,
  recordArtifact,
  updateStage,
  updateAgent,
  registerPlugins,
  evaluateGates,
  _internal
};
