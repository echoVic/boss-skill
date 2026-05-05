import { spawnSync } from 'node:child_process';
import * as fs from 'node:fs';
import * as path from 'node:path';

import { resolveArtifactDagPath, resolveBuiltInAssetPath } from '../assets.js';
import { EVENT_TYPES, EVENT_TYPE_VALUES, type EventType } from '../domain/event-types.js';
import {
  materializeState,
  type ExecutionState,
  type GateState,
  type RuntimeEvent,
  type StageState
} from '../projectors/materialize-state.js';
import { getPackStateParameters, resolvePipelinePack, type PipelinePackConfig, type PipelinePackStateParameters } from './packs.js';
import { registerPlugins as registerPluginsRuntime } from './plugins.js';
import { buildFeatureSummary, rebuildFeatureMemory, rebuildGlobalMemory } from './memory.js';
import { emitProgress } from '../../infrastructure/process.js';

const DEFAULT_DAG_PATH = resolveBuiltInAssetPath('artifact-dag.json');
const NPM_CMD = process.platform === 'win32' ? 'npm.cmd' : 'npm';
const NPX_CMD = process.platform === 'win32' ? 'npx.cmd' : 'npx';

export interface PipelineParameters extends Record<string, unknown>, PipelinePackStateParameters {
  skipUI: boolean;
  skipDeploy: boolean;
  quick: boolean;
  hitlLevel: string;
  roles: unknown;
  skipFrontend?: boolean;
  skipReview?: boolean;
}

export interface PipelineExecutionState extends Omit<ExecutionState, 'parameters'> {
  parameters: PipelineParameters;
}

export interface ArtifactDefinition {
  inputs?: string[];
  agent?: string | string[] | null;
  stage?: number;
  optional?: boolean;
  description?: string;
  type?: string;
  script?: string;
}

export interface ArtifactDag {
  version?: string;
  description?: string;
  artifacts?: Record<string, ArtifactDefinition>;
}

export interface ReadyArtifact {
  artifact: string;
  agent: string | string[];
  stage: number | undefined;
}

export interface ArtifactStatus {
  status: 'completed' | 'skipped' | 'ready' | 'blocked';
  missing?: string[];
}

function readJson<T>(filePath: string): T {
  return JSON.parse(fs.readFileSync(filePath, 'utf8')) as T;
}

function writeJson(filePath: string, data: unknown): void {
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2) + '\n', 'utf8');
}

function ensureDir(dirPath: string): void {
  fs.mkdirSync(dirPath, { recursive: true });
}

function ensureFeatureName(feature: string): void {
  if (!feature) throw new Error('缺少 feature 参数');
}

function readExecutionView(cwd: string, feature: string): PipelineExecutionState {
  const execJsonPath = path.join(cwd, '.boss', feature, '.meta', 'execution.json');
  if (!fs.existsSync(execJsonPath)) {
    throw new Error(`未找到执行文件: ${path.relative(cwd, execJsonPath)}`);
  }
  return readJson<PipelineExecutionState>(execJsonPath);
}

function resolveDagPath(cwd: string, feature: string, dagPath?: string): string {
  if (dagPath) {
    return path.isAbsolute(dagPath) ? dagPath : path.resolve(cwd, dagPath);
  }

  let packDagPath = '';
  try {
    const execution = readExecutionView(cwd, feature);
    const configuredDag = (execution.parameters?.packConfig as Record<string, unknown> | undefined)?.artifactDag;
    if (typeof configuredDag === 'string' && configuredDag.length > 0) {
      packDagPath = configuredDag;
    }
  } catch {
    packDagPath = '';
  }

  return resolveArtifactDagPath({ cwd, packDagPath });
}

function loadDagForFeature(cwd: string, feature: string, dagPath?: string): { dag: ArtifactDag; dagPath: string } {
  const resolvedPath = resolveDagPath(cwd, feature, dagPath);
  if (!fs.existsSync(resolvedPath)) {
    throw new Error(`未找到 DAG 文件: ${path.relative(cwd, resolvedPath)}`);
  }
  const dag = readJson<ArtifactDag>(resolvedPath);
  return { dag, dagPath: resolvedPath };
}

