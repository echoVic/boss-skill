import fs from 'node:fs';
import path from 'node:path';

import { findActiveFeature, readExecJson } from '../lib/boss-utils.js';
import { inspectPipeline } from '../../runtime/cli/lib/inspection-runtime.js';

function run(rawInput) {
  const input = JSON.parse(rawInput);
  const cwd = input.cwd || '';

  if (!cwd) return '';

  let context = '';

  const active = findActiveFeature(cwd);
  if (active) {
    try {
      const summary = inspectPipeline(active.feature, { cwd });
      const execData = readExecJson(cwd, active.feature);
      const pipelineStatus = summary.status || 'unknown';
      let stagesInfo = '';
      const stages = execData.stages || {};
      for (let s = 1; s <= 4; s++) {
        const stage = stages[String(s)] || {};
        const sName = stage.name || 'unknown';
        const sStatus = stage.status || 'unknown';
        stagesInfo += `  Stage ${s} (${sName}): ${sStatus}\n`;
      }
      context += `[Boss Harness] Active pipeline detected: ${active.feature} (status: ${pipelineStatus})\n${stagesInfo}`;
      if (summary.currentStage) {
        context += `\n[Boss Harness] Current stage: ${summary.currentStage.id} (${summary.currentStage.name}) ${summary.currentStage.status}`;
      }
      if (summary.plugins && Array.isArray(summary.plugins.active) && summary.plugins.active.length > 0) {
        context += `\n[Boss Harness] ${summary.plugins.active.length} plugin(s) registered`;
      }
      context += `\nTo continue this pipeline, use: /boss ${active.feature} --continue-from <stage>`;
    } catch (err) {
      process.stderr.write('[boss-skill] session-start/inspectPipeline: ' + err.message + '\n');
    }
  }

  const sessionStatePath = path.join(cwd, '.boss', '.session-state.json');
  let previousSession = null;
  if (fs.existsSync(sessionStatePath)) {
    try {
      previousSession = JSON.parse(fs.readFileSync(sessionStatePath, 'utf8'));
      context += '\n[Boss Harness] Previous session state loaded';
    } catch (err) {
      process.stderr.write('[boss-skill] session-start/readSessionState: ' + err.message + '\n');
    }
  }

  if (!context) return '';

  const result = {
    hookSpecificOutput: {
      hookEventName: 'SessionStart',
      additionalContext: context
    }
  };

  if (previousSession) {
    result.hookSpecificOutput.previousSessionState = previousSession;
  }

  return JSON.stringify(result);
}

export { run };
