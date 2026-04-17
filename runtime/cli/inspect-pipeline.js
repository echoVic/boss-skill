#!/usr/bin/env node
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { inspectPipeline } from './lib/inspection-runtime.js';

function printHelp() {
  process.stdout.write([
    'Boss Harness - 流水线诊断',
    '',
    '用法: inspect-pipeline.js <feature> [options]',
    '',
    '选项:',
    '  --json            输出 JSON',
    '  -h, --help        查看帮助',
    ''
  ].join('\n'));
}

function parseArgs(argv) {
  if (argv.length === 0 || argv.includes('-h') || argv.includes('--help')) {
    return { help: true };
  }

  const parsed = {
    feature: '',
    json: false
  };

  for (const arg of argv) {
    if (arg === '--json') {
      parsed.json = true;
      continue;
    }
    if (arg.startsWith('-')) {
      throw new Error(`未知选项: ${arg}`);
    }
    if (!parsed.feature) {
      parsed.feature = arg;
      continue;
    }
    throw new Error(`多余的参数: ${arg}`);
  }

  if (!parsed.feature) {
    throw new Error('缺少 feature 参数');
  }
  return parsed;
}

function renderText(summary) {
  process.stdout.write(`feature: ${summary.feature}\n`);
  process.stdout.write(`status: ${summary.status}\n`);
  if (summary.currentStage) {
    process.stdout.write(`currentStage: ${summary.currentStage.id} (${summary.currentStage.name}) ${summary.currentStage.status}\n`);
  }
  process.stdout.write(`readyArtifacts: ${summary.readyArtifacts.join(', ') || 'none'}\n`);
  process.stdout.write(`activeAgents: ${summary.activeAgents.map((item) => `${item.agent}@${item.stage}`).join(', ') || 'none'}\n`);
  process.stdout.write(`pack: ${summary.pack.name}\n`);
  process.stdout.write(`plugins: ${summary.plugins.active.map((plugin) => plugin.name).join(', ') || 'none'}\n`);
  process.stdout.write(`memoryStartup: ${(summary.memory && summary.memory.startupSummary || []).map((item) => item.summary).join(' | ') || 'none'}\n`);
}

function run(argv = process.argv.slice(2), { cwd = process.cwd() } = {}) {
  const parsed = parseArgs(argv);
  if (parsed.help) {
    printHelp();
    return 0;
  }

  const summary = inspectPipeline(parsed.feature, { cwd });
  if (parsed.json) {
    process.stdout.write(`${JSON.stringify(summary)}\n`);
  } else {
    renderText(summary);
  }
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
