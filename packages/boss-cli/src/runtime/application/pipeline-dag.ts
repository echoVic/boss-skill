/**
 * Pipeline DAG resolution — DAG loading, artifact dependency resolution,
 * hash utilities, and artifact status queries.
 */
import { createHash } from 'node:crypto';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { resolveArtifactDagPath } from '../assets.js';
import type { ArtifactDag, PipelineExecutionState, PipelineParameters } from './state.js';
import { ensureFeatureName, readExecutionView, readJson } from './state.js';
import type { RuntimeEvent } from '../projectors/types.js';
import type {
  ArtifactDagFingerprint,
  ArtifactStatus,
  ReadyArtifact,
  RuntimeHashDescriptor,
} from './pipeline-types.js';
import { OPT_IN_OPTIONAL_ARTIFACTS } from './pipeline-types.js';

// ── Hash utilities ──────────────────────────────────────────────

export function sha256Hex(value: string | Buffer): string {
  return createHash('sha256').update(value).digest('hex');
}

export function stableStringify(value: unknown): string {
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
    value: sha256Hex(stableStringify(value)),
  };
}

export function hashFile(filePath: string): RuntimeHashDescriptor {
  return {
    algorithm: 'sha256',
    value: sha256Hex(fs.readFileSync(filePath)),
  };
}

// ── DAG loading ─────────────────────────────────────────────────

export function resolveDagPath(cwd: string, feature: string, dagPath?: string): string {
  if (dagPath) {
    return path.isAbsolute(dagPath) ? dagPath : path.resolve(cwd, dagPath);
  }

  let packDagPath = '';
  try {
    const execution = readExecutionView(cwd, feature);
    const configuredDag = (execution.parameters?.packConfig as Record<string, unknown> | undefined)
      ?.artifactDag;
    if (typeof configuredDag === 'string' && configuredDag.length > 0) {
      packDagPath = configuredDag;
    }
  } catch {
    packDagPath = '';
  }

  return resolveArtifactDagPath({ cwd, packDagPath });
}

export function loadDagForFeature(
  cwd: string,
  feature: string,
  dagPath?: string,
): { dag: ArtifactDag; dagPath: string } {
  const resolvedPath = resolveDagPath(cwd, feature, dagPath);
  if (!fs.existsSync(resolvedPath)) {
    throw new Error(`未找到 DAG 文件: ${path.relative(cwd, resolvedPath)}`);
  }
  const dag = readJson<ArtifactDag>(resolvedPath);
  return { dag, dagPath: resolvedPath };
}

export function describeArtifactDag(
  cwd: string,
  feature: string,
  packDagPath?: string,
): ArtifactDagFingerprint {
  const { dag, dagPath } = packDagPath
    ? (() => {
        const resolvedPath = resolveArtifactDagPath({ cwd, packDagPath });
        return { dag: readJson<ArtifactDag>(resolvedPath), dagPath: resolvedPath };
      })()
    : loadDagForFeature(cwd, feature);
  return {
    path: path.relative(cwd, dagPath) || path.basename(dagPath),
    version: typeof dag.version === 'string' ? dag.version : '',
    hash: hashFile(dagPath),
  };
}

export function getArtifactDagFingerprint(
  feature: string,
  { cwd = process.cwd() }: { cwd?: string } = {},
): ArtifactDagFingerprint {
  ensureFeatureName(feature);
  return describeArtifactDag(cwd, feature);
}

export function readRuntimeEvents(cwd: string, feature: string): RuntimeEvent[] {
  const eventsFile = path.join(cwd, '.boss', feature, '.meta', 'events.jsonl');
  if (!fs.existsSync(eventsFile)) return [];
  const raw = fs.readFileSync(eventsFile, 'utf8').trim();
  if (!raw) return [];
  return raw
    .split('\n')
    .filter(Boolean)
    .map((line) => JSON.parse(line) as RuntimeEvent);
}

export function isArtifactDagStale(
  cwd: string,
  feature: string,
  execution = readExecutionView(cwd, feature),
): boolean {
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

export function collectCompletedArtifacts(execution: PipelineExecutionState): Set<string> {
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

// ── Artifact status checks ──────────────────────────────────────

function isArtifactDone(
  artifact: string,
  context: {
    cwd: string;
    feature: string;
    execution: PipelineExecutionState;
    completedArtifacts: Set<string>;
  },
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
  context: { execution: PipelineExecutionState },
): boolean {
  const params = context.execution.parameters || ({} as PipelineParameters);
  if ((artifact === 'ui-spec.md' || artifact === 'ui-design.json') && params.skipUI === true)
    return true;
  if (artifact === 'deploy-report.md' && params.skipDeploy === true) return true;
  if ((artifact === 'tech-review.md' || artifact === 'tasks.md') && params.skipReview === true)
    return true;
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
  },
): boolean {
  if (isArtifactDone(input, context)) return true;
  if (isArtifactSkipped(input, context)) return true;
  const def = context.dag.artifacts ? context.dag.artifacts[input] : null;
  const isUiArtifact = input === 'ui-spec.md' || input === 'ui-design.json';
  if (isUiArtifact) return false;
  if (def && def.optional === true) return true;
  return false;
}

export function resolveReadyArtifacts(context: {
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
        stage: def.stage,
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
    ignoreSkipped = false,
  }: { cwd?: string; dagPath?: string; ignoreSkipped?: boolean } = {},
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
    completedArtifacts: collectCompletedArtifacts(execution),
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
  { cwd = process.cwd(), dagPath }: { cwd?: string; dagPath?: string } = {},
): Array<{ artifact: string } & ArtifactStatus> {
  ensureFeatureName(feature);
  const { dag } = loadDagForFeature(cwd, feature, dagPath);
  return Object.keys(dag.artifacts || {}).map((artifact) => ({
    artifact,
    ...getArtifactStatus(feature, artifact, { cwd, dagPath }),
  }));
}
