import { computeNextNodeIds, OPT_IN_OPTIONAL_ARTIFACTS } from '../domain/scheduling.js';
import { AGENT_STATUS, DEFAULT_SCHEMA_VERSION, PIPELINE_STATUS, STAGE_STATUS, } from '../domain/state-constants.js';
export function clone(value) {
    if (value === undefined) {
        return value;
    }
    return JSON.parse(JSON.stringify(value));
}
export function isObject(value) {
    return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}
export function mergeDeep(base, override) {
    if (Array.isArray(base) || Array.isArray(override)) {
        return clone(override === undefined ? base : override);
    }
    if (!isObject(base) || !isObject(override)) {
        return clone(override === undefined ? base : override);
    }
    const result = {};
    const keys = new Set([...Object.keys(base), ...Object.keys(override)]);
    for (const key of keys) {
        if (override[key] === undefined) {
            result[key] = clone(base[key]);
        }
        else if (base[key] === undefined) {
            result[key] = clone(override[key]);
        }
        else {
            result[key] = mergeDeep(base[key], override[key]);
        }
    }
    return result;
}
const STAGE_NAMES = {
    '1': 'planning',
    '2': 'review',
    '3': 'development',
    '4': 'deployment',
};
export function defaultStageName(stageId) {
    return STAGE_NAMES[String(stageId)] ?? `stage-${stageId}`;
}
export function defaultStageState(name = '') {
    return {
        name,
        status: STAGE_STATUS.PENDING,
        startTime: null,
        endTime: null,
        retryCount: 0,
        maxRetries: 2,
        failureReason: null,
        artifacts: [],
        gateResults: {},
    };
}
export function defaultGateState() {
    return {
        status: STAGE_STATUS.PENDING,
        passed: null,
        checks: [],
        executedAt: null,
    };
}
export function defaultAgentState() {
    return {
        status: AGENT_STATUS.PENDING,
        startTime: null,
        endTime: null,
        retryCount: 0,
        maxRetries: 2,
        failureReason: null,
        promptFingerprint: null,
        inputDigest: null,
    };
}
export function defaultExecutionState(feature = '') {
    return {
        schemaVersion: DEFAULT_SCHEMA_VERSION,
        feature,
        createdAt: '',
        updatedAt: '',
        status: PIPELINE_STATUS.INITIALIZED,
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
            pluginFailureCount: 0,
        },
        plugins: [],
        pluginLifecycle: {
            discovered: [],
            activated: [],
            executed: [],
            failed: [],
        },
        conversations: {
            threads: [],
            messages: [],
            resolutions: [],
        },
        derivedTodos: [],
        conversationMetrics: {
            opened: 0,
            resolved: 0,
            todos: 0,
            huddles: 0,
            unresolved: 0,
        },
        humanInterventions: [],
        revisionRequests: [],
        feedbackLoops: { maxRounds: 2, currentRound: 0, rounds: {} },
        workflow: undefined,
        pause: null,
    };
}
export function upsertThread(threads, thread) {
    const next = threads.filter((candidate) => candidate.id !== thread.id);
    next.push(clone(thread));
    return next;
}
export function closeThread(threads, threadId) {
    return threads.map((thread) => {
        if (thread.id !== threadId)
            return thread;
        return {
            ...thread,
            status: 'closed',
            updatedAt: thread.updatedAt || thread.createdAt,
        };
    });
}
export function ensureConversationSections(state) {
    if (!state.conversations || typeof state.conversations !== 'object') {
        state.conversations = { threads: [], messages: [], resolutions: [] };
    }
    if (!Array.isArray(state.conversations.threads))
        state.conversations.threads = [];
    if (!Array.isArray(state.conversations.messages))
        state.conversations.messages = [];
    if (!Array.isArray(state.conversations.resolutions))
        state.conversations.resolutions = [];
    if (!Array.isArray(state.derivedTodos))
        state.derivedTodos = [];
    if (!state.conversationMetrics || typeof state.conversationMetrics !== 'object') {
        state.conversationMetrics = { opened: 0, resolved: 0, todos: 0, huddles: 0, unresolved: 0 };
    }
}
export function ensureStage(state, stageId) {
    const key = String(stageId);
    if (!state.stages[key]) {
        // 事件首次创建的阶段此前恒为空名，并一路出现在报表里。按阶段号给出与
        // 初始化一致的默认名，未知阶段回退到 stage-N 而不是空字符串。
        state.stages[key] = defaultStageState(defaultStageName(key));
    }
    const stage = state.stages[key];
    stage.artifacts = Array.isArray(stage.artifacts) ? stage.artifacts : [];
    stage.gateResults = isObject(stage.gateResults)
        ? stage.gateResults
        : {};
    if (stage.retryCount == null)
        stage.retryCount = 0;
    if (stage.maxRetries == null)
        stage.maxRetries = 2;
    if (stage.failureReason === undefined)
        stage.failureReason = null;
    return stage;
}
export function ensureGate(state, gateName) {
    if (!state.qualityGates[gateName]) {
        state.qualityGates[gateName] = defaultGateState();
    }
    const gate = state.qualityGates[gateName];
    gate.checks = Array.isArray(gate.checks) ? gate.checks : [];
    if (gate.executedAt === undefined)
        gate.executedAt = null;
    if (gate.passed === undefined)
        gate.passed = null;
    if (gate.status === undefined)
        gate.status = STAGE_STATUS.PENDING;
    return gate;
}
export function ensureAgent(stage, agentName) {
    if (!stage.agents)
        stage.agents = {};
    if (!stage.agents[agentName]) {
        stage.agents[agentName] = defaultAgentState();
    }
    const agent = stage.agents[agentName];
    if (agent.promptFingerprint === undefined)
        agent.promptFingerprint = null;
    if (agent.inputDigest === undefined)
        agent.inputDigest = null;
    return stage.agents[agentName];
}
export function isSatisfiedWorkflowStatus(status) {
    return status === 'completed' || status === 'reused' || status === 'skipped';
}
export function normalizeWorkflowNode(node) {
    return {
        ...node,
        inputs: Array.isArray(node.inputs) ? node.inputs : [],
        optional: node.optional === true,
        status: node.status ?? 'pending',
        phase: typeof node.phase === 'string' ? node.phase : `stage-${Number(node.stage) || 0}`,
        stage: Number.isFinite(Number(node.stage)) ? Number(node.stage) : 0,
    };
}
export function findWorkflowNodeIdByArtifact(workflow, artifact) {
    for (const node of Object.values(workflow.nodes ?? {})) {
        if (node.artifact === artifact)
            return node.id;
    }
    return null;
}
export function workflowInputsSatisfied(workflow, node) {
    for (const input of node.inputs) {
        const inputNodeId = findWorkflowNodeIdByArtifact(workflow, input);
        if (!inputNodeId)
            continue;
        if (!isSatisfiedWorkflowStatus(workflow.nodes[inputNodeId]?.status))
            return false;
    }
    return true;
}
export function refreshWorkflowSchedule(state, timestamp) {
    const workflow = state.workflow;
    if (!workflow || !workflow.nodes || typeof workflow.nodes !== 'object')
        return;
    for (const [id, rawNode] of Object.entries(workflow.nodes)) {
        const node = normalizeWorkflowNode(rawNode);
        // 只在显式要求时才产出的可选产物不进入调度：留在 ready 会让 nextNodeIds 永不为空，
        // 编排循环第 13 步「直到 nextNodeIds 为空」因此不可达。真被产出时 ArtifactRecorded
        // 会把它推到 completed，不受这里影响。
        if (node.kind !== 'input' &&
            node.optional === true &&
            typeof node.artifact === 'string' &&
            OPT_IN_OPTIONAL_ARTIFACTS.has(node.artifact) &&
            !isSatisfiedWorkflowStatus(node.status)) {
            workflow.nodes[id] = {
                ...node,
                status: 'skipped',
                decision: node.decision ?? 'skip',
                reason: node.reason ?? 'opt-in-only-artifact',
                updatedAt: node.updatedAt ?? timestamp,
            };
            continue;
        }
        if (node.kind === 'input') {
            workflow.nodes[id] = {
                ...node,
                status: 'skipped',
                decision: node.decision ?? 'skip',
                updatedAt: node.updatedAt ?? timestamp,
            };
            continue;
        }
        if (isSatisfiedWorkflowStatus(node.status) ||
            node.status === 'running' ||
            node.status === 'failed') {
            workflow.nodes[id] = node;
            continue;
        }
        workflow.nodes[id] = {
            ...node,
            status: workflowInputsSatisfied(workflow, node) ? 'ready' : 'blocked',
        };
    }
    // 与 application/workflow.ts 共用 domain/scheduling 的分组逻辑，避免调度语义漂移。
    workflow.nextNodeIds = computeNextNodeIds(Object.values(workflow.nodes));
    workflow.updatedAt = timestamp ?? workflow.updatedAt;
}
export function updateWorkflowNode(state, nodeId, updates, timestamp) {
    if (!state.workflow)
        return;
    const current = state.workflow.nodes[nodeId];
    if (!current)
        return;
    state.workflow.nodes[nodeId] = normalizeWorkflowNode({
        ...current,
        ...updates,
        updatedAt: timestamp,
    });
}
export function updateWorkflowArtifactNode(state, artifact, updates, timestamp) {
    if (!state.workflow)
        return;
    const nodeId = findWorkflowNodeIdByArtifact(state.workflow, artifact);
    if (!nodeId)
        return;
    updateWorkflowNode(state, nodeId, updates, timestamp);
}
export function agentNames(value) {
    if (Array.isArray(value))
        return value.filter((item) => typeof item === 'string');
    return typeof value === 'string' && value.length > 0 ? [value] : [];
}
export function updateWorkflowAgentNodes(state, stage, agent, updates, timestamp, artifact) {
    if (!state.workflow)
        return;
    const stageNumber = Number(stage);
    const candidates = Object.values(state.workflow.nodes).filter((node) => {
        if (node.kind !== 'agent')
            return false;
        if (Number(node.stage) !== stageNumber)
            return false;
        if (!agentNames(node.agent).includes(agent))
            return false;
        if (artifact && node.artifact !== artifact)
            return false;
        return true;
    });
    const selected = artifact ? candidates : candidates.length === 1 ? candidates : [];
    for (const node of selected) {
        updateWorkflowNode(state, node.id, updates, timestamp);
    }
}
export function uniqueArtifacts(artifacts) {
    return [...new Set(artifacts)];
}
export function normalizePlugins(plugins) {
    if (!Array.isArray(plugins))
        return [];
    const deduped = new Map();
    for (const plugin of plugins) {
        if (!plugin || typeof plugin !== 'object')
            continue;
        const candidate = plugin;
        const key = `${candidate.name ?? ''}:${candidate.version ?? ''}:${candidate.type ?? ''}`;
        const normalized = {
            name: typeof candidate.name === 'string' ? candidate.name : '',
            version: typeof candidate.version === 'string' ? candidate.version : '',
            type: typeof candidate.type === 'string' ? candidate.type : '',
        };
        const dependencies = Array.isArray(candidate.dependencies)
            ? candidate.dependencies.filter((dep) => typeof dep === 'string')
            : [];
        if (dependencies.length > 0) {
            normalized.dependencies = dependencies;
        }
        if (typeof candidate.manifestPath === 'string' && candidate.manifestPath.length > 0) {
            normalized.manifestPath = candidate.manifestPath;
        }
        deduped.set(key, normalized);
    }
    return [...deduped.values()];
}
export function isNonEmptyString(value) {
    return typeof value === 'string' && value.length > 0;
}
export function isBoolean(value) {
    return value === true || value === false;
}
export function isPositiveInteger(value) {
    return Number.isInteger(value) && Number(value) >= 1;
}
