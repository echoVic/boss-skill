#!/usr/bin/env node
import * as runtime from './lib/pipeline-runtime.js';

function showHelp() {
  process.stderr.write([
    'Boss Harness - Agent 状态更新',
    '',
    '用法: update-agent.js <feature> <stage> <agent-name> <status> [options]',
    '',
    '参数:',
    '  feature      功能名称',
    '  stage        阶段编号 (1-4)',
    '  agent-name   Agent 名称（如 boss-pm、boss-frontend）',
    '  status       目标状态: running | completed | failed',
    '',
    '选项:',
    '  --reason <text>   失败原因（status=failed 时使用）',
    '',
    '示例:',
    '  update-agent.js my-feature 1 boss-pm running',
    '  update-agent.js my-feature 3 boss-qa failed --reason "测试覆盖率不足"',
    ''
  ].join('\n'));
}

const args = process.argv.slice(2);
if (args.length === 0 || args.includes('-h') || args.includes('--help')) {
  showHelp();
  process.exit(args.length === 0 ? 1 : 0);
}

let feature = '';
let stage = '';
let agent = '';
let status = '';
let reason = '';
let jsonOutput = false;

function requireOptionValue(flag, value) {
  if (!value || value.startsWith('-')) {
    process.stderr.write(`缺少 ${flag} 参数值\n`);
    process.exit(1);
  }
  return value;
}

let idx = 0;
while (idx < args.length) {
  const arg = args[idx];
  switch (arg) {
    case '--reason':
      reason = requireOptionValue('--reason', args[idx + 1]);
      idx += 2;
      break;
    case '--json':
      jsonOutput = true;
      idx += 1;
      break;
    default:
      if (arg.startsWith('-')) {
        process.stderr.write(`未知选项: ${arg}\n`);
        process.exit(1);
      }
      if (!feature) {
        feature = arg;
      } else if (!stage) {
        stage = arg;
      } else if (!agent) {
        agent = arg;
      } else if (!status) {
        status = arg;
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
if (!stage) {
  process.stderr.write('缺少 stage 参数\n');
  process.exit(1);
}
if (!agent) {
  process.stderr.write('缺少 agent-name 参数\n');
  process.exit(1);
}
if (!status) {
  process.stderr.write('缺少 status 参数\n');
  process.exit(1);
}

try {
  runtime.updateAgent(feature, stage, agent, status, { reason, cwd: process.cwd() });
  if (jsonOutput) {
    process.stdout.write(JSON.stringify({
      feature,
      stage: Number(stage),
      agent,
      status
    }) + '\n');
  } else {
    process.stdout.write(`Agent ${agent} (阶段 ${stage}): → ${status}\n`);
  }
} catch (err) {
  process.stderr.write(`${err.message}\n`);
  process.exit(1);
}
