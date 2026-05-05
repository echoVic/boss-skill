import type { PersistedMemoryRecord } from './store.js';

export interface MemoryExtractionInput {
  feature: string;
  events?: Array<{
    id: number;
    type: string;
    timestamp: string;
    data?: Record<string, any>;
  }>;
  execution?: {
    parameters?: Record<string, any>;
    stages?: Record<string, any>;
  };
  now: string;
}

type PersistedMemoryRecordSeed = Omit<PersistedMemoryRecord, 'influence' | 'tags'> & {
  tags?: string[];
};

function buildRecord(base: PersistedMemoryRecordSeed): PersistedMemoryRecord {
  return {
    influence: 'preference',
    tags: [],
    ...base
  };
}

export function extractFeatureMemories({
  feature,
  events = [],
  execution = {},
  now
}: MemoryExtractionInput): PersistedMemoryRecord[] {
  const records: PersistedMemoryRecord[] = [];

  for (const event of events) {
    if (event.type === 'GateEvaluated' && event.data && event.data.passed === false) {
      records.push(
        buildRecord({
          id: `gate-${event.id}`,
          scope: 'feature',
          kind: 'execution',
          category: 'gate_failure_pattern',
          feature,
          stage: event.data.stage as number,
          agent: null,
          summary: `Gate ${event.data.gate} failed in stage ${event.data.stage}`,
          source: { type: 'events', window: 'latest' },
          evidence: [{ type: 'event', ref: String(event.id) }],
          tags: [String(event.data.gate)],
          confidence: 0.8,
          createdAt: event.timestamp,
          lastSeenAt: event.timestamp,
          expiresAt: null,
          decayScore: 10
        })
      );
    }

    if (event.type === 'AgentFailed' && event.data) {
      records.push(
        buildRecord({
          id: `agent-${event.id}`,
          scope: 'feature',
          kind: 'execution',
          category: 'agent_failure_pattern',
          feature,
          stage: event.data.stage as number,
          agent: String(event.data.agent),
          summary: `${event.data.agent} failed in stage ${event.data.stage}`,
          source: { type: 'events', window: 'latest' },
          evidence: [{ type: 'event', ref: String(event.id) }],
          tags: [String(event.data.agent)],
          confidence: 0.8,
          createdAt: event.timestamp,
          lastSeenAt: event.timestamp,
          expiresAt: null,
          decayScore: 9
        })
      );
    }

    if (event.type === 'StageCompleted' && event.data) {
      const stages = execution.stages ?? {};
      const parameters = execution.parameters ?? {};
      const stage = stages[String(event.data.stage)] ?? {};
      if ((stage.retryCount ?? 0) === 0) {
        const roles = parameters.roles || 'full';
        const pipelinePack = parameters.pipelinePack || 'default';
        records.push(
          buildRecord({
            id: `stable-${event.id}`,
            scope: 'feature',
            kind: 'long_term',
            category: 'stable_decision',
            feature,
            stage: event.data.stage as number,
            agent: null,
            summary: `Stable completion with roles=${roles} pack=${pipelinePack}`,
            source: { type: 'execution-parameters', window: 'latest' },
            evidence: [{ type: 'event', ref: String(event.id) }],
            tags: [String(roles)],
            confidence: 0.7,
            createdAt: event.timestamp,
            lastSeenAt: event.timestamp,
            expiresAt: null,
            decayScore: 7
          })
        );
      }
    }
  }

  const stages = execution.stages ?? {};
  const stage3 = stages['3'];
  if (stage3 && (stage3.retryCount ?? 0) > 0) {
    records.push(
      buildRecord({
        id: `retry-${feature}-3`,
        scope: 'feature',
        kind: 'execution',
        category: 'retry_lesson',
        feature,
        stage: 3,
        agent: null,
        summary: `Stage 3 retried ${stage3.retryCount} times`,
        source: { type: 'execution-stage', window: 'latest' },
        evidence: [{ type: 'stage', ref: '3' }],
        tags: ['retry'],
        confidence: 0.75,
        createdAt: now,
        lastSeenAt: now,
        expiresAt: null,
        decayScore: 8
      })
    );
  }

  return records;
}
