#!/usr/bin/env node
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { runHook } from './lib/plugin-runtime.js';

function printHelp() {
  process.stdout.write([
    'Boss Harness - 插件 Hook 执行（Runtime）',
    '',
    '用法: run-plugin-hook.js <hook> <feature> [options]',
    '',
    '参数:',
    '  hook             hook 名称（如 pre-stage、post-gate）',
    '  feature          功能名称',
    '',
    '选项:',
    '  --stage <n>      按阶段过滤插件并透传 stage 参数',
    '  -h, --help       查看帮助',
    '',
    '示例:',
    '  run-plugin-hook.js post-gate my-feature --stage 3',
    ''
  ].join('\n'));
}

function parseArgs(argv) {
  if (argv.length === 0 || argv.includes('-h') || argv.includes('--help')) {
    return { help: true };
  }

  const parsed = {
    hook: '',
    feature: '',
    stage: null
  };

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    switch (arg) {
      case '--stage':
        if (!argv[i + 1]) throw new Error('--stage 需要指定值');
        parsed.stage = argv[i + 1];
        i += 1;
        break;
      default:
        if (arg.startsWith('-')) {
          throw new Error(`未知选项: ${arg}`);
        }
        if (!parsed.hook) {
          parsed.hook = arg;
        } else if (!parsed.feature) {
          parsed.feature = arg;
        } else {
          throw new Error(`多余的参数: ${arg}`);
        }
    }
  }

  if (!parsed.hook) throw new Error('缺少 hook 参数');
  if (!parsed.feature) throw new Error('缺少 feature 参数');
  return parsed;
}

function run(argv = process.argv.slice(2), { cwd = process.cwd() } = {}) {
  const parsed = parseArgs(argv);
  if (parsed.help) {
    printHelp();
    return 0;
  }

  const result = runHook(parsed.hook, parsed.feature, {
    cwd,
    stage: parsed.stage
  });

  process.stdout.write(JSON.stringify({
    hook: result.hook,
    feature: result.feature,
    stage: result.stage,
    results: result.results
  }) + '\n');
  return 0;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    const code = run(process.argv.slice(2), { cwd: process.cwd() });
    process.exit(code);
  } catch (err) {
    process.stderr.write(`[PLUGIN] ${err.message}\n`);
    process.exit(1);
  }
}

export {
  parseArgs,
  run
};
