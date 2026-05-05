import type { SummaryModel } from './summary-model.js';

function statusIcon(status: string): string {
  switch (status) {
    case 'completed':
      return '✅';
    case 'running':
      return '🔄';
    case 'failed':
      return '❌';
    case 'retrying':
      return '🔁';
    case 'skipped':
      return '⏭️';
    case 'pending':
      return '⏳';
    default:
      return '❓';
  }
}

function gateLabel(name: string): string {
  switch (name) {
    case 'gate0':
      return 'Gate 0 (代码质量)';
    case 'gate1':
      return 'Gate 1 (测试)';
    case 'gate2':
      return 'Gate 2 (性能)';
    default:
      return name;
  }
}

export function renderMarkdown(model: SummaryModel): string {
  const completedStages = model.stages.filter(
    (stage) => stage.status === 'completed' || stage.status === 'skipped'
  ).length;
  const lines = [
    '# 流水线执行报告',
    '',
    '## 摘要',
    '',
    `- **流水线状态**：${statusIcon(model.status)} ${model.status}`,
    `- **功能名称**：${model.feature}`,
    `- **Pipeline Pack**：${model.pack.name}`,
    `- **阶段进度**：${completedStages} / ${model.stages.length} 已完成`,
    `- **门禁通过率**：${model.metrics.gatePassRate ?? 'N/A'}%`,
    `- **总重试次数**：${model.metrics.retryTotal ?? 0}`,
    `- **Agent 成功/失败**：${model.metrics.agentSuccessCount ?? 0} / ${model.metrics.agentFailureCount ?? 0}`,
    `- **平均阶段重试**：${model.metrics.meanRetriesPerStage ?? 0}`,
    `- **修订循环次数**：${model.metrics.revisionLoopCount ?? 0}`,
    `- **插件失败次数**：${model.metrics.pluginFailureCount ?? 0}`,
    '',
    '---',
    '',
    '## 阶段详情',
    '',
    '| 阶段 | 名称 | 状态 | 耗时 | 重试 | 产物数 |',
    '|------|------|------|------|------|--------|'
  ];

  for (const stage of model.stages) {
    lines.push(
      `| ${stage.stage} | ${stage.name} | ${statusIcon(stage.status)} ${stage.status} | ${stage.duration == null ? '—' : `${stage.duration}s`} | ${stage.retryCount} | ${stage.artifacts.length} |`
    );
  }

  lines.push(
    '',
    '## 质量门禁',
    '',
    '| 门禁 | 状态 | 通过 | 检查项数 | 执行时间 |',
    '|------|------|------|----------|----------|'
  );
  for (const [name, gate] of Object.entries(model.qualityGates || {})) {
    lines.push(
      `| ${gateLabel(name)} | ${statusIcon(gate.status)} ${gate.status} | ${gate.passed == null ? '—' : gate.passed} | ${Array.isArray(gate.checks) ? gate.checks.length : 0} | ${gate.executedAt || '—'} |`
    );
  }

  lines.push('', '## 产物清单', '');
  for (const stage of model.stages) {
    if (stage.artifacts.length === 0) continue;
    lines.push(`### 阶段 ${stage.stage} (${stage.name})`, '');
    for (const artifact of stage.artifacts) {
      lines.push(`- \`${artifact}\``);
    }
    lines.push('');
  }

  return `${lines.join('\n')}\n`;
}
