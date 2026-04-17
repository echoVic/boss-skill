#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';

import * as runtime from './lib/pipeline-runtime.js';

function showHelp() {
  process.stderr.write([
    'Boss Harness - 阶段状态更新',
    '',
    '用法: update-stage.js <feature> <stage> <status> [options]',
    '',
    '参数:',
    '  feature   功能名称',
    '  stage     阶段编号 (1-4)',
    '  status    目标状态: running | completed | failed | retrying | skipped',
    '',
    '选项:',
    '  --reason <text>        失败原因（status=failed 时使用）',
    '  --artifact <name>      记录产出的产物文件名（可多次使用）',
    '  --gate <name>          记录关联的 gate 名称',
    '  --gate-passed          标记 gate 通过',
    '  --gate-failed          标记 gate 未通过',
    '',
    '示例:',
    '  update-stage.js my-feature 1 running',
    '  update-stage.js my-feature 1 completed --artifact prd.md --artifact architecture.md',
    '  update-stage.js my-feature 3 failed --reason "单元测试覆盖率不足"',
    '  update-stage.js my-feature 3 completed --gate gate1 --gate-passed',
    ''
  ].join('\n'));
}

function readCurrentStatus(cwd, feature, stage) {
  const execPath = path.join(cwd, '.boss', feature, '.meta', 'execution.json');
  if (!fs.existsSync(execPath)) return 'unknown';
  try {
    const execution = JSON.parse(fs.readFileSync(execPath, 'utf8'));
    const stageState = execution.stages ? execution.stages[String(stage)] : null;
    return stageState && stageState.status ? stageState.status : 'unknown';
  } catch {
    return 'unknown';
  }
}

const args = process.argv.slice(2);
if (args.length === 0 || args.includes('-h') || args.includes('--help')) {
  showHelp();
  process.exit(args.length === 0 ? 1 : 0);
}

let feature = '';
let stage = '';
let status = '';
let reason = '';
const artifacts = [];
let gate = '';
let gatePassed = null;
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
    case '--artifact':
      artifacts.push(requireOptionValue('--artifact', args[idx + 1]));
      idx += 2;
      break;
    case '--gate':
      gate = requireOptionValue('--gate', args[idx + 1]);
      idx += 2;
      break;
    case '--gate-passed':
      gatePassed = true;
      idx += 1;
      break;
    case '--gate-failed':
      gatePassed = false;
      idx += 1;
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
if (!status) {
  process.stderr.write('缺少 status 参数\n');
  process.exit(1);
}

try {
  const cwd = process.cwd();
  const currentStatus = readCurrentStatus(cwd, feature, stage);
  runtime.updateStage(feature, stage, status, {
    cwd,
    reason,
    artifacts,
    gate,
    gatePassed
  });

  if (jsonOutput) {
    process.stdout.write(JSON.stringify({
      feature,
      stage: Number(stage),
      previousStatus: currentStatus,
      status,
      executionPath: `.boss/${feature}/.meta/execution.json`
    }) + '\n');
  } else {
    process.stdout.write(`阶段 ${stage}: ${currentStatus} → ${status}\n`);
    process.stdout.write(`文件: .boss/${feature}/.meta/execution.json\n`);
  }
} catch (err) {
  process.stderr.write(`${err.message}\n`);
  process.exit(1);
}
