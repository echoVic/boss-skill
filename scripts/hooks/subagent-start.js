import { findActiveFeature, readExecJson, AGENT_STAGE_MAP } from '../lib/boss-utils.js';
import { emitProgress } from '../lib/progress-emitter.js';
import * as runtime from '../../packages/boss-cli/dist/runtime/application/pipeline.js';
import * as memoryRuntime from '../../packages/boss-cli/dist/runtime/application/memory.js';

function artifactInputsForStage(stage) {
  if (Number(stage) === 1) return [];
  if (Number(stage) === 2) return ['prd.md', 'architecture.md'];
  if (Number(stage) === 3) return ['tech-review.md', 'tasks.md'];
  if (Number(stage) === 4) return ['qa-report.md'];
  return [];
}

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

  const agentType = input.agent_type || '';
  let stablePrompt = `[Boss Harness] 当前流水线: ${active.feature}`;
  if (currentStage) {
    stablePrompt += `, 活跃阶段: ${currentStage} (${stageName})`;
  }
  stablePrompt += `\n子 Agent 类型: ${agentType}`;
  stablePrompt += '\n请在最终消息中附带固定状态块：';
  stablePrompt += '\n[BOSS_STATUS]';
  stablePrompt += '\nstatus: DONE | DONE_WITH_CONCERNS | NEEDS_CONTEXT | BLOCKED | REVISION_NEEDED';
  stablePrompt += '\nreason: <optional>';
  stablePrompt += '\n[/BOSS_STATUS]';
  let context = stablePrompt;
  context += buildMemoryContext(active.feature, agentType, currentStage, cwd);

  // Emit AgentStarted event if this is a known boss agent.
  if (currentStage && AGENT_STAGE_MAP[agentType]) {
    emitProgress(cwd, active.feature, {
      type: 'agent-start',
      data: { agent: agentType, stage: parseInt(currentStage) }
    });
    try {
      runtime.updateAgent(active.feature, currentStage, agentType, 'running', {
        cwd,
        prompt: stablePrompt,
        dependencyArtifacts: artifactInputsForStage(currentStage),
        opts: { hook: 'subagent-start', agentType }
      });
    } catch (err) {
      process.stderr.write('[boss-skill] subagent-start/update-agent: ' + err.message + '\n');
    }
  }

  return JSON.stringify({
    hookSpecificOutput: {
      hookEventName: 'SubagentStart',
      additionalContext: context
    }
  });
}

export { run };
