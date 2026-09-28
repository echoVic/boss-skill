import { randomUUID } from 'node:crypto';
import { EVENT_TYPES } from '../domain/event-types.js';
import { materializeState } from '../projectors/materialize-state.js';
import { isFormalSourceOfTruthArtifact, recordFeedback } from './pipeline.js';
import { appendRuntimeEvent, ensureFeatureName, refreshMemory } from './state.js';
const THREAD_KINDS = [
    'ask',
    'challenge',
    'propose',
    'request_change',
    'escalate',
    'huddle',
];
const THREAD_PRIORITIES = ['low', 'medium', 'high', 'critical'];
const MESSAGE_INTENTS = [
    'question',
    'objection',
    'proposal',
    'evidence',
    'decision',
];
const TODO_TYPES = ['change', 'clarify', 'verify', 'doc_update', 'followup'];
const HINT_STAGES = {
    change: 3,
    clarify: 2,
    verify: 3,
    doc_update: 2,
    followup: 3,
};
function ensureNonEmptyString(value, fieldName) {
    const trimmed = value.trim();
    if (!trimmed) {
        throw new Error(`${fieldName} 必须是非空字符串`);
    }
    return trimmed;
}
function ensureStringArray(values, fieldName) {
    if (!Array.isArray(values) || values.length === 0) {
        throw new Error(`${fieldName} 必须是非空数组`);
    }
    const normalized = values
        .map((value) => ensureNonEmptyString(String(value), fieldName))
        .filter((value, index, items) => items.indexOf(value) === index);
    if (normalized.length === 0) {
        throw new Error(`${fieldName} 必须包含至少一个非空字符串`);
    }
    return normalized;
}
function normalizeKind(kind) {
    if (!THREAD_KINDS.includes(kind)) {
        throw new Error(`无效 conversation kind: ${kind}`);
    }
    return kind;
}
function normalizePriority(priority) {
    if (priority == null)
        return 'medium';
    if (!THREAD_PRIORITIES.includes(priority)) {
        throw new Error(`无效 conversation priority: ${priority}`);
    }
    return priority;
}
function normalizeIntent(intent) {
    if (!MESSAGE_INTENTS.includes(intent)) {
        throw new Error(`无效 message intent: ${intent}`);
    }
    return intent;
}
function normalizeTodoType(type) {
    if (!TODO_TYPES.includes(type)) {
        throw new Error(`无效 todo type: ${type}`);
    }
    return type;
}
function normalizeAnchor(anchor) {
    const normalized = {};
    if (anchor.artifact)
        normalized.artifact = ensureNonEmptyString(anchor.artifact, 'anchor.artifact');
    if (anchor.task)
        normalized.task = ensureNonEmptyString(anchor.task, 'anchor.task');
    if (anchor.scope)
        normalized.scope = ensureNonEmptyString(anchor.scope, 'anchor.scope');
    if (anchor.decision)
        normalized.decision = ensureNonEmptyString(anchor.decision, 'anchor.decision');
    if (Object.keys(normalized).length === 0) {
        throw new Error('conversation anchor 必须至少包含 artifact、task、scope、decision 之一');
    }
    return normalized;
}
function buildThread(input, now) {
    return {
        id: `conv-${randomUUID()}`,
        kind: normalizeKind(input.kind),
        anchor: normalizeAnchor(input.anchor),
        initiator: ensureNonEmptyString(input.initiator, 'initiator'),
        participants: ensureStringArray(input.participants, 'participants'),
        status: 'open',
        priority: normalizePriority(input.priority),
        createdAt: now,
        updatedAt: now,
    };
}
function buildMessage(input, now) {
    return {
        id: `msg-${randomUUID()}`,
        threadId: ensureNonEmptyString(input.threadId, 'threadId'),
        from: ensureNonEmptyString(input.from, 'from'),
        to: ensureStringArray(input.to, 'to'),
        intent: normalizeIntent(input.intent),
        content: ensureNonEmptyString(input.content, 'content'),
        evidence: Array.isArray(input.evidence) && input.evidence.length > 0
            ? input.evidence.map((item) => ({
                type: item.type,
                ref: ensureNonEmptyString(item.ref, 'evidence.ref'),
            }))
            : undefined,
        createdAt: now,
    };
}
function findThread(state, threadId) {
    const thread = state.conversations.threads.find((candidate) => candidate.id === threadId);
    if (!thread) {
        throw new Error(`未找到 conversation thread: ${threadId}`);
    }
    return thread;
}
function normalizeResolutionTodos(input, thread) {
    const todos = Array.isArray(input.todos) ? input.todos : [];
    if (todos.length === 0)
        return [];
    return todos.map((todo) => ({
        title: ensureNonEmptyString(todo.title, 'todo.title'),
        owner: ensureNonEmptyString(todo.owner, 'todo.owner'),
        type: normalizeTodoType(todo.type),
        successCriteria: Array.isArray(todo.successCriteria)
            ? todo.successCriteria.map((item) => ensureNonEmptyString(item, 'todo.successCriteria'))
            : [],
        impact: {
            artifacts: [
                ...(thread.anchor.artifact ? [thread.anchor.artifact] : []),
                ...(todo.impact?.artifacts ?? []).map((item) => ensureNonEmptyString(item, 'todo.impact.artifacts')),
            ].filter((item, index, items) => items.indexOf(item) === index),
            scope: [
                ...(thread.anchor.scope ? [thread.anchor.scope] : []),
                ...(todo.impact?.scope ?? []).map((item) => ensureNonEmptyString(item, 'todo.impact.scope')),
            ].filter((item, index, items) => items.indexOf(item) === index),
        },
    }));
}
function buildResolutionTodo(todo) {
    return {
        id: `todo-${randomUUID()}`,
        owner: todo.owner,
        title: todo.title,
        status: 'pending',
    };
}
function buildResolution(input, thread, now) {
    const todos = normalizeResolutionTodos(input, thread).map(buildResolutionTodo);
    return {
        threadId: ensureNonEmptyString(input.threadId, 'threadId'),
        summary: ensureNonEmptyString(input.summary, 'summary'),
        decision: ensureNonEmptyString(input.decision, 'decision'),
        todos,
        createdAt: now,
    };
}
function buildDerivedTodo(thread, resolutionTodo, todoInput, createdAt) {
    const type = normalizeTodoType(todoInput.type);
    return {
        id: resolutionTodo.id,
        sourceThreadId: thread.id,
        title: resolutionTodo.title,
        owner: resolutionTodo.owner,
        type,
        status: resolutionTodo.status,
        successCriteria: todoInput.successCriteria ?? [],
        impact: {
            artifacts: todoInput.impact?.artifacts ?? [],
            scope: todoInput.impact?.scope ?? [],
        },
        dispatchHint: {
            stage: HINT_STAGES[type],
            agent: resolutionTodo.owner,
        },
        createdAt,
    };
}
function buildStandaloneTodo(input, thread, now) {
    const type = normalizeTodoType(input.type);
    const title = ensureNonEmptyString(input.title, 'title');
    const owner = ensureNonEmptyString(input.owner, 'owner');
    return {
        id: `todo-${randomUUID()}`,
        sourceThreadId: thread.id,
        title,
        owner,
        type,
        status: input.status ?? 'pending',
        successCriteria: Array.isArray(input.successCriteria)
            ? input.successCriteria.map((item) => ensureNonEmptyString(item, 'successCriteria'))
            : [],
        impact: {
            artifacts: Array.isArray(input.artifacts)
                ? input.artifacts.map((item) => ensureNonEmptyString(item, 'artifacts'))
                : [],
            scope: Array.isArray(input.scope)
                ? input.scope.map((item) => ensureNonEmptyString(item, 'scope'))
                : [],
        },
        dispatchHint: {
            stage: typeof input.stage === 'number' && Number.isFinite(input.stage)
                ? input.stage
                : HINT_STAGES[type],
            agent: ensureNonEmptyString(input.agent ?? owner, 'agent'),
        },
        createdAt: now,
    };
}
function resolvePolicy(thread, input, todos) {
    if (input.escalation) {
        return 'revision_escalated';
    }
    if (thread.kind !== 'huddle' && new Set(todos.map((todo) => todo.owner)).size > 1) {
        return 'huddle_recommended';
    }
    return 'direct_todo';
}
function normalizeEscalation(escalation, thread) {
    if (!escalation)
        return undefined;
    const artifact = ensureNonEmptyString(escalation.artifact, 'escalation.artifact');
    if (!isFormalSourceOfTruthArtifact(artifact)) {
        throw new Error(`会话升级只能针对正式 source-of-truth artifact: ${artifact}`);
    }
    if (thread.anchor.artifact && thread.anchor.artifact !== artifact) {
        throw new Error(`升级 artifact ${artifact} 与线程锚点 ${thread.anchor.artifact} 不一致`);
    }
    return {
        artifact,
        from: ensureNonEmptyString(escalation.from, 'escalation.from'),
        to: ensureNonEmptyString(escalation.to, 'escalation.to'),
        reason: ensureNonEmptyString(escalation.reason, 'escalation.reason'),
        priority: escalation.priority?.trim() || 'recommended',
    };
}
function listResolutionMap(state) {
    return new Map(state.conversations.resolutions.map((resolution) => [resolution.threadId, resolution]));
}
export function openConversation(feature, input, { cwd = process.cwd() } = {}) {
    ensureFeatureName(feature);
    const now = new Date().toISOString();
    const thread = buildThread(input, now);
    appendRuntimeEvent(cwd, feature, EVENT_TYPES.CONVERSATION_OPENED, { thread });
    const { state } = materializeState(feature, cwd);
    refreshMemory(feature, cwd);
    const persisted = findThread(state, thread.id);
    return {
        feature,
        threadId: persisted.id,
        status: persisted.status,
    };
}
export function appendConversationMessage(feature, input, { cwd = process.cwd() } = {}) {
    ensureFeatureName(feature);
    const currentState = materializeState(feature, cwd).state;
    findThread(currentState, ensureNonEmptyString(input.threadId, 'threadId'));
    const now = new Date().toISOString();
    const message = buildMessage(input, now);
    appendRuntimeEvent(cwd, feature, EVENT_TYPES.CONVERSATION_MESSAGE_APPENDED, { message });
    const { state } = materializeState(feature, cwd);
    refreshMemory(feature, cwd);
    return {
        feature,
        threadId: message.threadId,
        messageId: message.id,
        messageCount: state.conversations.messages.filter((item) => item.threadId === message.threadId)
            .length,
    };
}
export function resolveConversation(feature, input, { cwd = process.cwd() } = {}) {
    ensureFeatureName(feature);
    const currentState = materializeState(feature, cwd).state;
    const thread = findThread(currentState, ensureNonEmptyString(input.threadId, 'threadId'));
    const now = new Date().toISOString();
    const escalation = normalizeEscalation(input.escalation, thread);
    const normalizedTodos = normalizeResolutionTodos(input, thread);
    if (!escalation && normalizedTodos.length === 0) {
        throw new Error('resolveConversation 必须生成至少一个 todo，或升级到 formal revision loop');
    }
    const resolution = buildResolution(input, thread, now);
    appendRuntimeEvent(cwd, feature, EVENT_TYPES.CONVERSATION_RESOLVED, { resolution });
    if (escalation) {
        recordFeedback(feature, {
            ...escalation,
            cwd,
        });
    }
    else {
        resolution.todos.forEach((resolutionTodo, index) => {
            const todo = buildDerivedTodo(thread, resolutionTodo, normalizedTodos[index], now);
            appendRuntimeEvent(cwd, feature, EVENT_TYPES.TODO_MATERIALIZED, { todo });
        });
    }
    const { state } = materializeState(feature, cwd);
    refreshMemory(feature, cwd);
    return {
        feature,
        threadId: thread.id,
        policy: resolvePolicy(thread, input, normalizedTodos),
        resolution: state.conversations.resolutions.find((item) => item.threadId === thread.id) ?? resolution,
        todos: state.derivedTodos.filter((todo) => todo.sourceThreadId === thread.id),
        escalation,
    };
}
export function materializeTodo(feature, input, { cwd = process.cwd() } = {}) {
    ensureFeatureName(feature);
    const currentState = materializeState(feature, cwd).state;
    const thread = findThread(currentState, ensureNonEmptyString(input.threadId, 'threadId'));
    const now = new Date().toISOString();
    const todo = buildStandaloneTodo(input, thread, now);
    appendRuntimeEvent(cwd, feature, EVENT_TYPES.TODO_MATERIALIZED, { todo });
    const { state } = materializeState(feature, cwd);
    refreshMemory(feature, cwd);
    return {
        feature,
        threadId: thread.id,
        todo: state.derivedTodos.find((item) => item.id === todo.id) ?? todo,
    };
}
export function listConversations(feature, { cwd = process.cwd() } = {}) {
    ensureFeatureName(feature);
    const { state } = materializeState(feature, cwd);
    const resolutionMap = listResolutionMap(state);
    return state.conversations.threads.map((thread) => ({
        ...thread,
        latestResolution: resolutionMap.get(thread.id),
    }));
}
export function listTodos(feature, { cwd = process.cwd() } = {}) {
    ensureFeatureName(feature);
    const { state } = materializeState(feature, cwd);
    return state.derivedTodos;
}
