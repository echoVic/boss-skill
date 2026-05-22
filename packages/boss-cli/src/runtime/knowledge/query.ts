export interface KnowledgeQueryOptions {
  agent?: string;
  stage?: number;
  limit?: number;
  now?: string | Date;
}

export interface KnowledgeQueryRecord {
  category: string;
  summary: string;
  scope?: 'project' | 'global';
  kind?: 'preference' | 'fact' | 'decision' | 'lesson';
  agent?: string | null;
  stage?: number | null;
  confidence?: number;
  decayScore?: number;
  lastSeenAt?: string;
  expiresAt?: string | null;
}

export interface KnowledgeSummaryEntry {
  category: string;
  summary: string;
  scope?: 'project' | 'global';
}

const MS_PER_DAY = 86_400_000;
const RECENCY_WINDOW_DAYS = 30;
const PROJECT_SCOPE_BONUS = 10_000;
const AGENT_MATCH_BONUS = 1_000;
const STAGE_MATCH_BONUS = 100;
const DECAY_SCORE_WEIGHT = 10;
const CONFIDENCE_WEIGHT = 10;
const PREFERENCE_KIND_BONUS = 500;

function nowMs(now: KnowledgeQueryOptions['now']): number {
  if (now instanceof Date) {
    return now.getTime();
  }
  if (typeof now === 'string') {
    return Date.parse(now);
  }
  return Date.now();
}

function timestampMs(value: string | undefined): number | null {
  if (!value) {
    return null;
  }
  const parsed = Date.parse(value);
  return Number.isNaN(parsed) ? null : parsed;
}

function isExpired(record: KnowledgeQueryRecord, now: number): boolean {
  const expiresAt = timestampMs(record.expiresAt ?? undefined);
  return expiresAt !== null && expiresAt <= now;
}

function recencyScore(record: KnowledgeQueryRecord, now: number): number {
  const lastSeenAt = timestampMs(record.lastSeenAt);
  if (lastSeenAt === null) {
    return 0;
  }
  const ageDays = Math.max(0, (now - lastSeenAt) / MS_PER_DAY);
  return Math.max(0, RECENCY_WINDOW_DAYS - ageDays);
}

function score(record: KnowledgeQueryRecord, target: Pick<KnowledgeQueryOptions, 'agent' | 'stage'>, now: number): number {
  let value = record.scope === 'project' ? PROJECT_SCOPE_BONUS : 0;
  if (record.agent && record.agent === target.agent) {
    value += AGENT_MATCH_BONUS;
  }
  if (record.stage != null && target.stage != null && record.stage === target.stage) {
    value += STAGE_MATCH_BONUS;
  }
  if (record.kind === 'preference') {
    value += PREFERENCE_KIND_BONUS;
  }
  value += (record.decayScore ?? 0) * DECAY_SCORE_WEIGHT;
  value += (record.confidence ?? 0) * CONFIDENCE_WEIGHT;
  value += recencyScore(record, now);
  return value;
}

export function queryKnowledgeRecords(
  records: KnowledgeQueryRecord[],
  { agent, stage, limit = 3, now }: KnowledgeQueryOptions = {}
): KnowledgeQueryRecord[] {
  const currentTime = nowMs(now);
  return records
    .filter((record) => !isExpired(record, currentTime))
    .filter((record) => {
      if (record.stage != null && stage != null && record.stage !== stage) {
        return false;
      }
      if (agent && record.agent && record.agent !== agent) {
        return false;
      }
      return true;
    })
    .sort((left, right) => score(right, { agent, stage }, currentTime) - score(left, { agent, stage }, currentTime))
    .slice(0, limit);
}

export function queryKnowledgeSection(
  records: KnowledgeQueryRecord[],
  options: KnowledgeQueryOptions = {}
): KnowledgeSummaryEntry[] {
  return queryKnowledgeRecords(records, options).map((record) => ({
    category: record.category,
    scope: record.scope,
    summary: record.summary
  }));
}
