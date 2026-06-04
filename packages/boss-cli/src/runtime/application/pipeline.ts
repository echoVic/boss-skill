import * as fs from 'node:fs';
import * as path from 'node:path';
import { createHash } from 'node:crypto';

import { resolveArtifactDagPath } from '../assets.js';
import { EVENT_TYPES, type EventType } from '../domain/event-types.js';
import {
  materializeState,
  type RuntimeEvent,
  type GateState,
  type StageState
} from '../projectors/materialize-state.js';
import { getPackStateParameters, resolvePipelinePack } from './packs.js';
import { registerPlugins as registerPluginsRuntime } from './plugins.js';
import { compileWorkflowPlan, persistWorkflowPlan } from './workflow.js';
import { emitProgress } from '../../infrastructure/process.js';
import {
  appendEvent,
  appendRuntimeEvent,
  ensureDir,
  ensureFeatureName,
  type ArtifactDag,
  readExecutionView,
  readJson,
  refreshMemory,
  type PipelineExecutionState,
  type PipelineParameters,
  writeJson
} from './state.js';

export interface ReadyArtifact {
  artifact: string;
  agent: string | string[];
  stage: number | undefined;
}

export interface ArtifactStatus {
  status: 'completed' | 'skipped' | 'ready' | 'blocked';
  missing?: string[];
}

export interface RuntimeHashDescriptor {
  algorithm: 'sha256';
  value: string;
}

export interface ArtifactDagFingerprint {
  path: string;
  version: string;
  hash: RuntimeHashDescriptor;
}

export interface AgentReuseInput {
  prompt?: string;
  promptFingerprint?: string;
  dependencyArtifacts?: string[];
  opts?: Record<string, unknown>;
}

export interface AgentReuseDecision {
  reusable: boolean;
  reason: string;
  dagStale: boolean;
  promptFingerprint: RuntimeHashDescriptor;
  inputDigest: RuntimeHashDescriptor;
  completedEventId?: number;
}

export const FORMAL_SOURCE_OF_TRUTH_ARTIFACTS = Object.freeze([
  'prd.md',
  'architecture.md',
  'ui-spec.md',
  'ui-design.json',
  'tech-review.md',
  'tasks.md'
] as const);
const OPT_IN_OPTIONAL_ARTIFACTS = new Set([
  'strategic-review.md',
  'ui-design-variants.json',
  'changelog.md'
]);

