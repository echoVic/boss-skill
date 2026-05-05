#!/usr/bin/env node
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';

import { updateAgent } from './lib/pipeline-runtime.js';

function showHelp(): void {
  process.stderr.write(
    [
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
    ].join('\n')
  );
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
  let agent = '';
  let status = '';
  let reason = '';
  let jsonOutput = false;

  let idx = 0;
  while (idx < argv.length) {
    const arg = argv[idx]!;
    switch (arg) {
      case '--reason':
        reason = requireOptionValue('--reason', argv[idx + 1]);
        idx += 2;
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
        } else if (!agent) {
          agent = arg;
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
  if (!agent) throw new Error('缺少 agent-name 参数');
  if (!status) throw new Error('缺少 status 参数');

  try {
    updateAgent(feature, stage, agent, status, { reason, cwd });
    if (jsonOutput) {
      process.stdout.write(
        `${JSON.stringify({
          feature,
          stage: Number(stage),
          agent,
          status
        })}\n`
      );
    } else {
      process.stdout.write(`Agent ${agent} (阶段 ${stage}): → ${status}\n`);
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
