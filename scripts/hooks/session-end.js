'use strict';

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');
const { writeJson } = require('../lib/boss-utils');

function run(rawInput) {
  const input = JSON.parse(rawInput);
  const cwd = input.cwd || '';

  const bossDir = path.join(cwd, '.boss');
  if (!fs.existsSync(bossDir)) return '';

  let entries;
  try {
    entries = fs.readdirSync(bossDir, { withFileTypes: true });
  } catch {
    return '';
  }

  const reportScript = path.join(
    process.env.SKILL_DIR || process.env.CLAUDE_PROJECT_DIR || '',
    'scripts',
    'report',
    'generate-summary.sh'
  );

  for (const entry of entries) {
    if (!entry.isDirectory()) continue;
    const execJsonPath = path.join(bossDir, entry.name, '.meta', 'execution.json');
    if (!fs.existsSync(execJsonPath)) continue;

    let data;
    try {
      data = JSON.parse(fs.readFileSync(execJsonPath, 'utf8'));
    } catch {
      continue;
    }

    const status = data.status || 'unknown';
    const feature = data.feature || entry.name;

    if (status === 'running' || status === 'completed' || status === 'failed') {
      const stages = data.stages || {};
      const stagesSummary = {};
      for (let s = 1; s <= 4; s++) {
        const stage = stages[String(s)] || {};
        stagesSummary[String(s)] = {
          name: stage.name || 'unknown',
          status: stage.status || 'unknown'
        };
      }

      const sessionState = {
        feature,
        pipelineStatus: status,
        stagesSummary,
        timestamp: new Date().toISOString().replace(/\.\d{3}Z$/, 'Z'),
        cwd
      };

      const sessionStatePath = path.join(cwd, '.boss', '.session-state.json');
      try {
        writeJson(sessionStatePath, sessionState);
      } catch {
      }

      try {
        if (fs.existsSync(reportScript)) {
          execSync(`bash "${reportScript}" "${feature}"`, {
            stdio: 'ignore',
            timeout: 10000
          });
        }
      } catch {
      }
    }
  }

  return '';
}

module.exports = { run };
