/**
 * Conversation lifecycle projector — handles conversation opened, message appended,
 * resolved, and todo materialized events.
 */
import { EVENT_TYPES } from '../domain/event-types.js';
import { clone, closeThread, ensureConversationSections, upsertThread } from './helpers.js';
export function projectConversationLifecycle(state, event) {
    switch (event.type) {
        case EVENT_TYPES.CONVERSATION_OPENED: {
            ensureConversationSections(state);
            const thread = clone(event.data.thread);
            state.conversations.threads = upsertThread(state.conversations.threads, thread);
            state.conversationMetrics.opened += 1;
            if (thread.kind === 'huddle') {
                state.conversationMetrics.huddles += 1;
            }
            return state;
        }
        case EVENT_TYPES.CONVERSATION_MESSAGE_APPENDED: {
            ensureConversationSections(state);
            const baseMessage = clone(event.data.message);
            const message = {
                id: baseMessage.id,
                threadId: baseMessage.threadId,
                from: typeof baseMessage.from === 'string' ? baseMessage.from : '',
                to: Array.isArray(baseMessage.to)
                    ? baseMessage.to.filter((value) => typeof value === 'string')
                    : [],
                intent: baseMessage.intent ?? 'question',
                content: typeof baseMessage.content === 'string' ? baseMessage.content : '',
                evidence: Array.isArray(baseMessage.evidence) ? clone(baseMessage.evidence) : undefined,
                createdAt: typeof baseMessage.createdAt === 'string' ? baseMessage.createdAt : event.timestamp,
            };
            state.conversations.messages = state.conversations.messages.concat(message);
            return state;
        }
        case EVENT_TYPES.CONVERSATION_RESOLVED: {
            ensureConversationSections(state);
            const baseResolution = clone(event.data.resolution);
            const todos = Array.isArray(baseResolution.todos)
                ? baseResolution.todos.map((todo) => ({
                    id: String(todo.id),
                    owner: String(todo.owner),
                    title: String(todo.title),
                    status: (todo.status ?? 'pending'),
                }))
                : [];
            const resolution = {
                threadId: baseResolution.threadId,
                summary: typeof baseResolution.summary === 'string' ? baseResolution.summary : '',
                decision: typeof baseResolution.decision === 'string' ? baseResolution.decision : '',
                todos,
                createdAt: typeof baseResolution.createdAt === 'string' ? baseResolution.createdAt : event.timestamp,
            };
            state.conversations.resolutions = state.conversations.resolutions.concat(resolution);
            state.conversations.threads = closeThread(state.conversations.threads, resolution.threadId);
            state.conversationMetrics.resolved += 1;
            return state;
        }
        case EVENT_TYPES.TODO_MATERIALIZED: {
            ensureConversationSections(state);
            const baseTodo = clone(event.data.todo);
            const derivedTodo = {
                id: baseTodo.id,
                sourceThreadId: typeof baseTodo.sourceThreadId === 'string' ? baseTodo.sourceThreadId : '',
                title: baseTodo.title,
                owner: baseTodo.owner,
                type: baseTodo.type ?? 'change',
                status: baseTodo.status ?? 'pending',
                successCriteria: Array.isArray(baseTodo.successCriteria)
                    ? baseTodo.successCriteria.filter((value) => typeof value === 'string')
                    : [],
                impact: {
                    artifacts: Array.isArray(baseTodo.impact?.artifacts)
                        ? baseTodo.impact.artifacts.filter((value) => typeof value === 'string')
                        : [],
                    scope: Array.isArray(baseTodo.impact?.scope)
                        ? baseTodo.impact.scope.filter((value) => typeof value === 'string')
                        : [],
                },
                dispatchHint: {
                    stage: typeof baseTodo.dispatchHint?.stage === 'number' &&
                        Number.isFinite(baseTodo.dispatchHint.stage)
                        ? baseTodo.dispatchHint.stage
                        : 0,
                    agent: typeof baseTodo.dispatchHint?.agent === 'string' ? baseTodo.dispatchHint.agent : '',
                },
                createdAt: typeof baseTodo.createdAt === 'string' ? baseTodo.createdAt : event.timestamp,
            };
            state.derivedTodos = state.derivedTodos.concat(derivedTodo);
            state.conversationMetrics.todos += 1;
            return state;
        }
        default:
            return null;
    }
}
