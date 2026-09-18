/**
 * Pipeline artifact recording — event appending, artifact versioning,
 * backup, and skip-up-to logic.
 */
import * as fs from 'node:fs';
import * as path from 'node:path';
import { appendLineSync } from '../../infrastructure/fs.js';
import { EVENT_TYPES } from '../domain/event-types.js';
import type { RuntimeEvent } from '../projectors/types.js';
import { materializeState } from '../projectors/materialize-state.js';
import type { PipelineExecutionState } from './state.js';
import { appendEvent, ensureFeatureName, readExecutionView, refreshMemory } from './state.js';
import {
  collectCompletedArtifacts,
  loadDagForFeature,
} from './pipeline-dag.js';

export function getArtifactVersion(
  feature: string,
  artifactName: string,
  { cwd = process.cwd() }: { cwd?: string } = {},
): number {
  ensureFeatureName(feature);
  const eventsFile = path.join(cwd, '.boss', feature, '.meta', 'events.jsonl');
  if (!fs.existsSync(eventsFile)) return 0;
  const raw = fs.readFileSync(eventsFile, 'utf8').trim();
  if (!raw) return 0;
  return raw
    .split('\n')
    .filter(Boolean)
    .map((line) => JSON.parse(line) as RuntimeEvent)
    .filter((e) => e.type === EVENT_TYPES.ARTIFACT_RECORDED && e.data.artifact === artifactName)
    .length;
}

export function collectCompletedArtifactsVersioned(
  feature: string,
  { cwd = process.cwd() }: { cwd?: string } = {},
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

function backupArtifactVersion(
  cwd: string,
  feature: string,
  artifactName: string,
  version: number,
): void {
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
  { cwd = process.cwd() }: { cwd?: string } = {},
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
    beforeAppend,
  }: {
    cwd?: string;
    beforeAppend?: () => undefined | (() => void);
  } = {},
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
    currentVersion: getArtifactVersion(feature, artifact, { cwd }),
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
      version: version.currentVersion + 1,
    },
  }));
  const rollback = beforeAppend?.();
  try {
    for (const event of events) {
      appendLineSync(eventsFile, JSON.stringify(event));
    }
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
  { cwd = process.cwd(), dagPath }: { cwd?: string; dagPath?: string } = {},
): string[] {
  ensureFeatureName(feature);
  if (!artifactName) throw new Error('缺少 artifact 参数');
  const { dag } = loadDagForFeature(cwd, feature, dagPath);
  const artifacts = dag.artifacts || {};
  if (!artifacts[artifactName]) {
    throw new Error(`DAG 中未定义产物: ${artifactName}`);
  }

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

  const execution = readExecutionView(cwd, feature);
  const completed = collectCompletedArtifacts(execution);
  const skipped: string[] = [];
  const eventsFile = path.join(cwd, '.boss', feature, '.meta', 'events.jsonl');

  for (const name of toSkip) {
    const def = artifacts[name];
    if (!def) continue;
    if (def.type === 'gate') continue;
    skipped.push(name);
    if (completed.has(name)) continue;
    const stage = typeof def.stage === 'number' ? def.stage : 1;
    if (stage < 1) continue;
    appendEvent(eventsFile, {
      type: EVENT_TYPES.ARTIFACT_RECORDED,
      timestamp: new Date().toISOString(),
      data: { artifact: name, stage, version: 1 },
    });
  }

  materializeState(feature, cwd);
  refreshMemory(feature, cwd);
  return skipped;
}
