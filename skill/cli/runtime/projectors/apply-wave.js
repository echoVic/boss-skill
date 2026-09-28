/**
 * Wave lifecycle projector — handles wave verified events.
 */
import { EVENT_TYPES } from '../domain/event-types.js';
import { refreshWorkflowSchedule } from './helpers.js';
function upsertWorkflowWaveNode(state, event) {
    if (!state.workflow)
        return;
    const waveId = typeof event.data.waveId === 'string' ? event.data.waveId : '';
    if (!waveId)
        return;
    const nodeId = `wave:${waveId}`;
    state.workflow.nodes[nodeId] = {
        id: nodeId,
        kind: 'wave',
        stage: 0,
        phase: 'wave-verification',
        inputs: [],
        optional: false,
        status: event.data.verified === true ? 'completed' : 'failed',
        reason: typeof event.data.phase === 'string' ? `wave-${event.data.phase}` : 'wave-verification',
        updatedAt: event.timestamp,
    };
}
export function projectWaveLifecycle(state, event) {
    switch (event.type) {
        case EVENT_TYPES.WAVE_VERIFIED: {
            upsertWorkflowWaveNode(state, event);
            refreshWorkflowSchedule(state, event.timestamp);
            return state;
        }
        default:
            return null;
    }
}
