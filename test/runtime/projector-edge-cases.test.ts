import { describe, expect, it } from 'vitest';
import {
  applyEvent,
  defaultExecutionState,
  finalizeState,
  projectState,
  type RuntimeEvent
} from '../../packages/boss-cli/src/runtime/projectors/materialize-state.js';
import { EVENT_TYPES } from '../../packages/boss-cli/src/runtime/domain/event-types.js';

function makeEvent(id: number, type: string, data: Record<string, unknown> = {}): RuntimeEvent {
  return {
    id,
    type: type as RuntimeEvent['type'],
    timestamp: new Date(Date.UTC(2026, 4, 15, 8, 0, id)).toISOString(),
    data
  };
}

function initEvent(feature = 'edge-feature'): RuntimeEvent {
  return makeEvent(1, EVENT_TYPES.PIPELINE_INITIALIZED, {
    initialState: {
      schemaVersion: '0.2.0',
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
      pluginLifecycle: { discovered: [], activated: [], executed: [], failed: [] },
      humanInterventions: [],
      revisionRequests: [],
      feedbackLoops: { maxRounds: 2, currentRound: 0 }
    }
  });
}

describe('projector edge cases: duplicate events', () => {
  it('duplicate ARTIFACT_RECORDED does not duplicate in stage.artifacts', () => {
    const events: RuntimeEvent[] = [
      initEvent(),
      makeEvent(2, EVENT_TYPES.STAGE_STARTED, { stage: 1 }),
      makeEvent(3, EVENT_TYPES.ARTIFACT_RECORDED, { artifact: 'prd.md', stage: 1 }),
      makeEvent(4, EVENT_TYPES.ARTIFACT_RECORDED, { artifact: 'prd.md', stage: 1 }),
      makeEvent(5, EVENT_TYPES.ARTIFACT_RECORDED, { artifact: 'prd.md', stage: 1 })
    ];

    const state = projectState(events, 'edge-feature');
    expect(state.stages['1'].artifacts).toEqual(['prd.md']);
  });

  it('duplicate STAGE_STARTED does not overwrite startTime', () => {
    const events: RuntimeEvent[] = [
      initEvent(),
      makeEvent(2, EVENT_TYPES.STAGE_STARTED, { stage: 1 }),
      makeEvent(3, EVENT_TYPES.STAGE_STARTED, { stage: 1 })
    ];

    const state = projectState(events, 'edge-feature');
    // startTime should remain from the first event
    expect(state.stages['1'].startTime).toBe(events[1].timestamp);
  });

  it('duplicate AGENT_STARTED does not overwrite startTime', () => {
    const events: RuntimeEvent[] = [
      initEvent(),
      makeEvent(2, EVENT_TYPES.STAGE_STARTED, { stage: 1 }),
      makeEvent(3, EVENT_TYPES.AGENT_STARTED, { stage: 1, agent: 'boss-pm' }),
      makeEvent(4, EVENT_TYPES.AGENT_STARTED, { stage: 1, agent: 'boss-pm' })
    ];

    const state = projectState(events, 'edge-feature');
    expect(state.stages['1'].agents!['boss-pm'].startTime).toBe(events[2].timestamp);
  });
});

describe('projector edge cases: out-of-order-like scenarios', () => {
  it('STAGE_COMPLETED without STAGE_STARTED still applies status', () => {
    // The projector is lenient - it should still process
    const events: RuntimeEvent[] = [
      initEvent(),
      makeEvent(2, EVENT_TYPES.STAGE_COMPLETED, { stage: 2 })
    ];

    const state = projectState(events, 'edge-feature');
    expect(state.stages['2'].status).toBe('completed');
    expect(state.stages['2'].endTime).toBe(events[1].timestamp);
  });

  it('AGENT_FAILED without AGENT_STARTED still records failure', () => {
    const events: RuntimeEvent[] = [
      initEvent(),
      makeEvent(2, EVENT_TYPES.STAGE_STARTED, { stage: 1 }),
      makeEvent(3, EVENT_TYPES.AGENT_FAILED, { stage: 1, agent: 'boss-pm', reason: 'crash' })
    ];

    const state = projectState(events, 'edge-feature');
    expect(state.stages['1'].agents!['boss-pm'].status).toBe('failed');
    expect(state.stages['1'].agents!['boss-pm'].failureReason).toBe('crash');
  });
});

describe('projector edge cases: retry counting', () => {
  it('multiple retries accumulate retryCount on agents', () => {
    const events: RuntimeEvent[] = [
      initEvent(),
      makeEvent(2, EVENT_TYPES.STAGE_STARTED, { stage: 1 }),
      makeEvent(3, EVENT_TYPES.AGENT_STARTED, { stage: 1, agent: 'boss-pm' }),
      makeEvent(4, EVENT_TYPES.AGENT_FAILED, { stage: 1, agent: 'boss-pm', reason: 'err1' }),
      makeEvent(5, EVENT_TYPES.AGENT_RETRY_SCHEDULED, { stage: 1, agent: 'boss-pm' }),
      makeEvent(6, EVENT_TYPES.AGENT_STARTED, { stage: 1, agent: 'boss-pm' }),
      makeEvent(7, EVENT_TYPES.AGENT_FAILED, { stage: 1, agent: 'boss-pm', reason: 'err2' }),
      makeEvent(8, EVENT_TYPES.AGENT_RETRY_SCHEDULED, { stage: 1, agent: 'boss-pm' })
    ];

    const state = projectState(events, 'edge-feature');
    expect(state.stages['1'].agents!['boss-pm'].retryCount).toBe(2);
    expect(state.stages['1'].agents!['boss-pm'].status).toBe('retrying');
  });

  it('multiple stage retries accumulate retryCount and metrics.retryTotal', () => {
    const events: RuntimeEvent[] = [
      initEvent(),
      makeEvent(2, EVENT_TYPES.STAGE_STARTED, { stage: 1 }),
      makeEvent(3, EVENT_TYPES.STAGE_FAILED, { stage: 1, reason: 'err' }),
      makeEvent(4, EVENT_TYPES.STAGE_RETRYING, { stage: 1 }),
      makeEvent(5, EVENT_TYPES.STAGE_STARTED, { stage: 1 }),
      makeEvent(6, EVENT_TYPES.STAGE_FAILED, { stage: 1, reason: 'err2' }),
      makeEvent(7, EVENT_TYPES.STAGE_RETRYING, { stage: 1 })
    ];

    const state = projectState(events, 'edge-feature');
    expect(state.stages['1'].retryCount).toBe(2);
    expect(state.metrics.retryTotal).toBe(2);
  });
});

