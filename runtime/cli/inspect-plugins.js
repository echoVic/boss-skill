#!/usr/bin/env node
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { inspectPipeline } from './lib/inspection-runtime.js';

function printHelp() {
  process.stdout.write([
    'Boss Harness - 插件诊断',
    '',
    '用法: inspect-plugins.js <feature> [options]',
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

function renderText(payload) {
  process.stdout.write(`active: ${payload.active.map((plugin) => plugin.name).join(', ') || 'none'}\n`);
  process.stdout.write(`discovered: ${payload.discovered.map((plugin) => plugin.name).join(', ') || 'none'}\n`);
  process.stdout.write(`activated: ${payload.activated.map((plugin) => plugin.name).join(', ') || 'none'}\n`);
  process.stdout.write(`executed: ${payload.executed.length}\n`);
  process.stdout.write(`failed: ${payload.failed.length}\n`);
}

function run(argv = process.argv.slice(2), { cwd = process.cwd() } = {}) {
  const parsed = parseArgs(argv);
  if (parsed.help) {
    printHelp();
    return 0;
  }

  const summary = inspectPipeline(parsed.feature, { cwd });
  const payload = {
    feature: parsed.feature,
    active: summary.plugins.active,
    discovered: summary.plugins.discovered,
    activated: summary.plugins.activated,
    executed: summary.plugins.executed,
    failed: summary.plugins.failed
  };

  if (parsed.json) {
    process.stdout.write(`${JSON.stringify(payload)}\n`);
  } else {
    renderText(payload);
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
