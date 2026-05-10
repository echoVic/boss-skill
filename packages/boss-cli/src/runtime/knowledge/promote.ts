import type { KnowledgeRecord } from './store.js';

function toGlobalRecord(record: KnowledgeRecord): KnowledgeRecord {
  return {
    ...record,
    id: record.id.startsWith('global:') ? record.id : `global:${record.id}`,
    scope: 'global',
    source: { ...record.source },
    evidence: record.evidence.map((evidence) => ({ ...evidence }))
  };
}

export function promoteStableRecords(records: KnowledgeRecord[]): KnowledgeRecord[] {
  return records
    .filter((record) => record.scope === 'project')
    .filter((record) => record.evidence.length > 1)
    .filter((record) => record.confidence >= 0.8)
    .filter((record) => record.decayScore >= 7)
    .map(toGlobalRecord);
}
