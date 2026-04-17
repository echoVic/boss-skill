#!/usr/bin/env node
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  checkStage,
  checkCanProceed,
  checkCanRetry
} from './lib/inspection-runtime.js';

function printHelp() {
  process.stdout.write([
    'Boss Harness - 阶段状态检查',
    '',
    '用法: check-stage.js <feature> [stage] [options]',
    '',
    '选项:',
    '  --can-proceed      检查指定阶段是否可以开始执行',
    '  --can-retry        检查指定阶段是否可以重试',
    '  --agents           显示指定阶段中各 Agent 的状态',
    '  --json             输出 JSON',
    '  --summary          输出流水线摘要',
    '  -h, --help         查看帮助',
    ''
  ].join('\n'));
}

function parseArgs(argv) {
  if (argv.length === 0 || argv.includes('-h') || argv.includes('--help')) {
    return { help: true };
  }

  const parsed = {
    feature: '',
    stage: '',
    canProceed: false,
    canRetry: false,
    agents: false,
    json: false,
    summary: false
  };

  for (const arg of argv) {
    if (arg === '--can-proceed') {
      parsed.canProceed = true;
      continue;
    }
    if (arg === '--can-retry') {
      parsed.canRetry = true;
      continue;
    }
    if (arg === '--agents') {
      parsed.agents = true;
      continue;
    }
    if (arg === '--json') {
      parsed.json = true;
      continue;
    }
    if (arg === '--summary') {
      parsed.summary = true;
      continue;
    }
    if (arg.startsWith('-')) {
      throw new Error(`未知选项: ${arg}`);
    }
    if (!parsed.feature) {
      parsed.feature = arg;
      continue;
    }
    if (!parsed.stage) {
      parsed.stage = arg;
      continue;
    }
    throw new Error(`多余的参数: ${arg}`);
  }

  if (!parsed.feature) {
    throw new Error('缺少 feature 参数');
  }
  return parsed;
}

function renderTextStage(stageId, payload) {
  if (!payload) {
    process.stdout.write(`阶段 ${stageId}: unknown\n`);
    return;
  }
  process.stdout.write(`阶段 ${stageId} (${payload.name || ''}): ${payload.status}\n`);
}

function renderSummary(payload) {
  process.stdout.write(`status: ${payload.status}\n`);
  for (const [stageId, stage] of Object.entries(payload.stages || {})) {
    process.stdout.write(`stage ${stageId}: ${stage.status}\n`);
  }
}

function run(argv = process.argv.slice(2), { cwd = process.cwd() } = {}) {
  const parsed = parseArgs(argv);
  if (parsed.help) {
    printHelp();
    return 0;
  }

  if (parsed.canProceed) {
    const result = checkCanProceed(parsed.feature, parsed.stage, { cwd });
    if (!result.ok) {
      process.stderr.write(`${result.reason}\n`);
      return 1;
    }
    process.stdout.write(`阶段 ${parsed.stage} 可以开始\n`);
    return 0;
  }

  if (parsed.canRetry) {
    const result = checkCanRetry(parsed.feature, parsed.stage, { cwd });
    if (!result.ok) {
      process.stderr.write(`${result.reason}\n`);
      return 1;
    }
    process.stdout.write(`阶段 ${parsed.stage} 可以重试\n`);
    return 0;
  }

  const payload = checkStage(parsed.feature, parsed.stage, { cwd });
  if (parsed.agents && parsed.stage) {
    const agents = payload && payload.agents ? payload.agents : {};
    if (parsed.json) {
      process.stdout.write(`${JSON.stringify(agents)}\n`);
    } else {
      for (const [agentName, agentState] of Object.entries(agents)) {
        process.stdout.write(`${agentName}: ${agentState.status}\n`);
      }
    }
    return 0;
  }

  if (parsed.json) {
    process.stdout.write(`${JSON.stringify(payload)}\n`);
    return 0;
  }

  if (parsed.summary || !parsed.stage) {
    renderSummary(payload);
    return 0;
  }

  renderTextStage(parsed.stage, payload);
  return 0;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    process.exit(run(process.argv.slice(2), { cwd: process.cwd() }));
  } catch (err) {
    process.stderr.write(`${err.message}\n`);
    process.exit(1);
  }
}

export {
  parseArgs,
  run
};
