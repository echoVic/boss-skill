/**
 * Agent lifecycle projector — handles agent started, completed, failed, and retry scheduled events.
 */
import { EVENT_TYPES } from '../domain/event-types.js';
import { AGENT_STATUS } from '../domain/state-constants.js';
import { ensureAgent, ensureStage, refreshWorkflowSchedule, updateWorkflowAgentNodes, } from './helpers.js';
export function projectAgentLifecycle(state, event) {
    switch (event.type) {
        case EVENT_TYPES.AGENT_STARTED: {
            const stage = ensureStage(state, event.data.stage);
            const agent = ensureAgent(stage, String(event.data.agent));
            agent.status = AGENT_STATUS.RUNNING;
            if (!agent.startTime)
                agent.startTime = event.timestamp;
            if (typeof event.data.promptFingerprint === 'string') {
                agent.promptFingerprint = event.data.promptFingerprint;
            }
            if (typeof event.data.inputDigest === 'string') {
                agent.inputDigest = event.data.inputDigest;
            }
            updateWorkflowAgentNodes(state, event.data.stage, String(event.data.agent), { status: 'running', reason: 'agent-started' }, event.timestamp, typeof event.data.artifact === 'string' ? event.data.artifact : undefined);
            return state;
        }
        case EVENT_TYPES.AGENT_COMPLETED: {
            const stage = ensureStage(state, event.data.stage);
            const agent = ensureAgent(stage, String(event.data.agent));
            agent.status = AGENT_STATUS.COMPLETED;
            agent.endTime = event.timestamp;
            if (typeof event.data.promptFingerprint === 'string') {
                agent.promptFingerprint = event.data.promptFingerprint;
            }
            if (typeof event.data.inputDigest === 'string') {
                agent.inputDigest = event.data.inputDigest;
            }
            updateWorkflowAgentNodes(state, event.data.stage, String(event.data.agent), { status: 'completed', reason: 'agent-completed' }, event.timestamp, typeof event.data.artifact === 'string' ? event.data.artifact : undefined);
            refreshWorkflowSchedule(state, event.timestamp);
            return state;
        }
        case EVENT_TYPES.AGENT_FAILED: {
            const stageId = event.data.stage;
            if (stageId != null) {
                const stage = ensureStage(state, stageId);
                const agent = ensureAgent(stage, String(event.data.agent));
                agent.status = AGENT_STATUS.FAILED;
                agent.endTime = event.timestamp;
                agent.failureReason = event.data.reason || null;
                updateWorkflowAgentNodes(state, event.data.stage, String(event.data.agent), { status: 'failed', reason: event.data.reason ?? 'agent-failed' }, event.timestamp, typeof event.data.artifact === 'string' ? event.data.artifact : undefined);
            }
            return state;
        }
        case EVENT_TYPES.AGENT_RETRY_SCHEDULED: {
            const stage = ensureStage(state, event.data.stage);
            const agent = ensureAgent(stage, String(event.data.agent));
            agent.retryCount += 1;
            agent.status = 'retrying';
            agent.failureReason = event.data.reason || null;
            return state;
        }
        default:
            return null;
    }
}
