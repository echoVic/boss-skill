'use strict';

const fs = require('fs');
const path = require('path');
const { findActiveFeature, readExecJson } = require('../lib/boss-utils');

function run(rawInput) {
  const input = JSON.parse(rawInput);
  const cwd = input.cwd || '';

  if (!cwd) return '';

  let context = '';

  const active = findActiveFeature(cwd);
  if (active) {
    const execData = readExecJson(cwd, active.feature);
    if (execData) {
      const pipelineStatus = execData.status || 'unknown';
      let stagesInfo = '';
      const stages = execData.stages || {};
      for (let s = 1; s <= 4; s++) {
        const stage = stages[String(s)] || {};
        const sName = stage.name || 'unknown';
        const sStatus = stage.status || 'unknown';
        stagesInfo += `  Stage ${s} (${sName}): ${sStatus}\n`;
      }
      context += `[Boss Harness] Active pipeline detected: ${active.feature} (status: ${pipelineStatus})\n${stagesInfo}`;
      context += `\nTo continue this pipeline, use: /boss ${active.feature} --continue-from <stage>`;
    }
  }

  let pluginCount = 0;
  const pluginDir = path.join(process.env.SKILL_DIR || process.env.CLAUDE_PROJECT_DIR || '', 'harness', 'plugins');
  if (fs.existsSync(pluginDir)) {
    try {
      const pluginEntries = fs.readdirSync(pluginDir, { withFileTypes: true });
      for (const entry of pluginEntries) {
        if (!entry.isDirectory()) continue;
        const pjPath = path.join(pluginDir, entry.name, 'plugin.json');
        if (!fs.existsSync(pjPath)) continue;
        try {
          const pj = JSON.parse(fs.readFileSync(pjPath, 'utf8'));
          const enabled = pj.enabled !== undefined ? pj.enabled : true;
          if (enabled) pluginCount++;
        } catch {
          continue;
        }
      }
    } catch {
    }
  }

  if (pluginCount > 0) {
    context += `\n[Boss Harness] ${pluginCount} plugin(s) registered`;
  }

  const sessionStatePath = path.join(cwd, '.boss', '.session-state.json');
  let previousSession = null;
  if (fs.existsSync(sessionStatePath)) {
    try {
      previousSession = JSON.parse(fs.readFileSync(sessionStatePath, 'utf8'));
      context += '\n[Boss Harness] Previous session state loaded';
    } catch {
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

module.exports = { run };
