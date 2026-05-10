import { queryKnowledgeRecords, type KnowledgeQueryOptions, type KnowledgeQueryRecord, type KnowledgeSummaryEntry } from './query.js';

export interface AgentSummaryTarget {
  name: string;
  stage?: number;
}

export interface KnowledgeSummary {
  feature: string;
  generatedAt: string | null;
  startupSummary: KnowledgeSummaryEntry[];
  agentSections: Record<string, KnowledgeSummaryEntry[]>;
}

function toSummaryEntry(record: KnowledgeQueryRecord): KnowledgeSummaryEntry {
  return {
    category: record.category,
    scope: record.scope,
    summary: record.summary
  };
}

export function buildStartupSummary(
  records: KnowledgeQueryRecord[],
  { limit = 3, now }: Pick<KnowledgeQueryOptions, 'limit' | 'now'> = {}
): KnowledgeSummaryEntry[] {
  return queryKnowledgeRecords(records, { limit, now }).map(toSummaryEntry);
}

export function buildAgentSections(
  records: KnowledgeQueryRecord[],
  agents: AgentSummaryTarget[],
  { now }: Pick<KnowledgeQueryOptions, 'now'> = {}
): Record<string, KnowledgeSummaryEntry[]> {
  const sections: Record<string, KnowledgeSummaryEntry[]> = {};
  for (const agent of agents) {
    sections[agent.name] = queryKnowledgeRecords(records, {
      agent: agent.name,
      stage: agent.stage,
      limit: 3,
      now
    }).map(toSummaryEntry);
  }
  return sections;
}

export function buildKnowledgeSummary(
  feature: string,
  records: KnowledgeQueryRecord[],
  agents: AgentSummaryTarget[] = [],
  { now }: Pick<KnowledgeQueryOptions, 'now'> = {}
): KnowledgeSummary {
  return {
    feature,
    generatedAt: new Date().toISOString(),
    startupSummary: buildStartupSummary(records, { now }),
    agentSections: buildAgentSections(records, agents, { now })
  };
}
