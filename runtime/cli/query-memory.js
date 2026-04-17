#!/usr/bin/env node
import * as runtime from './lib/memory-runtime.js';

function printHelp() {
  process.stdout.write([
    'Boss Harness - 查询 memory',
    '',
    '用法: query-memory.js <feature> [options]',
    '',
    '选项:',
    '  --startup         输出 startup summary',
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
    startup: false,
    json: false
  };

  for (const arg of argv) {
    if (arg === '--startup') {
      parsed.startup = true;
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

try {
  const parsed = parseArgs(process.argv.slice(2));
  if (parsed.help) {
    printHelp();
    process.exit(0);
  }

  const summary = runtime.readFeatureSummary(parsed.feature, { cwd: process.cwd() });
  const payload = parsed.startup
    ? { feature: parsed.feature, startupSummary: summary.startupSummary || [] }
    : summary;

  if (parsed.json) {
    process.stdout.write(`${JSON.stringify(payload)}\n`);
  } else if (parsed.startup) {
    for (const item of payload.startupSummary) {
      process.stdout.write(`- [${item.category}] ${item.summary}\n`);
    }
  } else {
    process.stdout.write(`${JSON.stringify(payload, null, 2)}\n`);
  }
} catch (err) {
  process.stderr.write(`${err.message}\n`);
  process.exit(1);
}
