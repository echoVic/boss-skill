import { EVENT_TYPE_VALUES } from '../../packages/boss-cli/src/runtime/domain/event-types.js';
import { projectState, type RuntimeEvent } from '../../packages/boss-cli/src/runtime/projectors/materialize-state.js';

type HarnessEvent = RuntimeEvent | {
  id: number;
  type: string;
  timestamp: string;
  data: Record<string, unknown>;
};

function failInvariant(message: string, event?: HarnessEvent, index?: number): never {
  const details = [`Trace invariant failed: ${message}`];
  if (index !== undefined) details.push(`event index ${index}`);
  if (event) {
    details.push(`event id: ${String(event.id)}`);
    details.push(`event type: ${event.type}`);
  }
  throw new Error(details.join('\n'));
}

function assertCondition(condition: boolean, message: string, event?: HarnessEvent, index?: number): void {
  if (!condition) {
    failInvariant(message, event, index);
  }
}

function assertValidTimestamp(event: HarnessEvent, index: number): void {
  assertCondition(!Number.isNaN(Date.parse(event.timestamp)), `invalid timestamp for ${event.type}`, event, index);
}

function featureFrom(execution: unknown, events: HarnessEvent[]): string {
  if (execution && typeof execution === 'object' && typeof (execution as { feature?: unknown }).feature === 'string') {
    return (execution as { feature: string }).feature;
  }
  const initial = events.find((event) => event.type === 'PipelineInitialized')?.data.initialState;
  if (initial && typeof initial === 'object' && typeof (initial as { feature?: unknown }).feature === 'string') {
    return (initial as { feature: string }).feature;
  }
  return '';
}

export function assertTraceInvariants(events: HarnessEvent[], execution: unknown): void {
  const knownTypes = new Set<string>(EVENT_TYPE_VALUES);
  let sawPipelineInitialized = false;
  const startedStages = new Set<unknown>();
  const failedStages = new Set<unknown>();
  const failedAgents = new Set<string>();

  for (const [index, event] of events.entries()) {
    assertCondition(knownTypes.has(event.type), `unknown event type ${event.type}`, event, index);
    assertValidTimestamp(event, index);

    if (event.type === 'PipelineInitialized') {
      sawPipelineInitialized = true;
    }

    if (event.type !== 'PipelineInitialized') {
      assertCondition(sawPipelineInitialized, `${event.type} occurred before PipelineInitialized`, event, index);
    }

    if (event.type === 'StageStarted') {
      startedStages.add(event.data.stage);
    }

    if (event.type === 'StageCompleted') {
      assertCondition(
        startedStages.has(event.data.stage),
        `stage ${String(event.data.stage)} completed before start`,
        event,
        index
      );
    }

    if (event.type === 'StageFailed') {
      failedStages.add(event.data.stage);
    }

    if (event.type === 'StageRetrying') {
      assertCondition(
        failedStages.has(event.data.stage),
        `stage ${String(event.data.stage)} retried before failure`,
        event,
        index
      );
    }

    if (event.type === 'AgentFailed') {
      failedAgents.add(`${String(event.data.stage)}:${String(event.data.agent)}`);
    }

    if (event.type === 'AgentRetryScheduled') {
      const key = `${String(event.data.stage)}:${String(event.data.agent)}`;
      assertCondition(failedAgents.has(key), `agent ${key} retried before failure`, event, index);
    }
  }

  if (events.length > 0) {
    const feature = featureFrom(execution, events);
    const replayed = projectState(events as RuntimeEvent[], feature);
    const replayedJson = JSON.stringify(replayed);
    const executionJson = JSON.stringify(execution);
    assertCondition(
      replayedJson === executionJson,
      `projector replay mismatch\nfeature: ${feature}\nreplayed state length: ${replayedJson.length}\nexecution state length: ${executionJson.length}`
    );
    assertCondition(
      replayedJson === JSON.stringify(projectState(events as RuntimeEvent[], feature)),
      `projector replay is not idempotent\nfeature: ${feature}`
    );
  }
}