export function isFormalSourceOfTruthArtifact(artifact: string): boolean {
  return FORMAL_SOURCE_OF_TRUTH_ARTIFACTS.includes(
    artifact as (typeof FORMAL_SOURCE_OF_TRUTH_ARTIFACTS)[number]
  );
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

function sha256Hex(value: string | Buffer): string {
  return createHash('sha256').update(value).digest('hex');
}

function stableStringify(value: unknown): string {
  if (value === null || typeof value !== 'object') {
    return JSON.stringify(value);
  }
  if (Array.isArray(value)) {
    return `[${value.map((item) => stableStringify(item)).join(',')}]`;
  }
  const object = value as Record<string, unknown>;
  return `{${Object.keys(object)
    .sort()
    .map((key) => `${JSON.stringify(key)}:${stableStringify(object[key])}`)
    .join(',')}}`;
}

export function hashRuntimeValue(value: unknown): RuntimeHashDescriptor {
  return {
    algorithm: 'sha256',
    value: sha256Hex(stableStringify(value))
  };
}

function hashFile(filePath: string): RuntimeHashDescriptor {
  return {
    algorithm: 'sha256',
    value: sha256Hex(fs.readFileSync(filePath))
  };
}

function describeArtifactDag(cwd: string, feature: string, packDagPath?: string): ArtifactDagFingerprint {
  const { dag, dagPath } = packDagPath
    ? (() => {
        const resolvedPath = resolveArtifactDagPath({ cwd, packDagPath });
        return { dag: readJson<ArtifactDag>(resolvedPath), dagPath: resolvedPath };
      })()
    : loadDagForFeature(cwd, feature);
  return {
    path: path.relative(cwd, dagPath) || path.basename(dagPath),
    version: typeof dag.version === 'string' ? dag.version : '',
    hash: hashFile(dagPath)
  };
}

export function getArtifactDagFingerprint(
  feature: string,
  { cwd = process.cwd() }: { cwd?: string } = {}
): ArtifactDagFingerprint {
  ensureFeatureName(feature);
  return describeArtifactDag(cwd, feature);
}

function readRuntimeEvents(cwd: string, feature: string): RuntimeEvent[] {
  const eventsFile = path.join(cwd, '.boss', feature, '.meta', 'events.jsonl');
  if (!fs.existsSync(eventsFile)) return [];
  const raw = fs.readFileSync(eventsFile, 'utf8').trim();
  if (!raw) return [];
  return raw
    .split('\n')
    .filter(Boolean)
    .map((line) => JSON.parse(line) as RuntimeEvent);
}

function isArtifactDagStale(cwd: string, feature: string, execution = readExecutionView(cwd, feature)): boolean {
  const initializedDag = execution.parameters?.artifactDag;
  if (!initializedDag || typeof initializedDag !== 'object') return false;
  const initialHash = (initializedDag as { hash?: { value?: unknown } }).hash?.value;
  if (typeof initialHash !== 'string') return false;
  try {
    return getArtifactDagFingerprint(feature, { cwd }).hash.value !== initialHash;
  } catch {
    return true;
  }
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
  if ((artifact === 'ui-spec.md' || artifact === 'ui-design.json') && params.skipUI === true) return true;
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
  const isUiArtifact = input === 'ui-spec.md' || input === 'ui-design.json';
  if (isUiArtifact) return false;
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
    if (def.optional === true && OPT_IN_OPTIONAL_ARTIFACTS.has(name)) continue;
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
    conversations: {
      threads: [],
      messages: [],
      resolutions: []
    },
    derivedTodos: [],
    conversationMetrics: {
      opened: 0,
      resolved: 0,
      todos: 0,
      huddles: 0,
      unresolved: 0
    },
    humanInterventions: [],
    revisionRequests: [],
    feedbackLoops: { maxRounds: 2, currentRound: 0 },
    pause: null
  };

  const pack = resolvePipelinePack(cwd);
  const packParameters = getPackStateParameters(pack);
  const packDagPath =
    typeof packParameters.packConfig?.artifactDag === 'string'
      ? packParameters.packConfig.artifactDag
      : undefined;
  const artifactDag = describeArtifactDag(cwd, feature, packDagPath);
  const artifactDagPath = path.isAbsolute(artifactDag.path)
    ? artifactDag.path
    : path.resolve(cwd, artifactDag.path);
  const workflowPlan = compileWorkflowPlan({
    feature,
    pack,
    artifactDag: readJson<ArtifactDag>(artifactDagPath),
    artifactDagFingerprint: artifactDag
  });
  const workflow = persistWorkflowPlan({ cwd, feature, plan: workflowPlan });
  const runId = hashRuntimeValue({
    feature,
    createdAt: now,
    workflowHash: workflow.workflowHash,
    artifactDag
  }).value;
  const initializedWithPack: PipelineExecutionState = {
    ...initialState,
    parameters: {
      ...initialState.parameters,
      ...packParameters,
      artifactDag,
      workflowPlanPath: workflow.workflowPlanPath,
      workflowHash: workflow.workflowHash.value,
      packHash: workflow.packHash.value,
      artifactDagHash: workflow.artifactDagHash.value,
      runId
    }
  };

  writeJson(execJsonPath, initializedWithPack);
  const initEvent: RuntimeEvent = {
    id: 1,
    type: EVENT_TYPES.PIPELINE_INITIALIZED,
    timestamp: now,
    data: {
      initialState: initializedWithPack,
      artifactDag,
      workflowPlan: {
        path: workflow.workflowPlanPath,
        hash: workflow.workflowHash
      },
      runId
    }
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

function readNextEventId(eventsFile: string): number {
  const raw = fs.readFileSync(eventsFile, 'utf8').trim();
  return raw ? raw.split('\n').length + 1 : 1;
}

function assertSafeArtifactName(artifact: string): void {
  if (
    artifact !== path.basename(artifact) ||
    path.isAbsolute(artifact) ||
    artifact.includes('/') ||
    artifact.includes('\\') ||
    artifact.split(/[\\/]/).includes('..') ||
    artifact.includes('..')
  ) {
    throw new Error(`无效 artifact 路径: ${artifact}`);
  }
}

export function recordArtifact(
  feature: string,
  artifact: string,
  stage: number | string,
  { cwd = process.cwd() }: { cwd?: string } = {}
): PipelineExecutionState {
  ensureFeatureName(feature);
  if (!artifact) throw new Error('缺少 artifact 参数');
  return recordArtifacts(feature, [artifact], stage, { cwd });
}

export function recordArtifacts(
  feature: string,
  artifacts: string[],
  stage: number | string,
  {
    cwd = process.cwd(),
    beforeAppend
  }: {
    cwd?: string;
    beforeAppend?: () => void | (() => void);
  } = {}
): PipelineExecutionState {
  ensureFeatureName(feature);
  if (artifacts.length === 0) throw new Error('缺少 artifact 参数');
  for (const artifact of artifacts) {
    if (!artifact) throw new Error('缺少 artifact 参数');
    assertSafeArtifactName(artifact);
  }
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

  const versions = artifacts.map((artifact) => ({
    artifact,
    currentVersion: getArtifactVersion(feature, artifact, { cwd })
  }));
  for (const version of versions) {
    if (version.currentVersion >= 1) {
      backupArtifactVersion(cwd, feature, version.artifact, version.currentVersion);
    }
  }

  const now = new Date().toISOString();
  const nextId = readNextEventId(eventsFile);
  const events = versions.map((version, index) => ({
    id: nextId + index,
    type: EVENT_TYPES.ARTIFACT_RECORDED,
    timestamp: now,
    data: {
      artifact: version.artifact,
      stage: stageNumber,
      version: version.currentVersion + 1
    }
  }));
  const rollback = beforeAppend?.();
  try {
    fs.appendFileSync(eventsFile, `${events.map((event) => JSON.stringify(event)).join('\n')}\n`, 'utf8');
  } catch (err) {
    if (typeof rollback === 'function') {
      rollback();
    }
    throw err;
  }

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

  if (status === 'running' && currentState.status === 'paused') {
    appendRuntimeEvent(cwd, feature, EVENT_TYPES.PIPELINE_RESUMED, {
      stage: stageNumber,
      requestedBy: 'runtime'
    });
  }

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
    reason,
    prompt,
    promptFingerprint,
    dependencyArtifacts,
    opts
  }: {
    cwd?: string;
    reason?: string;
    prompt?: string;
    promptFingerprint?: string;
    dependencyArtifacts?: string[];
    opts?: Record<string, unknown>;
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

  const currentExecution = readExecutionView(cwd, feature);
  const currentAgent = currentExecution.stages?.[String(stageNumber)]?.agents?.[agent];
  const hasFingerprintInput =
    prompt !== undefined ||
    promptFingerprint !== undefined ||
    (dependencyArtifacts !== undefined && dependencyArtifacts.length > 0) ||
    (opts !== undefined && Object.keys(opts).length > 0);
  const fingerprints =
    !hasFingerprintInput && currentAgent?.promptFingerprint && currentAgent?.inputDigest
      ? {
          promptFingerprint: { algorithm: 'sha256' as const, value: currentAgent.promptFingerprint },
          inputDigest: { algorithm: 'sha256' as const, value: currentAgent.inputDigest }
        }
      : buildAgentFingerprints(feature, agent, stageNumber, {
          cwd,
          prompt,
          promptFingerprint,
          dependencyArtifacts,
          opts
        });

  appendRuntimeEvent(cwd, feature, eventType, {
    agent,
    stage: stageNumber,
    promptFingerprint: fingerprints.promptFingerprint.value,
    inputDigest: fingerprints.inputDigest.value,
    ...(reason ? { reason } : {})
  });

  const { state } = materializeState(feature, cwd);
  refreshMemory(feature, cwd);
  return state as PipelineExecutionState;
}

function readArtifactDigest(cwd: string, feature: string, artifact: string): RuntimeHashDescriptor | null {
  const artifactPath = path.join(cwd, '.boss', feature, artifact);
  if (!fs.existsSync(artifactPath) || !fs.statSync(artifactPath).isFile()) return null;
  return hashFile(artifactPath);
}

function buildAgentFingerprints(
  feature: string,
  agent: string,
  stage: number,
  {
    cwd,
    prompt,
    promptFingerprint,
    dependencyArtifacts = [],
    opts = {}
  }: AgentReuseInput & { cwd: string }
): { promptFingerprint: RuntimeHashDescriptor; inputDigest: RuntimeHashDescriptor } {
  const promptHash: RuntimeHashDescriptor = {
    algorithm: 'sha256',
    value: promptFingerprint || sha256Hex(prompt || '')
  };
  const dependencies = dependencyArtifacts
    .slice()
    .sort()
    .map((artifact) => ({
      artifact,
      hash: readArtifactDigest(cwd, feature, artifact)
    }));
  const inputDigest = hashRuntimeValue({
    agent,
    stage,
    promptFingerprint: promptHash,
    opts,
    dependencies
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
    opts = {}
  }: AgentReuseInput & { cwd?: string } = {}
): AgentReuseDecision {
  ensureFeatureName(feature);
  const stageNumber = normalizeStageNumber(stage);
  const execution = readExecutionView(cwd, feature);
  const dagStale = isArtifactDagStale(cwd, feature, execution);
  const fingerprints = buildAgentFingerprints(feature, agent, stageNumber, {
    cwd,
    prompt,
    promptFingerprint,
    dependencyArtifacts,
    opts
  });

  const completed = readRuntimeEvents(cwd, feature)
    .slice()
    .reverse()
    .find((event) =>
      event.type === EVENT_TYPES.AGENT_COMPLETED &&
      event.data.agent === agent &&
      Number(event.data.stage) === stageNumber
    );

  if (!completed) {
    return {
      reusable: false,
      reason: 'no-completed-agent-event',
      dagStale,
      ...fingerprints
    };
  }

  if (completed.data.promptFingerprint !== fingerprints.promptFingerprint.value) {
    return {
      reusable: false,
      reason: 'prompt-fingerprint-changed',
      dagStale,
      completedEventId: completed.id,
      ...fingerprints
    };
  }

  if (completed.data.inputDigest !== fingerprints.inputDigest.value) {
    return {
      reusable: false,
      reason: 'input-digest-changed',
      dagStale,
      completedEventId: completed.id,
      ...fingerprints
    };
  }

  return {
    reusable: !dagStale,
    reason: dagStale ? 'artifact-dag-stale' : 'input-digest-matched',
    dagStale,
    completedEventId: completed.id,
    ...fingerprints
  };
}

export function pausePipeline(
  feature: string,
  {
    cwd = process.cwd(),
    reason = '',
    requestedBy = 'user'
  }: { cwd?: string; reason?: string; requestedBy?: string } = {}
): PipelineExecutionState {
  ensureFeatureName(feature);
  const execution = readExecutionView(cwd, feature);
  if (execution.status === 'paused') {
    throw new Error('流水线已处于暂停状态');
  }
  if (execution.status === 'completed' || execution.status === 'failed') {
    throw new Error(`流水线已终止（${execution.status}），无法暂停`);
  }
  appendRuntimeEvent(cwd, feature, EVENT_TYPES.PIPELINE_PAUSED, {
    reason,
    requestedBy
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
