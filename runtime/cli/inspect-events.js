#!/usr/bin/env node
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { inspectEvents } from './lib/inspection-runtime.js';

function printHelp() {
  process.stdout.write([
    'Boss Harness - 事件流诊断',
    '',
    '用法: inspect-events.js <feature> [options]',
    '',
    '选项:',
    '  --limit <n>       返回最近 N 条事件，默认 20',
    '  --type <name>     按事件类型过滤',
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
    limit: 20,
    type: '',
    json: false
  };

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    switch (arg) {
      case '--limit':
        if (!argv[i + 1]) throw new Error('--limit 需要指定值');
        parsed.limit = Number(argv[i + 1]);
        i += 1;
        break;
      case '--type':
        if (!argv[i + 1]) throw new Error('--type 需要指定值');
        parsed.type = argv[i + 1];
        i += 1;
        break;
      case '--json':
        parsed.json = true;
        break;
      default:
        if (arg.startsWith('-')) {
          throw new Error(`未知选项: ${arg}`);
        }
        if (!parsed.feature) {
          parsed.feature = arg;
        } else {
          throw new Error(`多余的参数: ${arg}`);
        }
    }
  }

  if (!parsed.feature) {
    throw new Error('缺少 feature 参数');
  }
  return parsed;
}

function renderText(payload) {
  for (const event of payload.events) {
    process.stdout.write(`#${event.id} ${event.type} ${event.timestamp}\n`);
  }
}

function run(argv = process.argv.slice(2), { cwd = process.cwd() } = {}) {
  const parsed = parseArgs(argv);
  if (parsed.help) {
    printHelp();
    return 0;
  }

  const payload = inspectEvents(parsed.feature, {
    cwd,
    limit: parsed.limit,
    type: parsed.type
  });

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