function collectCompletedArtifacts(execution: PipelineExecutionState): Set<string> {
  const artifacts = new Set<string>();
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

function isArtifactDone(
  artifact: string,
  context: {
    cwd: string;
    feature: string;
    execution: PipelineExecutionState;
    completedArtifacts: Set<string>;
  }
): boolean {
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

function isArtifactSkipped(
  artifact: string,
  context: { execution: PipelineExecutionState }
): boolean {
  const params = context.execution.parameters || ({} as PipelineParameters);
  if (artifact === 'ui-spec.md' && params.skipUI === true) return true;
  if (artifact === 'deploy-report.md' && params.skipDeploy === true) return true;
  if ((artifact === 'tech-review.md' || artifact === 'tasks.md') && params.skipReview === true) return true;
  return false;
}

function isInputSatisfied(
  input: string,
  context: {
    cwd: string;
    feature: string;
    execution: PipelineExecutionState;
    dag: ArtifactDag;
    completedArtifacts: Set<string>;
  }
): boolean {
  if (isArtifactDone(input, context)) return true;
  if (isArtifactSkipped(input, context)) return true;
  const def = context.dag.artifacts ? context.dag.artifacts[input] : null;
  if (def && def.optional === true) return true;
  return false;
}

function resolveReadyArtifacts(context: {
  cwd: string;
  feature: string;
  execution: PipelineExecutionState;
  dag: ArtifactDag;
  completedArtifacts: Set<string>;
}): ReadyArtifact[] {
  const results: ReadyArtifact[] = [];
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
  return results.sort((left, right) => {
    const stageA = Number.isFinite(Number(left.stage)) ? Number(left.stage) : 0;
    const stageB = Number.isFinite(Number(right.stage)) ? Number(right.stage) : 0;
    if (stageA !== stageB) return stageA - stageB;
    return left.artifact.localeCompare(right.artifact);
  });
}

export function getArtifactStatus(
  feature: string,
  artifact: string,
  {
    cwd = process.cwd(),
    dagPath,
    ignoreSkipped = false
  }: { cwd?: string; dagPath?: string; ignoreSkipped?: boolean } = {}
): ArtifactStatus {
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

export function listArtifactStatuses(
  feature: string,
  { cwd = process.cwd(), dagPath }: { cwd?: string; dagPath?: string } = {}
): Array<{ artifact: string } & ArtifactStatus> {
  ensureFeatureName(feature);
  const { dag } = loadDagForFeature(cwd, feature, dagPath);
  return Object.keys(dag.artifacts || {}).map((artifact) => ({
    artifact,
    ...getArtifactStatus(feature, artifact, { cwd, dagPath })
  }));
}

function buildStageState(name: string): StageState {
  return {
    name,
    status: 'pending',
    startTime: null,
    endTime: null,
    retryCount: 0,
    maxRetries: 2,
    failureReason: null,
    artifacts: [],
    gateResults: {}
  };
}

function buildGateState(): GateState {
  return {
    status: 'pending',
    passed: null,
    checks: [],
    executedAt: null
  };
}

export function initPipeline(
  feature: string,
  { cwd = process.cwd() }: { cwd?: string } = {}
): PipelineExecutionState {
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
  const initialState: PipelineExecutionState = {
    schemaVersion: '0.2.0',
    feature,
    createdAt: now,
    updatedAt: now,
    status: 'initialized',
    parameters: {
      pipelinePack: 'default',
      pipelinePackVersion: '',
      enabledStages: [],
      enabledGates: [],
      activeAgents: [],
      packConfig: {},
      skipUI: false,
      skipDeploy: false,
      quick: false,
      hitlLevel: 'auto',
      roles: 'full'
    },
    stages: {
      '1': buildStageState('planning'),
      '2': buildStageState('review'),
      '3': buildStageState('development'),
      '4': buildStageState('deployment')
    },
    qualityGates: {
      gate0: buildGateState(),
      gate1: buildGateState(),
      gate2: buildGateState()
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
  const initializedWithPack: PipelineExecutionState = {
    ...initialState,
    parameters: {
      ...initialState.parameters,
      ...packParameters
    }
  };

  writeJson(execJsonPath, initializedWithPack);
  const initEvent: RuntimeEvent = {
    id: 1,
    type: EVENT_TYPES.PIPELINE_INITIALIZED,
    timestamp: now,
    data: { initialState: initializedWithPack }
  };
  const events: RuntimeEvent[] = [initEvent];
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
  return state as PipelineExecutionState;
}

function appendEvent(
  eventsFile: string,
  event: Omit<RuntimeEvent, 'id'>
): RuntimeEvent {
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

function appendRuntimeEvent(
  cwd: string,
  feature: string,
  eventType: EventType,
  data: Record<string, unknown> = {}
): RuntimeEvent {
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

function refreshMemory(feature: string, cwd: string): void {
  try {
    rebuildFeatureMemory(feature, { cwd });
    rebuildGlobalMemory({ cwd });
    buildFeatureSummary(feature, { cwd });
  } catch (err) {
    const message = (err as Error).message;
    process.stderr.write(`[boss-skill] memory refresh skipped: ${message}\n`);
  }
}

export function getArtifactVersion(
  feature: string,
  artifactName: string,
  { cwd = process.cwd() }: { cwd?: string } = {}
): number {
  ensureFeatureName(feature);
  const eventsFile = path.join(cwd, '.boss', feature, '.meta', 'events.jsonl');
  if (!fs.existsSync(eventsFile)) return 0;
  const raw = fs.readFileSync(eventsFile, 'utf8').trim();
  if (!raw) return 0;
  return raw.split('\n').filter(Boolean)
    .map(line => JSON.parse(line) as RuntimeEvent)
    .filter(e => e.type === EVENT_TYPES.ARTIFACT_RECORDED && e.data.artifact === artifactName)
    .length;
}

export function collectCompletedArtifactsVersioned(
  feature: string,
  { cwd = process.cwd() }: { cwd?: string } = {}
): Map<string, number> {
  ensureFeatureName(feature);
  const eventsFile = path.join(cwd, '.boss', feature, '.meta', 'events.jsonl');
  if (!fs.existsSync(eventsFile)) return new Map();
  const raw = fs.readFileSync(eventsFile, 'utf8').trim();
  if (!raw) return new Map();
  const map = new Map<string, number>();
  for (const line of raw.split('\n').filter(Boolean)) {
    const event = JSON.parse(line) as RuntimeEvent;
    if (event.type === EVENT_TYPES.ARTIFACT_RECORDED) {
      const name = String(event.data.artifact);
      map.set(name, (map.get(name) ?? 0) + 1);
    }
  }
  return map;
}

function backupArtifactVersion(cwd: string, feature: string, artifactName: string, version: number): void {
  const artifactPath = path.join(cwd, '.boss', feature, artifactName);
  if (!fs.existsSync(artifactPath)) return;
  const versionsDir = path.join(cwd, '.boss', feature, '.versions');
  fs.mkdirSync(versionsDir, { recursive: true });
  fs.copyFileSync(artifactPath, path.join(versionsDir, `${artifactName}.v${version}`));
}

export function recordArtifact(
  feature: string,
  artifact: string,
  stage: number | string,
  { cwd = process.cwd() }: { cwd?: string } = {}
): PipelineExecutionState {
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

  const currentVersion = getArtifactVersion(feature, artifact, { cwd });
  const newVersion = currentVersion + 1;
  if (currentVersion >= 1) {
    backupArtifactVersion(cwd, feature, artifact, currentVersion);
  }

  const now = new Date().toISOString();
  appendEvent(eventsFile, {
    type: EVENT_TYPES.ARTIFACT_RECORDED,
    timestamp: now,
    data: {
      artifact,
      stage: stageNumber,
      version: newVersion
    }
  });

  const { state } = materializeState(feature, cwd);
  refreshMemory(feature, cwd);
  return state as PipelineExecutionState;
}

export function skipUpTo(
  feature: string,
  artifactName: string,
  { cwd = process.cwd(), dagPath }: { cwd?: string; dagPath?: string } = {}
): string[] {
  ensureFeatureName(feature);
  if (!artifactName) throw new Error('缺少 artifact 参数');
  const { dag } = loadDagForFeature(cwd, feature, dagPath);
  const artifacts = dag.artifacts || {};
  if (!artifacts[artifactName]) {
    throw new Error(`DAG 中未定义产物: ${artifactName}`);
  }

  // BFS: collect artifactName + all transitive inputs
  const toSkip = new Set<string>();
  const queue = [artifactName];
  while (queue.length > 0) {
    const current = queue.pop()!;
    if (toSkip.has(current)) continue;
    toSkip.add(current);
    const def = artifacts[current];
    if (def && Array.isArray(def.inputs)) {
      for (const input of def.inputs) {
        if (!toSkip.has(input)) queue.push(input);
      }
    }
  }

  // Read current completed set to avoid duplicate events
  const execution = readExecutionView(cwd, feature);
  const completed = collectCompletedArtifacts(execution);
  const skipped: string[] = [];
  const eventsFile = path.join(cwd, '.boss', feature, '.meta', 'events.jsonl');

  for (const name of toSkip) {
    const def = artifacts[name];
    if (!def) continue;
    // Filter out gate entries
    if (def.type === 'gate') continue;
    skipped.push(name);
    if (completed.has(name)) continue;
    const stage = typeof def.stage === 'number' ? def.stage : 1;
    // stage-0 artifacts (like design-brief) cannot be recorded via events
    if (stage < 1) continue;
    appendEvent(eventsFile, {
      type: EVENT_TYPES.ARTIFACT_RECORDED,
      timestamp: new Date().toISOString(),
      data: { artifact: name, stage, version: 1 }
    });
  }

  materializeState(feature, cwd);
  refreshMemory(feature, cwd);
  return skipped;
}

export function recordFeedback(
  feature: string,
  opts: {
    from: string; to: string; artifact: string; reason: string;
    priority?: string; cwd?: string;
  }
): PipelineExecutionState {
  const { cwd = process.cwd(), from, to, artifact, reason, priority = 'recommended' } = opts;
  ensureFeatureName(feature);
  if (!from) throw new Error('缺少 from 参数');
  if (!to) throw new Error('缺少 to 参数');
  if (!artifact) throw new Error('缺少 artifact 参数');
  if (!reason) throw new Error('缺少 reason 参数');

  const execution = readExecutionView(cwd, feature);
  const feedbackLoops = (execution as any).feedbackLoops || { currentRound: 0, maxRounds: 2 };
  const { currentRound = 0, maxRounds = 2 } = feedbackLoops;
  if (currentRound >= maxRounds) {
    throw new Error(`反馈循环已达上限（${currentRound}/${maxRounds}），不再接受修订请求`);
  }

  appendRuntimeEvent(cwd, feature, EVENT_TYPES.REVISION_REQUESTED, {
    from, to, artifact, reason, priority
  });

  const { state } = materializeState(feature, cwd);
  refreshMemory(feature, cwd);
  return state as PipelineExecutionState;
}

export function retryAgent(
  feature: string,
  stage: number | string,
  agentName: string,
  { cwd = process.cwd() }: { cwd?: string } = {}
): PipelineExecutionState {
  ensureFeatureName(feature);
  if (!agentName) throw new Error('缺少 agent 参数');
  const stageNum = Number(stage);

  const { state: cur } = materializeState(feature, cwd);
  const agentState = cur.stages?.[String(stageNum)]?.agents?.[agentName];
  if (!agentState || agentState.status !== 'failed') {
    throw new Error(`Agent ${agentName} 状态为 ${agentState?.status ?? 'unknown'}，只有 failed 状态可以重试`);
  }
  const maxRetries = agentState.maxRetries ?? 2;
  if ((agentState.retryCount ?? 0) >= maxRetries) {
    throw new Error(`Agent ${agentName} 已达最大重试次数（${agentState.retryCount}/${maxRetries}）`);
  }

  appendRuntimeEvent(cwd, feature, EVENT_TYPES.AGENT_RETRY_SCHEDULED, { agent: agentName, stage: stageNum });
  appendRuntimeEvent(cwd, feature, EVENT_TYPES.AGENT_STARTED, { agent: agentName, stage: stageNum });

  const { state } = materializeState(feature, cwd);
  refreshMemory(feature, cwd);
  return state as PipelineExecutionState;
}

export function retryStage(
  feature: string,
  stage: number | string,
  { cwd = process.cwd() }: { cwd?: string } = {}
): PipelineExecutionState {
  ensureFeatureName(feature);
  const stageNum = Number(stage);

  const { state: cur } = materializeState(feature, cwd);
  const stageState = cur.stages?.[String(stageNum)];
  if (!stageState || stageState.status !== 'failed') {
    throw new Error(`阶段 ${stageNum} 状态为 ${stageState?.status ?? 'pending'}，只有 failed 状态可以重试`);
  }
  const maxRetries = stageState.maxRetries ?? 2;
  if ((stageState.retryCount ?? 0) >= maxRetries) {
    throw new Error(`阶段 ${stageNum} 已达最大重试次数（${stageState.retryCount}/${maxRetries}）`);
  }

  appendRuntimeEvent(cwd, feature, EVENT_TYPES.STAGE_RETRYING, { stage: stageNum });
  appendRuntimeEvent(cwd, feature, EVENT_TYPES.STAGE_STARTED, { stage: stageNum });

  const { state } = materializeState(feature, cwd);
  refreshMemory(feature, cwd);
  return state as PipelineExecutionState;
}

function validateStageTransition(from: string, to: string): boolean {
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

function normalizeStageNumber(stage: number | string | null | undefined): number {
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

function ensureEventsFile(cwd: string, feature: string): string {
  const metaDir = path.join(cwd, '.boss', feature, '.meta');
  const eventsFile = path.join(metaDir, 'events.jsonl');
  if (!fs.existsSync(eventsFile)) {
    throw new Error(`未找到事件文件: ${path.relative(cwd, eventsFile)}`);
  }
  return eventsFile;
}

function mapStageStatusToEvent(status: string): EventType | null {
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

function mapAgentStatusToEvent(status: string): EventType | null {
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

function normalizeArtifacts(value: string | string[] | null | undefined): string[] {
  if (!value) return [];
  if (Array.isArray(value)) return value.filter(Boolean);
  return [value].filter(Boolean);
}

function parseGatePassed(value: boolean | string | null | undefined): boolean | null {
  if (value === undefined || value === null) return null;
  if (typeof value === 'boolean') return value;
  if (value === 'true') return true;
  if (value === 'false') return false;
  throw new Error('gate-passed 必须是 true 或 false');
}

export function updateStage(
  feature: string,
  stage: number | string,
  status: string,
  {
    cwd = process.cwd(),
    reason,
    artifacts,
    gate,
    gatePassed
  }: {
    cwd?: string;
    reason?: string;
    artifacts?: string | string[];
    gate?: string;
    gatePassed?: boolean | string | null;
  } = {}
): PipelineExecutionState {
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
  return state as PipelineExecutionState;
}

export function updateAgent(
  feature: string,
  stage: number | string,
  agent: string,
  status: string,
  {
    cwd = process.cwd(),
    reason
  }: {
    cwd?: string;
    reason?: string;
  } = {}
): PipelineExecutionState {
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
  return state as PipelineExecutionState;
}

export function getReadyArtifacts(
  feature: string,
  { cwd = process.cwd(), dagPath }: { cwd?: string; dagPath?: string } = {}
): ReadyArtifact[] {
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

function resolveGateScript(cwd: string, gateName: string, skipOnError: boolean): string {
  const pluginDirs = [
    path.join(cwd, '.boss', 'plugins', gateName),
    resolveBuiltInAssetPath('plugins', gateName)
  ];
  for (const pluginDir of pluginDirs) {
    const pluginJson = path.join(pluginDir, 'plugin.json');
    if (fs.existsSync(pluginJson)) {
      try {
        const plugin = readJson<Record<string, unknown>>(pluginJson);
        const hooks = plugin.hooks && typeof plugin.hooks === 'object' ? plugin.hooks as Record<string, unknown> : {};
        if (typeof hooks.gate === 'string' && hooks.gate.length > 0) {
          const hookPath = path.join(pluginDir, hooks.gate);
          if (fs.existsSync(hookPath)) return hookPath;
        }
      } catch {
        // Fall through to legacy gate.sh resolution for hand-written local plugins.
      }
    }

    const legacyGate = path.join(pluginDir, 'gate.sh');
    if (fs.existsSync(legacyGate)) return legacyGate;
  }

  if (skipOnError) return '';
  throw new Error(`门禁脚本未找到: ${gateName}`);
}

function isBuiltInGate(gateName: string): boolean {
  return gateName === 'gate0' || gateName === 'gate1' || gateName === 'gate2';
}

function resolveGateStage(cwd: string, gateName: string): number {
  // Try to resolve from DAG first
  try {
    const dag = readJson<ArtifactDag>(DEFAULT_DAG_PATH);
    const gateDef = dag.artifacts?.[gateName];
    if (gateDef && gateDef.type === 'gate' && typeof gateDef.stage === 'number') {
      return gateDef.stage;
    }
  } catch { /* fall through to legacy resolution */ }

  if (gateName === 'gate0' || gateName === 'gate1' || gateName === 'gate2') {
    return 3;
  }
  const pluginJsonPaths = [
    path.join(cwd, '.boss', 'plugins', gateName, 'plugin.json'),
    path.join(resolveBuiltInAssetPath('plugins', gateName), 'plugin.json')
  ];
  for (const pluginJson of pluginJsonPaths) {
    if (!fs.existsSync(pluginJson)) continue;
    try {
      const plugin = readJson<Record<string, unknown>>(pluginJson);
      if (plugin && Array.isArray(plugin.stages) && plugin.stages.length > 0) {
        const stage = Number(plugin.stages[0]);
        if (Number.isInteger(stage) && stage >= 1) return stage;
      }
    } catch {
      return 3;
    }
  }
  return 3;
}

function parseGateChecks(output: string): unknown[] {
  if (!output) return [];
  const trimmed = output.trim();
  if (!trimmed) return [];
  if (trimmed.startsWith('[')) {
    try {
      const parsed = JSON.parse(trimmed) as unknown;
      if (Array.isArray(parsed)) return parsed;
    } catch {
      // fall through to line parsing
    }
  }
  return trimmed
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean);
}

interface GateCheck {
  name: string;
  passed: boolean;
  detail?: string;
}

interface GateExecution {
  status: number;
  stdout: string;
  stderr: string;
}

function check(name: string, passed: boolean, detail?: string): GateCheck {
  return detail ? { name, passed, detail } : { name, passed };
}

function commandExists(command: string): boolean {
  const result = spawnSync(command, ['--version'], { encoding: 'utf8', stdio: ['ignore', 'ignore', 'ignore'] });
  return !result.error;
}

function runCommand(command: string, args: string[], cwd: string): { status: number; output: string } {
  const result = spawnSync(command, args, {
    cwd,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe']
  });
  return {
    status: result.status ?? 1,
    output: `${result.stdout || ''}${result.stderr || ''}`
      .trim()
      .split('\n')
      .slice(-30)
      .join('\n')
  };
}

function readPackageJson(cwd: string): Record<string, unknown> {
  const pkgPath = path.join(cwd, 'package.json');
  if (!fs.existsSync(pkgPath)) return {};
  try {
    return readJson<Record<string, unknown>>(pkgPath);
  } catch {
    return {};
  }
}

function depsContain(pkg: Record<string, unknown>, name: string): boolean {
  const deps = pkg.dependencies && typeof pkg.dependencies === 'object' ? pkg.dependencies as Record<string, unknown> : {};
  const devDeps = pkg.devDependencies && typeof pkg.devDependencies === 'object' ? pkg.devDependencies as Record<string, unknown> : {};
  return name in deps || name in devDeps;
}

function findFiles(dir: string, predicate: (file: string) => boolean, max = 1): string[] {
  const results: string[] = [];
  function walk(current: string): void {
    if (results.length >= max) return;
    for (const entry of fs.readdirSync(current, { withFileTypes: true })) {
      if (entry.name === 'node_modules' || entry.name === '.git') continue;
      const fullPath = path.join(current, entry.name);
      if (entry.isDirectory()) {
        walk(fullPath);
      } else if (predicate(fullPath)) {
        results.push(fullPath);
        if (results.length >= max) return;
      }
    }
  }
  if (fs.existsSync(dir)) walk(dir);
  return results;
}

function fileContains(cwd: string, extensions: string[], pattern: RegExp): boolean {
  return findFiles(cwd, (file) => {
    if (!extensions.some((ext) => file.endsWith(ext))) return false;
    try {
      return pattern.test(fs.readFileSync(file, 'utf8'));
    } catch {
      return false;
    }
  }).length > 0;
}

function runGate0(cwd: string): GateExecution {
  const checks: GateCheck[] = [];
  const logs: string[] = ['[GATE0] Gate 0: 代码质量检查'];
  let passed = true;

  if (fs.existsSync(path.join(cwd, 'tsconfig.json')) && commandExists(NPX_CMD)) {
    const result = runCommand(NPX_CMD, ['tsc', '--noEmit'], cwd);
    checks.push(check('typescript-compile', result.status === 0, result.status === 0 ? undefined : 'tsc --noEmit 失败'));
    if (result.output) logs.push(result.output);
    passed &&= result.status === 0;
  } else {
    checks.push(check('typescript-compile', true, '跳过：无 tsconfig.json'));
  }

  let lintFound = false;
  if (fs.existsSync(path.join(cwd, 'biome.json')) || fs.existsSync(path.join(cwd, 'biome.jsonc'))) {
    lintFound = true;
    const result = runCommand(NPX_CMD, ['biome', 'check', '.'], cwd);
    checks.push(check('lint', result.status === 0, result.status === 0 ? undefined : 'biome check 失败'));
    if (result.output) logs.push(result.output);
    passed &&= result.status === 0;
  } else if (['.eslintrc', '.eslintrc.js', '.eslintrc.json', '.eslintrc.yml', 'eslint.config.js', 'eslint.config.mjs'].some((name) => fs.existsSync(path.join(cwd, name)))) {
    lintFound = true;
    const result = runCommand(NPX_CMD, ['eslint', '.', '--max-warnings=0'], cwd);
    checks.push(check('lint', result.status === 0, result.status === 0 ? undefined : 'eslint 有 error'));
    if (result.output) logs.push(result.output);
    passed &&= result.status === 0;
  }
  if (!lintFound) checks.push(check('lint', true, '跳过：无 Lint 配置'));

  if (fs.existsSync(path.join(cwd, 'package.json')) && commandExists(NPM_CMD)) {
    const audit = spawnSync(NPM_CMD, ['audit', '--json'], { cwd, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] });
    let severe = 0;
    try {
      const parsed = JSON.parse(audit.stdout || '{}') as { metadata?: { vulnerabilities?: { high?: number; critical?: number } } };
      severe = Number(parsed.metadata?.vulnerabilities?.high ?? 0) + Number(parsed.metadata?.vulnerabilities?.critical ?? 0);
    } catch {
      severe = 0;
    }
    checks.push(check('dependency-audit', severe === 0, severe > 0 ? `${severe} 个高危漏洞` : undefined));
    passed &&= severe === 0;
  } else {
    checks.push(check('dependency-audit', true, '跳过：无 package.json'));
  }

  const secretPatterns = [/AKIA[0-9A-Z]{16}/, /-----BEGIN (RSA |EC |DSA )?PRIVATE KEY-----/, /ghp_[a-zA-Z0-9]{36}/, /sk-[a-zA-Z0-9]{48}/];
  const secretHits = secretPatterns.filter((pattern) => fileContains(cwd, ['.ts', '.js', '.py', '.go', '.env', '.yaml', '.yml'], pattern)).length;
  checks.push(check('secrets-scan', secretHits === 0, secretHits > 0 ? `${secretHits} 类敏感信息模式` : undefined));
  passed &&= secretHits === 0;

  const unsafeHits = [
    fileContains(cwd, ['.js', '.ts'], /eval\(/),
    fileContains(cwd, ['.jsx', '.tsx'], /dangerouslySetInnerHTML/),
    fileContains(cwd, ['.js', '.ts'], /innerHTML\s*=/)
  ].filter(Boolean).length;
  checks.push(check('unsafe-patterns', unsafeHits === 0, unsafeHits > 0 ? `发现 ${unsafeHits} 类不安全模式` : undefined));
  passed &&= unsafeHits === 0;

  return { status: passed ? 0 : 1, stdout: `${JSON.stringify(checks)}\n`, stderr: `${logs.join('\n')}\n` };
}

function runGate1(cwd: string, coverageThreshold: number): GateExecution {
  const checks: GateCheck[] = [];
  const logs: string[] = ['[GATE1] Gate 1: 测试门禁'];
  let passed = true;
  const pkg = readPackageJson(cwd);
  let testCommand: [string, string[]] | null = null;
  let coverageCommand: [string, string[]] | null = null;

  if (fs.existsSync(path.join(cwd, 'package.json'))) {
    if (depsContain(pkg, 'vitest')) {
      testCommand = [NPX_CMD, ['vitest', 'run']];
      coverageCommand = [NPX_CMD, ['vitest', 'run', '--coverage', '--reporter=json']];
    } else if (depsContain(pkg, 'jest')) {
      testCommand = [NPX_CMD, ['jest']];
      coverageCommand = [NPX_CMD, ['jest', '--coverage', '--coverageReporters=json-summary']];
    } else {
      const scripts = pkg.scripts && typeof pkg.scripts === 'object' ? pkg.scripts as Record<string, unknown> : {};
      if (typeof scripts.test === 'string' && scripts.test !== 'echo "Error: no test specified" && exit 1') {
        testCommand = [NPM_CMD, ['test']];
      }
    }
  } else if (fs.existsSync(path.join(cwd, 'pyproject.toml')) && commandExists('pytest')) {
    testCommand = ['pytest', []];
    coverageCommand = ['pytest', ['--cov', '--cov-report=json']];
  } else if (fs.existsSync(path.join(cwd, 'Cargo.toml'))) {
    testCommand = ['cargo', ['test']];
  } else if (fs.existsSync(path.join(cwd, 'go.mod'))) {
    testCommand = ['go', ['test', './...']];
    coverageCommand = ['go', ['test', '-coverprofile=coverage.out', './...']];
  }

  if (!testCommand) {
    checks.push(check('unit-tests', true, '跳过：未检测到测试框架'));
    checks.push(check('coverage', true, '跳过：未检测到测试框架'));
    checks.push(check('e2e-tests', true, '跳过：未检测到测试框架'));
    return { status: 0, stdout: `${JSON.stringify(checks)}\n`, stderr: `${logs.join('\n')}\n` };
  }

  const testResult = runCommand(testCommand[0], testCommand[1], cwd);
  checks.push(check('unit-tests', testResult.status === 0, testResult.status === 0 ? undefined : `${testCommand.join(' ')} 执行失败`));
  if (testResult.output) logs.push(testResult.output);
  passed &&= testResult.status === 0;

  if (coverageCommand) {
    runCommand(coverageCommand[0], coverageCommand[1], cwd);
    let pct: number | null = null;
    const summaryPath = path.join(cwd, 'coverage', 'coverage-summary.json');
    const coverageJson = path.join(cwd, 'coverage.json');
    if (fs.existsSync(summaryPath)) {
      const summary = readJson<{ total?: { lines?: { pct?: number }; statements?: { pct?: number } } }>(summaryPath);
      pct = Number(summary.total?.lines?.pct ?? summary.total?.statements?.pct ?? NaN);
    } else if (fs.existsSync(coverageJson)) {
      const summary = readJson<{ totals?: { percent_covered?: number } }>(coverageJson);
      pct = Number(summary.totals?.percent_covered ?? NaN);
    }
    if (pct != null && Number.isFinite(pct)) {
      const ok = Math.floor(pct) >= coverageThreshold;
      checks.push(check('coverage', ok, `${pct}%${ok ? '' : ` < ${coverageThreshold}%`}`));
      passed &&= ok;
    } else {
      checks.push(check('coverage', true, '无法解析覆盖率，跳过'));
    }
  } else {
    checks.push(check('coverage', true, '跳过：无覆盖率工具'));
  }

  if (fs.existsSync(path.join(cwd, 'playwright.config.ts')) || fs.existsSync(path.join(cwd, 'playwright.config.js'))) {
    const result = runCommand(NPX_CMD, ['playwright', 'test'], cwd);
    checks.push(check('e2e-tests', result.status === 0, result.status === 0 ? 'Playwright' : 'Playwright 测试失败'));
    passed &&= result.status === 0;
  } else if (fs.existsSync(path.join(cwd, 'cypress.config.ts')) || fs.existsSync(path.join(cwd, 'cypress.config.js'))) {
    const result = runCommand(NPX_CMD, ['cypress', 'run'], cwd);
    checks.push(check('e2e-tests', result.status === 0, result.status === 0 ? 'Cypress' : 'Cypress 测试失败'));
    passed &&= result.status === 0;
  } else {
    checks.push(check('e2e-tests', true, '跳过：未检测到 E2E 测试框架'));
  }

  return { status: passed ? 0 : 1, stdout: `${JSON.stringify(checks)}\n`, stderr: `${logs.join('\n')}\n` };
}

function runGate2(cwd: string): GateExecution {
  const checks: GateCheck[] = [];
  const logs: string[] = ['[GATE2] Gate 2: 性能门禁'];
  const pkg = readPackageJson(cwd);
  const isWeb = ['next', 'react', 'vue', 'svelte', '@angular/core'].some((dep) => depsContain(pkg, dep));
  const hasApi = ['express', 'fastify', 'koa', 'hono'].some((dep) => depsContain(pkg, dep)) || ['go.mod', 'requirements.txt', 'pyproject.toml'].some((file) => fs.existsSync(path.join(cwd, file)));

  checks.push(check('lighthouse', true, isWeb ? '跳过：未执行 Lighthouse（TS gate 暂不启动浏览器服务）' : '跳过：非 Web 前端项目'));
  checks.push(check('api-p99', true, hasApi ? '跳过：未执行 API 压测（服务可能未启动）' : '跳过：无 API 框架'));
  return { status: 0, stdout: `${JSON.stringify(checks)}\n`, stderr: `${logs.join('\n')}\n` };
}

function runBuiltInGate(gateName: string, cwd: string, coverageThreshold: number): GateExecution {
  if (gateName === 'gate0') return runGate0(cwd);
  if (gateName === 'gate1') return runGate1(cwd, coverageThreshold);
  if (gateName === 'gate2') return runGate2(cwd);
  throw new Error(`未知内置门禁: ${gateName}`);
}

export function resolveGateConfig(
  feature: string,
  _gateName: string,
  { cwd = process.cwd() }: { cwd?: string } = {}
): { coverage: number } {
  const defaults = { coverage: 70 };
  try {
    const execution = readExecutionView(cwd, feature);
    const packConfig = (execution as any).parameters?.packConfig as PipelinePackConfig | undefined;
    return { coverage: packConfig?.gateConfig?.coverage ?? defaults.coverage };
  } catch { return defaults; }
}

export function evaluateGates(
  feature: string,
  gateName: string,
  {
    cwd = process.cwd(),
    dryRun = false,
    skipOnError = false
  }: { cwd?: string; dryRun?: boolean; skipOnError?: boolean } = {}
): {
  gate: string;
  passed: boolean;
  checks: unknown[];
  skipped?: boolean;
  dryRun?: boolean;
  execution: PipelineExecutionState;
} {
  ensureFeatureName(feature);
  if (!gateName) throw new Error('缺少 gate-name 参数');
  readExecutionView(cwd, feature);

  const gateConfig = resolveGateConfig(feature, gateName, { cwd });
  let result: GateExecution;
  if (isBuiltInGate(gateName)) {
    result = runBuiltInGate(gateName, cwd, gateConfig.coverage);
  } else {
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

    const command = gateScript.endsWith('.sh') ? 'bash' : gateScript;
    const args = gateScript.endsWith('.sh') ? [gateScript, feature] : [feature];
    const external = spawnSync(command, args, {
      cwd,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe'],
      env: { ...process.env, GATE_COVERAGE_THRESHOLD: String(gateConfig.coverage) }
    });

    if (external.error) {
      throw external.error;
    }
    result = {
      status: external.status ?? 1,
      stdout: external.stdout || '',
      stderr: external.stderr || ''
    };
  }

  const combinedOutput = `${result.stdout || ''}${result.stderr || ''}`;
  const checks = parseGateChecks(result.stdout || combinedOutput);
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
    execution: state as PipelineExecutionState
  };
}

export function registerPlugins(
  feature: string,
  { cwd = process.cwd(), type }: { cwd?: string; type?: string } = {}
): ReturnType<typeof registerPluginsRuntime> {
  ensureFeatureName(feature);
  return registerPluginsRuntime(feature, { cwd, type });
}

// --- Tech Stack Cache ---

export function cacheTechStack(
  feature: string,
  techStack: Record<string, unknown>,
  { cwd = process.cwd() }: { cwd?: string } = {}
): void {
  ensureFeatureName(feature);
  const metaDir = path.join(cwd, '.boss', feature, '.meta');
  ensureDir(metaDir);
  writeJson(path.join(metaDir, 'tech-stack.json'), techStack);
}

export function readCachedTechStack(
  feature: string,
  { cwd = process.cwd() }: { cwd?: string } = {}
): Record<string, unknown> | null {
  ensureFeatureName(feature);
  const filePath = path.join(cwd, '.boss', feature, '.meta', 'tech-stack.json');
  if (!fs.existsSync(filePath)) return null;
  return readJson<Record<string, unknown>>(filePath);
}

// --- Stall Detection ---

export interface StalledAgent {
  agent: string;
  stage: number;
  startTime: string;
  elapsedMs: number;
  failed?: boolean;
}

export interface CheckStallResult {
  stalled: StalledAgent[];
}

const DEFAULT_MAX_DURATION_MS = 30 * 60 * 1000; // 30 minutes

export function checkStall(
  feature: string,
  {
    cwd = process.cwd(),
    maxDurationMs = DEFAULT_MAX_DURATION_MS,
    autoFail = false
  }: { cwd?: string; maxDurationMs?: number; autoFail?: boolean } = {}
): CheckStallResult {
  ensureFeatureName(feature);
  const execution = readExecutionView(cwd, feature);
  const now = Date.now();
  const stalled: StalledAgent[] = [];

  for (const [stageKey, stage] of Object.entries(execution.stages || {})) {
    if (!stage || !stage.agents) continue;
    for (const [agentName, agentState] of Object.entries(stage.agents)) {
      if (!agentState || agentState.status !== 'running' || !agentState.startTime) continue;
      const elapsed = now - new Date(agentState.startTime).getTime();
      if (elapsed > maxDurationMs) {
        const entry: StalledAgent = {
          agent: agentName,
          stage: Number(stageKey),
          startTime: agentState.startTime,
          elapsedMs: elapsed
        };
        if (autoFail) {
          appendRuntimeEvent(cwd, feature, EVENT_TYPES.AGENT_FAILED, {
            agent: agentName,
            stage: Number(stageKey),
            reason: 'timeout'
          });
          entry.failed = true;
        }
        stalled.push(entry);
      }
    }
  }

  if (autoFail && stalled.length > 0) {
    materializeState(feature, cwd);
  }

  return { stalled };
}
