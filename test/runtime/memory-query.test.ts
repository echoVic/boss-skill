import { describe, expect, it } from 'vitest';

import { queryAgentMemories } from '../../src/runtime/memory/query.js';
import { buildAgentSections, buildStartupSummary } from '../../src/runtime/memory/summarizer.js';

describe('memory query runtime', () => {
  it('returns startup summary ordered by decayScore and confidence', () => {
    const summary = buildStartupSummary([
      {
        category: 'successful_pattern',
        scope: 'global',
        summary: 'Global success',
        decayScore: 5,
        confidence: 0.5
      },
      {
        category: 'gate_failure_pattern',
        scope: 'feature',
        summary: 'Feature gate failure',
        decayScore: 10,
        confidence: 0.9
      }
    ]);

    expect(summary.map((item) => item.summary)).toEqual(['Feature gate failure', 'Global success']);
  });

  it('filters agent memory records by stage and agent relevance', () => {
    const records = queryAgentMemories(
      [
        {
          category: 'historical_risk',
          stage: 3,
          agent: null,
          tags: ['gate1'],
          summary: 'Stage 3 risk',
          decayScore: 9,
          confidence: 0.8
        },
        {
          category: 'agent_failure_pattern',
          stage: 3,
          agent: 'boss-backend',
          tags: ['boss-backend'],
          summary: 'Backend failed',
          decayScore: 8,
          confidence: 0.9
        },
        {
          category: 'stable_decision',
          stage: 2,
          agent: 'boss-tech-lead',
          tags: ['boss-tech-lead'],
          summary: 'Review stays stable',
          decayScore: 7,
          confidence: 0.7
        }
      ],
      {
        agent: 'boss-backend',
        stage: 3,
        limit: 2
      }
    );

    expect(records.map((item) => item.summary)).toEqual(['Backend failed', 'Stage 3 risk']);
  });

  it('builds per-agent sections from the queried top records', () => {
    const sections = buildAgentSections(
      [
        {
          category: 'agent_failure_pattern',
          stage: 3,
          agent: 'boss-backend',
          tags: ['boss-backend'],
          summary: 'Backend failed',
          decayScore: 8,
          confidence: 0.9
        },
        {
          category: 'historical_risk',
          stage: 3,
          agent: null,
          tags: ['gate1'],
          summary: 'Stage 3 risk',
          decayScore: 9,
          confidence: 0.8
        }
      ],
      [{ name: 'boss-backend', stage: 3 }]
    );

    expect(sections).toEqual({
      'boss-backend': [
        { category: 'agent_failure_pattern', summary: 'Backend failed' },
        { category: 'historical_risk', summary: 'Stage 3 risk' }
      ]
    });
  });
});
