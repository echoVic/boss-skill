import fs from 'node:fs';
import path from 'node:path';

import { STAGE_MAP, loadArtifactDag, getReadyArtifacts } from '../lib/boss-utils.js';
import { normalizeHookInput } from './lib/normalize-input.js';

function classifyWriteDecision(filePath, cwd) {
  if (!filePath) return '';

  if (filePath.includes('.boss/') && filePath.endsWith('execution.json')) {
    return JSON.stringify({
      hookSpecificOutput: {
        hookEventName: 'PreToolUse',
        permissionDecision: 'deny',
        permissionDecisionReason: 'execution.json 由 runtime 事件流管理，不允许直接编辑。请使用 boss runtime update-stage 或其他 runtime CLI'
      }
    });
  }

  if (!filePath.includes('.boss/')) {
    return '';
  }

  const match = filePath.match(/\.boss\/([^/]+)\//);
  const artifact = path.basename(filePath);

  if (match) {
    const feature = match[1];
    const execJsonPath = path.join(cwd, '.boss', feature, '.meta', 'execution.json');

    if (fs.existsSync(execJsonPath)) {
      const expectedStage = STAGE_MAP[artifact];

      if (expectedStage !== undefined) {
        let data;
        try {
          data = JSON.parse(fs.readFileSync(execJsonPath, 'utf8'));
        } catch (err) {
          process.stderr.write('[boss-skill] pre-tool-write/readExecJson: ' + err.message + '\n');
          return '';
        }

        const stages = data.stages || {};
        const stage = stages[String(expectedStage)] || {};
        const stageStatus = stage.status || 'unknown';

        if (stageStatus !== 'running' && stageStatus !== 'retrying') {
          const dagPath = path.join(cwd, 'harness', 'artifact-dag.json');
          const dag = loadArtifactDag(dagPath);
          if (dag && dag.artifacts && dag.artifacts[artifact]) {
            const ready = getReadyArtifacts(dag, data, data.parameters || {});
            const isReady = ready.some(r => r.artifact === artifact);
            if (isReady) {
              return '';
            }
          }

          return JSON.stringify({
            hookSpecificOutput: {
              hookEventName: 'PreToolUse',
              permissionDecision: 'ask',
              permissionDecisionReason: `产物 ${artifact} 属于阶段 ${expectedStage}，但该阶段状态为 ${stageStatus}（非 running）。确认要写入吗？`
            }
          });
        }
      }
    }
  }

  return '';
}

function askForUnparsedPatch() {
  return JSON.stringify({
    hookSpecificOutput: {
      hookEventName: 'PreToolUse',
      permissionDecision: 'ask',
      permissionDecisionReason: '[boss-skill] apply_patch payload 未能解析出目标文件。为避免绕过 .boss 产物护栏，请确认是否继续。'
    }
  });
}

function run(rawInput) {
  const input = normalizeHookInput(rawInput);
  if (!input) return '';
  const filePaths = input.filePaths;
  const cwd = input.cwd;

  if (filePaths.length === 0) {
    if (input.toolName === 'apply_patch' && input.patch && input.patch.includes('.boss/')) {
      return askForUnparsedPatch();
    }
    return '';
  }

  let askDecision = '';
  for (const filePath of filePaths) {
    const decision = classifyWriteDecision(filePath, cwd);
    if (!decision) continue;
    const parsed = JSON.parse(decision);
    if (parsed.hookSpecificOutput?.permissionDecision === 'deny') {
      return decision;
    }
    if (parsed.hookSpecificOutput?.permissionDecision === 'ask') {
      askDecision = decision;
    }
  }

  return askDecision;
}

export { run };
