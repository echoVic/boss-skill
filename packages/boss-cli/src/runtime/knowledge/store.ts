import * as fs from 'node:fs';
import * as path from 'node:path';

export interface KnowledgeEvidence {
  type: string;
  ref: string;
  [key: string]: unknown;
}

export interface KnowledgeSource {
  type: string;
  ref?: string;
  [key: string]: unknown;
}

export interface KnowledgeRecord {
  id: string;
  scope: 'project' | 'global';
  kind: 'preference' | 'fact' | 'decision' | 'lesson';
  category: string;
  subject: string;
  summary: string;
  source: KnowledgeSource;
  evidence: KnowledgeEvidence[];
  confidence: number;
  createdAt: string;
  lastSeenAt: string;
  expiresAt: string | null;
  decayScore: number;
}

export interface KnowledgeSummaryEntry {
  category: string;
  summary: string;
  scope?: 'project' | 'global';
  [key: string]: unknown;
}

export interface ProjectKnowledgeSummary {
  feature: string;
  generatedAt: string | null;
  startupSummary: KnowledgeSummaryEntry[];
  agentSections: Record<string, KnowledgeSummaryEntry[]>;
}

export interface GlobalKnowledgeSummary {
  generatedAt: string | null;
  startupSummary: KnowledgeSummaryEntry[];
  agentSections: Record<string, KnowledgeSummaryEntry[]>;
}

export interface ProjectKnowledgePayload {
  feature: string;
  records: KnowledgeRecord[];
}

export interface GlobalKnowledgePayload {
  records: KnowledgeRecord[];
}

function ensureDir(dirPath: string): void {
  fs.mkdirSync(dirPath, { recursive: true });
}

function readJson<T>(filePath: string, fallback: T): T {
  if (!fs.existsSync(filePath)) {
    return fallback;
  }
  return JSON.parse(fs.readFileSync(filePath, 'utf8')) as T;
}

function writeJson(filePath: string, value: unknown): void {
  ensureDir(path.dirname(filePath));
  fs.writeFileSync(filePath, JSON.stringify(value, null, 2) + '\n', 'utf8');
}

function projectKnowledgePath(cwd: string, feature: string): string {
  return path.join(cwd, '.boss', feature, '.meta', 'project-knowledge.json');
}

function projectKnowledgeSummaryPath(cwd: string, feature: string): string {
  return path.join(cwd, '.boss', feature, '.meta', 'knowledge-summary.json');
}

function globalKnowledgePath(cwd: string): string {
  return path.join(cwd, '.boss', '.knowledge', 'global-knowledge.json');
}

function globalKnowledgeSummaryPath(cwd: string): string {
  return path.join(cwd, '.boss', '.knowledge', 'global-knowledge-summary.json');
}

function normalizeKeyPart(value: string): string {
  return value.trim().toLowerCase();
}

function recordKey(record: KnowledgeRecord): string {
  return [record.scope, record.kind, record.category, record.subject]
    .map((part) => normalizeKeyPart(part))
    .join(':');
}

function evidenceKey(evidence: KnowledgeEvidence): string {
  return JSON.stringify(
    Object.keys(evidence)
      .sort()
      .reduce<Record<string, unknown>>((accumulator, key) => {
        accumulator[key] = evidence[key];
        return accumulator;
      }, {})
  );
}

function cloneEvidence(evidence: KnowledgeEvidence): KnowledgeEvidence {
  return { ...evidence };
}

function cloneSource(source: KnowledgeSource): KnowledgeSource {
  return { ...source };
}

function cloneRecord(record: KnowledgeRecord): KnowledgeRecord {
  return {
    ...record,
    source: cloneSource(record.source),
    evidence: record.evidence.map(cloneEvidence)
  };
}

function mergeEvidence(existing: KnowledgeEvidence[], incoming: KnowledgeEvidence[]): KnowledgeEvidence[] {
  const merged = new Map<string, KnowledgeEvidence>();
  for (const evidence of existing) {
    merged.set(evidenceKey(evidence), cloneEvidence(evidence));
  }
  for (const evidence of incoming) {
    merged.set(evidenceKey(evidence), cloneEvidence(evidence));
  }
  return [...merged.values()];
}

function laterTimestamp(left: string, right: string): string {
  const leftTime = Date.parse(left);
  const rightTime = Date.parse(right);
  if (Number.isNaN(leftTime) || Number.isNaN(rightTime)) {
    return right >= left ? right : left;
  }
  return rightTime >= leftTime ? right : left;
}

function earlierTimestamp(left: string, right: string): string {
  const leftTime = Date.parse(left);
  const rightTime = Date.parse(right);
  if (Number.isNaN(leftTime) || Number.isNaN(rightTime)) {
    return right <= left ? right : left;
  }
  return rightTime <= leftTime ? right : left;
}