describe('projector edge cases: metrics finalization', () => {
  it('computes gate pass rate from multiple gates', () => {
    const events: RuntimeEvent[] = [
      initEvent(),
      makeEvent(2, EVENT_TYPES.STAGE_STARTED, { stage: 1 }),
      makeEvent(3, EVENT_TYPES.GATE_EVALUATED, { stage: 1, gate: 'gate0', passed: true }),
      makeEvent(4, EVENT_TYPES.GATE_EVALUATED, { stage: 1, gate: 'gate1', passed: false }),
      makeEvent(5, EVENT_TYPES.GATE_EVALUATED, { stage: 1, gate: 'gate2', passed: true })
    ];

    const state = projectState(events, 'edge-feature');
    // 2/3 passed = 66.67%
    expect(state.metrics.gatePassRate).toBeCloseTo(66.67, 1);
  });

  it('counts agent success and failure in metrics', () => {
    const events: RuntimeEvent[] = [
      initEvent(),
      makeEvent(2, EVENT_TYPES.STAGE_STARTED, { stage: 1 }),
      makeEvent(3, EVENT_TYPES.AGENT_STARTED, { stage: 1, agent: 'boss-pm' }),
      makeEvent(4, EVENT_TYPES.AGENT_COMPLETED, { stage: 1, agent: 'boss-pm' }),
      makeEvent(5, EVENT_TYPES.AGENT_STARTED, { stage: 1, agent: 'boss-qa' }),
      makeEvent(6, EVENT_TYPES.AGENT_FAILED, { stage: 1, agent: 'boss-qa', reason: 'err' })
    ];

    const state = projectState(events, 'edge-feature');
    expect(state.metrics.agentSuccessCount).toBe(1);
    expect(state.metrics.agentFailureCount).toBe(1);
  });

  it('pipeline status becomes completed when all stages are completed/skipped', () => {
    const events: RuntimeEvent[] = [
      initEvent(),
      makeEvent(2, EVENT_TYPES.STAGE_STARTED, { stage: 1 }),
      makeEvent(3, EVENT_TYPES.STAGE_COMPLETED, { stage: 1 }),
      makeEvent(4, EVENT_TYPES.STAGE_SKIPPED, { stage: 2 }),
      makeEvent(5, EVENT_TYPES.STAGE_STARTED, { stage: 3 }),
      makeEvent(6, EVENT_TYPES.STAGE_COMPLETED, { stage: 3 }),
      makeEvent(7, EVENT_TYPES.STAGE_SKIPPED, { stage: 4 })
    ];

    const state = projectState(events, 'edge-feature');
    expect(state.status).toBe('completed');
  });
});

describe('projector edge cases: revision requests', () => {
  it('increments feedbackLoops.currentRound per REVISION_REQUESTED', () => {
    const events: RuntimeEvent[] = [
      initEvent(),
      makeEvent(2, EVENT_TYPES.REVISION_REQUESTED, {
        from: 'qa', to: 'dev', artifact: 'code', reason: 'tests fail'
      }),
      makeEvent(3, EVENT_TYPES.REVISION_REQUESTED, {
        from: 'qa', to: 'dev', artifact: 'code', reason: 'still failing'
      })
    ];

    const state = projectState(events, 'edge-feature');
    expect(state.feedbackLoops.currentRound).toBe(2);
    expect(state.revisionRequests).toHaveLength(2);
    expect(state.metrics.revisionLoopCount).toBe(2);
  });
});

describe('projectState idempotency', () => {
  it('running projectState twice on same events yields identical result', () => {
    const events: RuntimeEvent[] = [
      initEvent(),
      makeEvent(2, EVENT_TYPES.STAGE_STARTED, { stage: 1 }),
      makeEvent(3, EVENT_TYPES.AGENT_STARTED, { stage: 1, agent: 'boss-pm' }),
      makeEvent(4, EVENT_TYPES.ARTIFACT_RECORDED, { artifact: 'prd.md', stage: 1 }),
      makeEvent(5, EVENT_TYPES.AGENT_COMPLETED, { stage: 1, agent: 'boss-pm' }),
      makeEvent(6, EVENT_TYPES.STAGE_COMPLETED, { stage: 1 })
    ];

    const first = projectState(events, 'edge-feature');
    const second = projectState(events, 'edge-feature');
    expect(JSON.stringify(first)).toBe(JSON.stringify(second));
  });
});
