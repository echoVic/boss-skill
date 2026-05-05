#!/usr/bin/env node
import * as fs from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';

import { updateStage } from './lib/pipeline-runtime.js';

function showHelp(): void {
  process.stderr.write(
    [
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
    ].join('\n')
  );
}

function readCurrentStatus(cwd: string, feature: string, stage: string): string {
  const execPath = path.join(cwd, '.boss', feature, '.meta', 'execution.json');
  if (!fs.existsSync(execPath)) return 'unknown';
  try {
    const execution = JSON.parse(fs.readFileSync(execPath, 'utf8')) as {
      stages?: Record<string, { status?: string }>;
    };
    const stageState = execution.stages ? execution.stages[String(stage)] : null;
    return stageState && stageState.status ? stageState.status : 'unknown';
  } catch {
    return 'unknown';
  }
}

function requireOptionValue(flag: string, value: string | undefined): string {
  if (!value || value.startsWith('-')) {
    throw new Error(`缺少 ${flag} 参数值`);
  }
  return value;
}

export function main(argv: string[] = process.argv.slice(2), { cwd = process.cwd() }: { cwd?: string } = {}): number {
  if (argv.length === 0 || argv.includes('-h') || argv.includes('--help')) {
    showHelp();
    return argv.length === 0 ? 1 : 0;
  }

  let feature = '';
  let stage = '';
  let status = '';
  let reason = '';
  const artifacts: string[] = [];
  let gate = '';
  let gatePassed: boolean | null = null;
  let jsonOutput = false;

  let idx = 0;
  while (idx < argv.length) {
    const arg = argv[idx]!;
    switch (arg) {
      case '--reason':
        reason = requireOptionValue('--reason', argv[idx + 1]);
        idx += 2;
        break;
      case '--artifact':
        artifacts.push(requireOptionValue('--artifact', argv[idx + 1]));
        idx += 2;
        break;
      case '--gate':
        gate = requireOptionValue('--gate', argv[idx + 1]);
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
          throw new Error(`未知选项: ${arg}`);
        }
        if (!feature) {
          feature = arg;
        } else if (!stage) {
          stage = arg;
        } else if (!status) {
          status = arg;
        } else {
          throw new Error(`多余的参数: ${arg}`);
        }
        idx += 1;
    }
  }

  if (!feature) throw new Error('缺少 feature 参数');
  if (!stage) throw new Error('缺少 stage 参数');
  if (!status) throw new Error('缺少 status 参数');

  try {
    const currentStatus = readCurrentStatus(cwd, feature, stage);
    updateStage(feature, stage, status, {
      cwd,
      reason,
      artifacts,
      gate,
      gatePassed
    });

    if (jsonOutput) {
      process.stdout.write(
        `${JSON.stringify({
          feature,
          stage: Number(stage),
          previousStatus: currentStatus,
          status,
          executionPath: `.boss/${feature}/.meta/execution.json`
        })}\n`
      );
    } else {
      process.stdout.write(`阶段 ${stage}: ${currentStatus} → ${status}\n`);
      process.stdout.write(`文件: .boss/${feature}/.meta/execution.json\n`);
    }
    return 0;
  } catch (err) {
    process.stderr.write(`${(err as Error).message}\n`);
    return 1;
  }
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  process.exit(main(process.argv.slice(2), { cwd: process.cwd() }));
}
