import { describe, expect, it } from 'vitest';

import { extractFeatureMemories } from '../../src/runtime/memory/extractor.js';

describe('memory extractor runtime', () => {
  it('extracts gate failure, agent failure, and retry memories from execution history', () => {
    const records = extractFeatureMemories({
      feature: 'test-feat',
      now: '2026-04-17T00:00:00Z',
      events: [
        {
          id: 2,
          type: 'GateEvaluated',
          timestamp: '2026-04-17T00:00:00Z',
          data: { gate: 'gate1', passed: false, stage: 3, checks: ['coverage < 70'] }
        },
        {
          id: 3,
          type: 'AgentFailed',
          timestamp: '2026-04-17T00:01:00Z',
          data: { agent: 'boss-backend', stage: 3, reason: 'timeout' }
        }
      ],
      execution: {
        parameters: { roles: 'full' },
        stages: {
          '3': {
            retryCount: 2,
            agents: {
              'boss-backend': { status: 'failed', failureReason: 'timeout' }
            }
          }
        }
      }
    });

    expect(records.map((record) => record.category)).toEqual(
      expect.arrayContaining(['gate_failure_pattern', 'agent_failure_pattern', 'retry_lesson'])
    );
    expect(records.every((record) => record.influence === 'preference')).toBe(true);
  });

  it('extracts a stable decision memory from successful parameter combinations', () => {
    const records = extractFeatureMemories({
      feature: 'test-feat',
      now: '2026-04-17T00:00:00Z',
      events: [
        {
          id: 4,
          type: 'StageCompleted',
          timestamp: '2026-04-17T00:03:00Z',
          data: { stage: 2 }
        }
      ],
      execution: {
        parameters: { roles: 'core', skipUI: true, pipelinePack: 'api-only' },
        stages: {
          '2': { retryCount: 0, status: 'completed', agents: {} }
        }
      }
    });

    expect(records).toContainEqual(
      expect.objectContaining({
        category: 'stable_decision',
        scope: 'feature'
      })
    );
    expect(records.find((record) => record.category === 'stable_decision')?.summary).toMatch(
      /roles=core/
    );
  });

  it('falls back to full/default when roles or pipelinePack are empty strings', () => {
    const records = extractFeatureMemories({
      feature: 'test-feat',
      now: '2026-04-17T00:00:00Z',
      events: [
        {
          id: 5,
          type: 'StageCompleted',
          timestamp: '2026-04-17T00:04:00Z',
          data: { stage: 1 }
        }
      ],
      execution: {
        parameters: { roles: '', pipelinePack: '' },
        stages: {
          '1': { retryCount: 0, status: 'completed', agents: {} }
        }
      }
    });

    expect(records.find((record) => record.category === 'stable_decision')?.summary).toContain(
      'roles=full pack=default'
    );
  });
});
