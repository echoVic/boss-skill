#!/usr/bin/env node
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  replayEvents,
  replaySnapshot
} from './lib/inspection-runtime.js';

function printHelp() {
  process.stdout.write([
    'Boss Harness - 事件回放',
    '',
    '用法: replay-events.js <feature> [options]',
    '',
    '选项:',
    '  --at <id>         显示指定事件 ID 时的状态快照',
    '  --type <type>     仅显示指定类型的事件',
    '  --limit <n>       返回最近 n 条事件（默认 20）',
    '  --compact         紧凑输出（每个事件一行）',
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
    at: '',
    type: '',
    limit: 20,
    compact: false,
    json: false
  };

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === '--at') {
      parsed.at = argv[index + 1] || '';
      index += 1;
      continue;
    }
    if (arg === '--type') {
      parsed.type = argv[index + 1] || '';
      index += 1;
      continue;
    }
    if (arg === '--limit') {
      parsed.limit = argv[index + 1] || 20;
      index += 1;
      continue;
    }
    if (arg === '--compact') {
      parsed.compact = true;
      continue;
    }
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

function renderCompact(payload) {
  for (const event of payload.events || []) {
    const stage = event.data && event.data.stage != null ? event.data.stage : '-';
    const agent = event.data && event.data.agent ? event.data.agent : '-';
    process.stdout.write(`#${event.id} [${event.timestamp}] ${event.type} stage=${stage} agent=${agent}\n`);
  }
}

function renderVerbose(payload) {
  process.stdout.write(`${JSON.stringify(payload, null, 2)}\n`);
}

function run(argv = process.argv.slice(2), { cwd = process.cwd() } = {}) {
  const parsed = parseArgs(argv);
  if (parsed.help) {
    printHelp();
    return 0;
  }

  if (parsed.at) {
    const payload = replaySnapshot(parsed.feature, parsed.at, { cwd });
    if (parsed.json) {
      process.stdout.write(`${JSON.stringify(payload)}\n`);
    } else {
      renderVerbose(payload);
    }
    return 0;
  }

  const payload = replayEvents(parsed.feature, {
    cwd,
    limit: parsed.limit,
    type: parsed.type
  });

  if (parsed.json) {
    process.stdout.write(`${JSON.stringify(payload)}\n`);
  } else if (parsed.compact) {
    renderCompact(payload);
  } else {
    renderVerbose(payload);
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
