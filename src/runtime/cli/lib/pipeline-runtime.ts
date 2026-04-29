import { spawnSync } from 'node:child_process';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

import { EVENT_TYPES, EVENT_TYPE_VALUES, type EventType } from '../../domain/event-types.js';
import {
  materializeState,
  type ExecutionState,
  type GateState,
  type RuntimeEvent,
  type StageState
} from '../../projectors/materialize-state.js';
import { getPackStateParameters, resolvePipelinePack, type PipelinePackConfig, type PipelinePackStateParameters } from './pack-runtime.js';
import { registerPlugins as registerPluginsRuntime } from './plugin-runtime.js';
import { emitProgress } from '../../../scripts/lib/progress-emitter.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const REPO_ROOT = path.resolve(__dirname, '..', '..', '..', '..');
const DEFAULT_DAG_PATH = path.join(REPO_ROOT, 'harness', 'artifact-dag.json');
const MEMORY_RUNTIME_MODULE_URL = pathToFileURL(path.join(__dirname, 'memory-runtime.js')).href;
const SOURCE_MEMORY_RUNTIME_MODULE_URL = pathToFileURL(
  path.join(REPO_ROOT, 'src', 'runtime', 'cli', 'lib', 'memory-runtime.js')
).href;
const MEMORY_REFRESH_RUNNER = [
  'const [, feature, cwd, moduleUrl] = process.argv;',
  'const memoryRuntime = await import(moduleUrl);',
  'memoryRuntime.rebuildFeatureMemory(feature, { cwd });',
  'memoryRuntime.rebuildGlobalMemory({ cwd });',
  'memoryRuntime.buildFeatureSummary(feature, { cwd });'
].join(' ');

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

  let packName = 'default';
  try {
    const execution = readExecutionView(cwd, feature);
    if (execution.parameters && execution.parameters.pipelinePack) {
      packName = String(execution.parameters.pipelinePack);
    }
  } catch {
    // Ignore if execution view is missing when resolving initial DAG.
  }

  const packDag = path.join(REPO_ROOT, 'harness', 'pipeline-packs', packName, 'artifact-dag.json');
  if (fs.existsSync(packDag)) {
    return packDag;
  }
  return DEFAULT_DAG_PATH;
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
    const message = (err as Error).message;
    if (MEMORY_RUNTIME_MODULE_URL === SOURCE_MEMORY_RUNTIME_MODULE_URL) {
      return;
    }
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
  // Try to resolve from DAG first
  try {
    const dag = readJson<ArtifactDag>(DEFAULT_DAG_PATH);
    const gateDef = dag.artifacts?.[gateName];
    if (gateDef && gateDef.type === 'gate' && gateDef.script) {
      const dagScript = path.join(REPO_ROOT, gateDef.script);
      if (fs.existsSync(dagScript)) return dagScript;
    }
  } catch { /* fall through to legacy resolution */ }

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
  const cwdPluginJson = path.join(cwd, 'harness', 'plugins', gateName, 'plugin.json');
  let pluginJson = cwdPluginJson;
  if (!fs.existsSync(pluginJson)) {
    pluginJson = path.join(REPO_ROOT, 'harness', 'plugins', gateName, 'plugin.json');
  }
  if (!fs.existsSync(pluginJson)) return 3;
  try {
    const plugin = readJson<Record<string, unknown>>(pluginJson);
    if (plugin && Array.isArray(plugin.stages) && plugin.stages.length > 0) {
      const stage = Number(plugin.stages[0]);
      if (Number.isInteger(stage) && stage >= 1) return stage;
    }
  } catch {
    return 3;
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

  const gateConfig = resolveGateConfig(feature, gateName, { cwd });
  const result = spawnSync('bash', [gateScript, feature], {
    cwd,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
    env: { ...process.env, GATE_COVERAGE_THRESHOLD: String(gateConfig.coverage) }
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
