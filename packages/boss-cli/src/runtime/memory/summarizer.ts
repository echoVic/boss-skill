import { queryAgentMemories } from './query.js';
import type { MemoryQueryRecord, MemorySummaryEntry } from './store.js';

export interface AgentSummaryTarget {
  name: string;
  stage?: number;
}

export function buildStartupSummary(
  records: MemoryQueryRecord[],
  { limit = 3 }: { limit?: number } = {}
): MemorySummaryEntry[] {
  return records
    .slice()
    .sort((left, right) => {
      if ((right.decayScore ?? 0) !== (left.decayScore ?? 0)) {
        return (right.decayScore ?? 0) - (left.decayScore ?? 0);
      }
      return (right.confidence ?? 0) - (left.confidence ?? 0);
    })
    .slice(0, limit)
    .map((record) => ({
      category: record.category,
      scope: record.scope,
      summary: record.summary
    }));
}

export function buildAgentSections(
  records: MemoryQueryRecord[],
  agents: AgentSummaryTarget[]
): Record<string, MemorySummaryEntry[]> {
  const sections: Record<string, MemorySummaryEntry[]> = {};
  for (const agent of agents) {
    sections[agent.name] = queryAgentMemories(records, {
      agent: agent.name,
      stage: agent.stage,
      limit: 3
    }).map((record) => ({
      category: record.category,
      summary: record.summary
    }));
  }
  return sections;
}
