import * as fs from 'node:fs';
import * as path from 'node:path';

import { EVENT_TYPE_VALUES, type EventType } from '../domain/event-types.js';
import type { ExecutionState, RuntimeEvent } from '../projectors/materialize-state.js';
import { buildFeatureSummary, rebuildFeatureMemory, rebuildGlobalMemory } from './memory.js';
import { refreshKnowledge } from './knowledge.js';
import type { PipelinePackStateParameters } from './packs.js';

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

export function readJson<T>(filePath: string): T {
  return JSON.parse(fs.readFileSync(filePath, 'utf8')) as T;
}

export function writeJson(filePath: string, data: unknown): void {
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2) + '\n', 'utf8');
}

export function ensureDir(dirPath: string): void {
  fs.mkdirSync(dirPath, { recursive: true });
}

export function ensureFeatureName(feature: string): void {
  if (!feature) throw new Error('缺少 feature 参数');
}

export function readExecutionView(cwd: string, feature: string): PipelineExecutionState {
  const execJsonPath = path.join(cwd, '.boss', feature, '.meta', 'execution.json');
  if (!fs.existsSync(execJsonPath)) {
    throw new Error(`未找到执行文件: ${path.relative(cwd, execJsonPath)}`);
  }
  return readJson<PipelineExecutionState>(execJsonPath);
}

export function ensureEventsFile(cwd: string, feature: string): string {
  const metaDir = path.join(cwd, '.boss', feature, '.meta');
  const eventsFile = path.join(metaDir, 'events.jsonl');
  if (!fs.existsSync(eventsFile)) {
    throw new Error(`未找到事件文件: ${path.relative(cwd, eventsFile)}`);
  }
  return eventsFile;
}

export function appendEvent(
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

export function appendRuntimeEvent(
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

export function refreshMemory(feature: string, cwd: string): void {
  try {
    rebuildFeatureMemory(feature, { cwd });
    rebuildGlobalMemory({ cwd });
    buildFeatureSummary(feature, { cwd });
  } catch (err) {
    const message = (err as Error).message;
    process.stderr.write(`[boss-skill] memory refresh skipped: ${message}\n`);
  }
  refreshKnowledge(feature, cwd);
}
