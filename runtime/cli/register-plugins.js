import path from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  discoverPlugins,
  validatePlugins,
  registerPlugins
} from './lib/plugin-runtime.js';

function printHelp() {
  process.stdout.write([
    'Boss Harness - 插件加载器（Runtime）',
    '',
    '用法: register-plugins.js [options]',
    '',
    '选项:',
    '  --list                 列出所有已启用插件',
    '  --type <type>          按类型过滤：gate | agent | pipeline-pack | reporter',
    '  --validate             验证插件清单与脚本引用',
    '  --register <feature>   追加插件注册事件并物化 read model（execution.json）',
    '  -h, --help             查看帮助',
    ''
  ].join('\n'));
}

function parseArgs(argv) {
  const parsed = {
    action: 'list',
    type: '',
    feature: ''
  };

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    switch (arg) {
      case '-h':
      case '--help':
        parsed.action = 'help';
        break;
      case '--list':
        parsed.action = 'list';
        break;
      case '--validate':
        parsed.action = 'validate';
        break;
      case '--type':
        if (!argv[i + 1]) throw new Error('--type 需要指定值');
        parsed.type = argv[i + 1];
        i += 1;
        break;
      case '--register':
        if (!argv[i + 1]) throw new Error('--register 需要指定 feature');
        parsed.action = 'register';
        parsed.feature = argv[i + 1];
        i += 1;
        break;
      default:
        throw new Error(`未知选项: ${arg}`);
    }
  }

  return parsed;
}

function run(argv = process.argv.slice(2), { cwd = process.cwd() } = {}) {
  const parsed = parseArgs(argv);
  if (parsed.action === 'help') {
    printHelp();
    return 0;
  }

  if (parsed.action === 'list') {
    const result = discoverPlugins({ cwd, type: parsed.type, strict: false });
    for (const plugin of result.plugins) {
      process.stdout.write(`  ${plugin.name}@${plugin.version} (${plugin.type})\n`);
    }
    if (result.plugins.length === 0) {
      process.stdout.write('未发现已启用插件\n');
    } else {
      process.stdout.write(`共发现 ${result.plugins.length} 个插件\n`);
    }
    if (result.errors.length > 0) {
      process.stderr.write(`${result.errors.join('\n')}\n`);
    }
    return result.errors.length > 0 ? 1 : 0;
  }

  if (parsed.action === 'validate') {
    const result = validatePlugins({ cwd, type: parsed.type });
    for (const plugin of result.plugins) {
      process.stdout.write(`${plugin.name}@${plugin.version} (${plugin.type}) — 有效\n`);
    }
    if (!result.valid) {
      process.stderr.write(`${result.errors.join('\n')}\n`);
      return 1;
    }
    process.stdout.write('所有插件验证通过\n');
    return 0;
  }

  if (parsed.action === 'register') {
    const result = registerPlugins(parsed.feature, { cwd, type: parsed.type });
    const execPath = path.join(cwd, '.boss', parsed.feature, '.meta', 'execution.json');
    process.stdout.write(`已追加 ${result.plugins.length} 个插件注册事件，并物化 read model: ${execPath}\n`);
    return 0;
  }

  throw new Error(`不支持的 action: ${parsed.action}`);
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
  run,
  parseArgs
};
