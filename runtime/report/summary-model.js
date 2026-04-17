import fs from 'node:fs';
import path from 'node:path';

function readExecution(feature, cwd = process.cwd()) {
  const executionPath = path.join(cwd, '.boss', feature, '.meta', 'execution.json');
  if (!fs.existsSync(executionPath)) {
    throw new Error(`未找到执行文件: ${path.relative(cwd, executionPath)}`);
  }
  return JSON.parse(fs.readFileSync(executionPath, 'utf8'));
}

function stageEntries(execution) {
  return Object.entries(execution.stages || {})
    .sort((a, b) => Number(a[0]) - Number(b[0]))
    .map(([stage, state]) => ({
      stage: Number(stage),
      name: state.name || '',
      status: state.status || 'pending',
      duration: execution.metrics && execution.metrics.stageTimings
        ? execution.metrics.stageTimings[stage] ?? null
        : null,
      retryCount: state.retryCount || 0,
      artifacts: Array.isArray(state.artifacts) ? state.artifacts : [],
      gateResults: state.gateResults || {},
      failureReason: state.failureReason || null
    }));
}

function buildSummaryModel(feature, { cwd = process.cwd() } = {}) {
  if (!feature) {
    throw new Error('缺少 feature 参数');
  }

  const execution = readExecution(feature, cwd);
  const metrics = execution.metrics || {};
  return {
    feature: execution.feature,
    status: execution.status,
    schemaVersion: execution.schemaVersion,
    createdAt: execution.createdAt,
    updatedAt: execution.updatedAt,
    pack: {
      name: execution.parameters && execution.parameters.pipelinePack
        ? execution.parameters.pipelinePack
        : 'default',
      version: execution.parameters && execution.parameters.pipelinePackVersion
        ? execution.parameters.pipelinePackVersion
        : ''
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
      pluginFailureCount: metrics.pluginFailureCount ?? 0
    },
    plugins: Array.isArray(execution.plugins) ? execution.plugins : []
  };
}

export {
  buildSummaryModel
};
