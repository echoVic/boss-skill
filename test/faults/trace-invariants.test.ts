import { describe, expect, it } from 'vitest';
import { assertTraceInvariants } from '../harness/trace-invariants.js';

function event(type: string, data: Record<string, unknown> = {}, id = 1) {
  return {
    id,
    type,
    timestamp: new Date(Date.UTC(2026, 4, 15, 8, 0, id)).toISOString(),
    data
  };
}

function initialized(feature = 'fault-feature') {
  return event('PipelineInitialized', {
    initialState: {
      schemaVersion: '1.0.0',
      feature,
      createdAt: '2026-05-15T08:00:00.000Z',
      updatedAt: '2026-05-15T08:00:00.000Z',
      status: 'initialized',
      parameters: {},
      stages: {},
      qualityGates: {},
      metrics: {
        totalDuration: null,
        stageTimings: {},
        gatePassRate: null,
        retryTotal: 0,
        agentSuccessCount: 0,
        agentFailureCount: 0,
        meanRetriesPerStage: 0,
        revisionLoopCount: 0,
        pluginFailureCount: 0
      },
      plugins: [],
      pluginLifecycle: {
        discovered: [],
        activated: [],
        executed: [],
        failed: []
      },
      humanInterventions: [],
      revisionRequests: [],
      feedbackLoops: { maxRounds: 2, currentRound: 0 }
    }
  });
}

describe('Boss fault trace invariants', () => {
  it('rejects unknown event types with event context', () => {
    expect(() => assertTraceInvariants([initialized(), event('UnexpectedThing', {}, 2)], {})).toThrow(
      /unknown event type UnexpectedThing.*event index 1/s
    );
  });

  it('rejects invalid timestamps with event context', () => {
    expect(() =>
      assertTraceInvariants(
        [
          initialized(),
          { id: 2, type: 'StageStarted', timestamp: 'Friday-ish', data: { stage: 1 } }
        ],
        {}
      )
    ).toThrow(/invalid timestamp.*StageStarted.*event index 1/s);
  });

  it('rejects stage completion before stage start', () => {
    expect(() => assertTraceInvariants([initialized(), event('StageCompleted', { stage: 2 }, 2)], {})).toThrow(
      /stage 2 completed before start.*event index 1/s
    );
  });

  it('rejects stage retry before stage failure', () => {
    expect(() => assertTraceInvariants([initialized(), event('StageRetrying', { stage: 3 }, 2)], {})).toThrow(
      /stage 3 retried before failure.*event index 1/s
    );
  });

  it('rejects agent retry before agent failure', () => {
    expect(() =>
      assertTraceInvariants([initialized(), event('AgentRetryScheduled', { stage: 4, agent: 'qa' }, 2)], {})
    ).toThrow(/agent 4:qa retried before failure.*event index 1/s);
  });

  it('rejects execution state that does not match projector replay', () => {
    const pipeline = initialized('replay-mismatch');

    expect(() =>
      assertTraceInvariants([pipeline], {
        ...(pipeline.data.initialState as Record<string, unknown>),
        status: 'completed'
      })
    ).toThrow(/projector replay mismatch/s);
  });
});
