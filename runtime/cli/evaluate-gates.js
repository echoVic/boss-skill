#!/usr/bin/env node
import * as runtime from './lib/pipeline-runtime.js';

function showHelp() {
  process.stderr.write([
    'Boss Gate Engine - 门禁统一入口',
    '',
    '用法: evaluate-gates.js <feature> <gate-name> [options]',
    '',
    '参数:',
    '  feature     功能名称',
    '  gate-name   门禁名称: gate0 | gate1 | gate2 | <plugin-gate>',
    '',
    '选项:',
    '  --dry-run          只检查不写入结果',
    '  --skip-on-error    门禁脚本不存在时跳过而非失败',
    '',
    '门禁执行流程:',
    '  1. 定位门禁脚本（内置 scripts/gates/<gate>.sh 或插件 harness/plugins/<name>/gate.sh）',
    '  2. 执行门禁脚本，收集检查结果',
    '  3. 追加 GateEvaluated 事件并物化 .meta/execution.json',
    '  4. 返回 exit code 0 (通过) 或 1 (未通过)',
    '',
    '示例:',
    '  evaluate-gates.js my-feature gate0',
    '  evaluate-gates.js my-feature gate1 --dry-run',
    '  evaluate-gates.js my-feature security-audit --skip-on-error',
    ''
  ].join('\n'));
}

const args = process.argv.slice(2);
if (args.length === 0 || args.includes('-h') || args.includes('--help')) {
  showHelp();
  process.exit(args.length === 0 ? 1 : 0);
}

let feature = '';
let gateName = '';
let dryRun = false;
let skipOnError = false;

let idx = 0;
while (idx < args.length) {
  const arg = args[idx];
  switch (arg) {
    case '--dry-run':
      dryRun = true;
      idx += 1;
      break;
    case '--skip-on-error':
      skipOnError = true;
      idx += 1;
      break;
    default:
      if (arg.startsWith('-')) {
        process.stderr.write(`未知选项: ${arg}\n`);
        process.exit(1);
      }
      if (!feature) {
        feature = arg;
      } else if (!gateName) {
        gateName = arg;
      } else {
        process.stderr.write(`多余的参数: ${arg}\n`);
        process.exit(1);
      }
      idx += 1;
  }
}

if (!feature) {
  process.stderr.write('缺少 feature 参数\n');
  process.exit(1);
}
if (!gateName) {
  process.stderr.write('缺少 gate-name 参数\n');
  process.exit(1);
}

try {
  const result = runtime.evaluateGates(feature, gateName, {
    cwd: process.cwd(),
    dryRun,
    skipOnError
  });

  if (dryRun) {
    process.stdout.write(`${JSON.stringify({
      feature,
      gate: result.gate,
      passed: result.passed,
      checks: result.checks,
      dryRun: true,
      skipped: Boolean(result.skipped)
    })}\n`);
  } else {
    process.stdout.write(`${JSON.stringify({
      feature,
      gate: result.gate,
      passed: result.passed,
      checks: result.checks,
      skipped: Boolean(result.skipped)
    })}\n`);
  }

  process.exit(result.passed ? 0 : 1);
} catch (err) {
  process.stderr.write(`${err.message}\n`);
  process.exit(1);
}
