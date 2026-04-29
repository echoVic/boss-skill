import { findActiveFeature, readExecJson, AGENT_STAGE_MAP } from '../lib/boss-utils.js';
import { emitProgress } from '../lib/progress-emitter.js';
import * as runtime from '../../runtime/cli/lib/pipeline-runtime.js';
import * as memoryRuntime from '../../runtime/cli/lib/memory-runtime.js';

function buildMemoryContext(feature, agentType, stage, cwd) {
  try {
    const section = memoryRuntime.queryAgentSection(feature, {
      cwd,
      agent: agentType,
      stage: Number(stage),
      limit: 3
    });
    if (!section.length) {
      return '';
    }
    return '\n记忆提示:\n' + section.map((item) => `- [${item.category}] ${item.summary}`).join('\n');
  } catch {
    return '';
  }
}

function run(rawInput) {
  const input = JSON.parse(rawInput);
  const cwd = input.cwd || '';

  if (!cwd) return '';

  const active = findActiveFeature(cwd);
  if (!active) return '';

  const execData = readExecJson(cwd, active.feature);
  if (!execData) return '';

  let currentStage = '';
  let stageName = '';
  const stages = execData.stages || {};
  for (const sKey of Object.keys(stages).sort((a, b) => Number(a) - Number(b))) {
    const stage = stages[sKey] || {};
    if (stage.status === 'running') {
      currentStage = sKey;
      stageName = stage.name || 'unknown';
      break;
    }
  }

  // Emit AgentStarted event if this is a known boss agent
  const agentType = input.agent_type || '';
  if (currentStage && AGENT_STAGE_MAP[agentType]) {
    emitProgress(cwd, active.feature, {
      type: 'agent-start',
      data: { agent: agentType, stage: parseInt(currentStage) }
    });
    try {
      runtime.updateAgent(active.feature, currentStage, agentType, 'running', { cwd });
    } catch (err) {
      process.stderr.write('[boss-skill] subagent-start/update-agent: ' + err.message + '\n');
    }
  }

  let context = `[Boss Harness] 当前流水线: ${active.feature}`;
  if (currentStage) {
    context += `, 活跃阶段: ${currentStage} (${stageName})`;
  }
  context += `\n子 Agent 类型: ${agentType}`;
  context += buildMemoryContext(active.feature, agentType, currentStage, cwd);
  context += '\n请在最终消息中附带固定状态块：';
  context += '\n[BOSS_STATUS]';
  context += '\nstatus: DONE | DONE_WITH_CONCERNS | NEEDS_CONTEXT | BLOCKED | REVISION_NEEDED';
  context += '\nreason: <optional>';
  context += '\n[/BOSS_STATUS]';

  return JSON.stringify({
    hookSpecificOutput: {
      hookEventName: 'SubagentStart',
      additionalContext: context
    }
  });
}

export { run };