function compareTimestamp(left: string, right: string): number {
  const leftTime = Date.parse(left);
  const rightTime = Date.parse(right);
  if (Number.isNaN(leftTime) || Number.isNaN(rightTime)) {
    return left.localeCompare(right);
  }
  return leftTime - rightTime;
}

function shouldAdoptRepresentative(current: KnowledgeRecord, next: KnowledgeRecord): boolean {
  const lastSeenComparison = compareTimestamp(next.lastSeenAt, current.lastSeenAt);
  if (lastSeenComparison !== 0) {
    return lastSeenComparison > 0;
  }

  if ((next.confidence ?? 0) !== (current.confidence ?? 0)) {
    return (next.confidence ?? 0) > (current.confidence ?? 0);
  }

  return (next.decayScore ?? 0) > (current.decayScore ?? 0);
}

export function mergeKnowledgeRecords(
  existing: KnowledgeRecord[],
  incoming: KnowledgeRecord[]
): KnowledgeRecord[] {
  const merged = new Map(existing.map((record) => [recordKey(record), cloneRecord(record)]));

  for (const record of incoming) {
    const key = recordKey(record);
    const next = cloneRecord(record);

    if (!merged.has(key)) {
      merged.set(key, next);
      continue;
    }

    const current = merged.get(key) as KnowledgeRecord;
    const representative = shouldAdoptRepresentative(current, next) ? next : current;
    merged.set(key, {
      ...representative,
      confidence: Math.max(current.confidence ?? 0, next.confidence ?? 0),
      createdAt: earlierTimestamp(current.createdAt, next.createdAt),
      lastSeenAt: laterTimestamp(current.lastSeenAt, next.lastSeenAt),
      decayScore: Math.max(current.decayScore ?? 0, next.decayScore ?? 0),
      evidence: mergeEvidence(current.evidence, next.evidence)
    });
  }

  return [...merged.values()];
}

export function readProjectKnowledge(
  feature: string,
  { cwd = process.cwd() }: { cwd?: string } = {}
): ProjectKnowledgePayload {
  const filePath = projectKnowledgePath(cwd, feature);
  return readJson<ProjectKnowledgePayload>(filePath, { feature, records: [] });
}

export function saveProjectKnowledge(
  feature: string,
  records: KnowledgeRecord[],
  { cwd = process.cwd() }: { cwd?: string } = {}
): ProjectKnowledgePayload {
  const current = readProjectKnowledge(feature, { cwd });
  const next = {
    feature,
    records: mergeKnowledgeRecords(current.records ?? [], records)
  };
  writeJson(projectKnowledgePath(cwd, feature), next);
  return next;
}

export function readGlobalKnowledge(
  { cwd = process.cwd() }: { cwd?: string } = {}
): GlobalKnowledgePayload {
  return readJson<GlobalKnowledgePayload>(globalKnowledgePath(cwd), { records: [] });
}

export function saveGlobalKnowledge(
  records: KnowledgeRecord[],
  { cwd = process.cwd() }: { cwd?: string } = {}
): GlobalKnowledgePayload {
  const current = readGlobalKnowledge({ cwd });
  const next = {
    records: mergeKnowledgeRecords(current.records ?? [], records)
  };
  writeJson(globalKnowledgePath(cwd), next);
  return next;
}

export function readProjectKnowledgeSummary(
  feature: string,
  { cwd = process.cwd() }: { cwd?: string } = {}
): ProjectKnowledgeSummary {
  return readJson<ProjectKnowledgeSummary>(projectKnowledgeSummaryPath(cwd, feature), {
    feature,
    generatedAt: null,
    startupSummary: [],
    agentSections: {}
  });
}

export function saveProjectKnowledgeSummary(
  feature: string,
  summary: ProjectKnowledgeSummary,
  { cwd = process.cwd() }: { cwd?: string } = {}
): ProjectKnowledgeSummary {
  writeJson(projectKnowledgeSummaryPath(cwd, feature), summary);
  return summary;
}

export function readGlobalKnowledgeSummary(
  { cwd = process.cwd() }: { cwd?: string } = {}
): GlobalKnowledgeSummary {
  return readJson<GlobalKnowledgeSummary>(globalKnowledgeSummaryPath(cwd), {
    generatedAt: null,
    startupSummary: [],
    agentSections: {}
  });
}

export function saveGlobalKnowledgeSummary(
  summary: GlobalKnowledgeSummary,
  { cwd = process.cwd() }: { cwd?: string } = {}
): GlobalKnowledgeSummary {
  writeJson(globalKnowledgeSummaryPath(cwd), summary);
  return summary;
}

export const paths = {
  projectKnowledgePath,
  projectKnowledgeSummaryPath,
  globalKnowledgePath,
  globalKnowledgeSummaryPath
};
