import fs from 'node:fs';
import path from 'node:path';

import { findActiveFeature, readExecJson, AGENT_STAGE_MAP } from '../lib/boss-utils.js';
import { emitProgress } from '../lib/progress-emitter.js';
import * as runtime from '../../runtime/cli/lib/pipeline-runtime.js';

function parseStructuredStatus(message) {
  const match = message.match(/\[BOSS_STATUS\]([\s\S]*?)\[\/BOSS_STATUS\]/i);
  if (!match) {
    return null;
  }

  const block = match[1];
  const statusMatch = block.match(/^\s*status\s*:\s*([A-Z_]+)\s*$/im);
  if (!statusMatch) {
    return null;
  }

  const reasonMatch = block.match(/^\s*reason\s*:\s*(.*?)\s*$/im);
  return {
    status: statusMatch[1],
    reason: reasonMatch ? reasonMatch[1] : ''
  };
}

function parseStatus(message) {
  const structured = parseStructuredStatus(message);
  return structured || { status: '', reason: '' };
}

function run(rawInput) {
  const input = JSON.parse(rawInput);
  const agentType = input.agent_type || '';
  const agentId = input.agent_id || '';
  const lastMsg = (input.last_assistant_message || '').slice(0, 500);
  const cwd = input.cwd || '';

  const active = findActiveFeature(cwd);

  const logDirName = active ? active.feature : '.harness-logs';
  const logDir = path.join(cwd, '.boss', logDirName, '.meta');

  try {
    if (!fs.existsSync(logDir)) {
      fs.mkdirSync(logDir, { recursive: true });
    }
  } catch (err) {
    process.stderr.write('[boss-skill] subagent-stop/mkdirSync: ' + err.message + '\n');
    return '';
  }

  const logFile = path.join(logDir, 'agent-log.jsonl');
  const now = new Date().toISOString().replace(/\.\d{3}Z$/, 'Z');

  const parsedStatus = parseStatus(lastMsg);
  const entry = JSON.stringify({
    timestamp: now,
    agentType,
    agentId,
    event: 'stop',
    summary: lastMsg,
    status: parsedStatus.status || '',
    reason: parsedStatus.reason || ''
  });

  try {
    fs.appendFileSync(logFile, entry + '\n', 'utf8');
  } catch (err) {
    process.stderr.write('[boss-skill] subagent-stop/appendLog: ' + err.message + '\n');
  }

  // Emit AgentCompleted/AgentFailed event if this is a known boss agent
  if (active && AGENT_STAGE_MAP[agentType]) {
    const execData = readExecJson(cwd, active.feature);
    if (execData) {
      let currentStage = '';
      const stages = execData.stages || {};
      for (const sKey of Object.keys(stages).sort((a, b) => Number(a) - Number(b))) {
        const stage = stages[sKey] || {};
        if (stage.status === 'running') {
          currentStage = sKey;
          break;
        }
      }

      if (currentStage) {
        const agentStatus = parsedStatus.status && (parsedStatus.status === 'DONE' || parsedStatus.status === 'DONE_WITH_CONCERNS')
          ? 'completed' : 'failed';

        emitProgress(cwd, active.feature, {
          type: 'agent-complete',
          data: { agent: agentType, stage: parseInt(currentStage), status: agentStatus }
        });

        const failureReason = parsedStatus.reason || parsedStatus.status || '';
        try {
          runtime.updateAgent(active.feature, currentStage, agentType, agentStatus, {
            cwd,
            reason: agentStatus === 'failed' ? failureReason : ''
          });
        } catch (err) {
          process.stderr.write('[boss-skill] subagent-stop/update-agent: ' + err.message + '\n');
        }
      }
    }
  }

  return '';
}

export {
  run,
  parseStatus
};
