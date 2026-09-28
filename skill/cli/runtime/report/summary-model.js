import * as fs from 'node:fs';
import * as path from 'node:path';
function readExecution(feature, cwd = process.cwd()) {
    const executionPath = path.join(cwd, '.boss', feature, '.meta', 'execution.json');
    if (!fs.existsSync(executionPath)) {
        throw new Error(`未找到执行文件: ${path.relative(cwd, executionPath)}`);
    }
    return JSON.parse(fs.readFileSync(executionPath, 'utf8'));
}
function stageEntries(execution) {
    return Object.entries(execution.stages ?? {})
        .sort((left, right) => Number(left[0]) - Number(right[0]))
        .map(([stage, state]) => ({
        stage: Number(stage),
        name: state.name || '',
        status: state.status || 'pending',
        duration: execution.metrics && execution.metrics.stageTimings
            ? (execution.metrics.stageTimings[stage] ?? null)
            : null,
        retryCount: state.retryCount || 0,
        artifacts: Array.isArray(state.artifacts) ? state.artifacts : [],
        gateResults: state.gateResults || {},
        failureReason: state.failureReason || null,
    }));
}
export function buildSummaryModel(feature, { cwd = process.cwd() } = {}) {
    if (!feature) {
        throw new Error('缺少 feature 参数');
    }
    const execution = readExecution(feature, cwd);
    const metrics = execution.metrics || {
        totalDuration: null,
        stageTimings: {},
        gatePassRate: null,
        retryTotal: 0,
        agentSuccessCount: 0,
        agentFailureCount: 0,
        meanRetriesPerStage: 0,
        revisionLoopCount: 0,
        pluginFailureCount: 0,
    };
    return {
        feature: execution.feature,
        status: execution.status,
        schemaVersion: execution.schemaVersion,
        createdAt: execution.createdAt,
        updatedAt: execution.updatedAt,
        pack: {
            name: execution.parameters && execution.parameters.pipelinePack
                ? String(execution.parameters.pipelinePack)
                : 'default',
            version: execution.parameters && typeof execution.parameters.pipelinePackVersion === 'string'
                ? execution.parameters.pipelinePackVersion
                : '',
        },
        stages: stageEntries(execution),
        qualityGates: execution.qualityGates || {},
        metrics: {
            totalDuration: metrics.totalDuration ?? null,
            stageTimings: metrics.stageTimings || {},
            gatePassRate: metrics.gatePassRate ?? null,
            retryTotal: metrics.retryTotal ?? 0,
            agentSuccessCount: metrics.agentSuccessCount ?? 0,
            agentFailureCount: metrics.agentFailureCount ?? 0,
            meanRetriesPerStage: metrics.meanRetriesPerStage ?? 0,
            revisionLoopCount: metrics.revisionLoopCount ?? 0,
            pluginFailureCount: metrics.pluginFailureCount ?? 0,
        },
        plugins: Array.isArray(execution.plugins) ? execution.plugins : [],
        conversationMetrics: execution.conversationMetrics || {
            opened: 0,
            resolved: 0,
            todos: 0,
            huddles: 0,
            unresolved: 0,
        },
        derivedTodos: Array.isArray(execution.derivedTodos)
            ? execution.derivedTodos.map((todo) => ({
                id: String(todo.id),
                owner: String(todo.owner),
                status: String(todo.status),
                title: String(todo.title),
            }))
            : [],
        revisionRequests: Array.isArray(execution.revisionRequests)
            ? execution.revisionRequests.map((request) => ({
                from: String(request.from ?? ''),
                to: String(request.to ?? ''),
                artifact: String(request.artifact ?? ''),
                reason: String(request.reason ?? ''),
                priority: String(request.priority ?? 'recommended'),
                timestamp: String(request.timestamp ?? ''),
            }))
            : [],
        humanInterventions: Array.isArray(execution.humanInterventions)
            ? execution.humanInterventions.map((entry) => ({
                choiceType: String(entry.choiceType ?? ''),
                selected: String(entry.selected ?? ''),
                agent: entry.agent == null ? undefined : String(entry.agent),
                stage: entry.stage == null ? undefined : Number(entry.stage),
                timestamp: String(entry.timestamp ?? ''),
            }))
            : [],
    };
}
