#!/usr/bin/env node
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';

import { retryAgent } from './lib/pipeline-runtime.js';

function showHelp(): void {
  process.stderr.write(
    [
      'Boss Harness - Agent 重试',
      '',
      '用法: retry-agent.js <feature> <stage> <agent-name>',
      '',
      '参数:',
      '  feature      功能名称',
      '  stage        阶段编号',
      '  agent-name   Agent 名称',
      ''
    ].join('\n')
  );
}

export function main(argv: string[] = process.argv.slice(2), { cwd = process.cwd() }: { cwd?: string } = {}): number {
  const [feature, stage, agentName] = argv;
  if (!feature || feature === '-h' || feature === '--help' || !stage || !agentName) {
    showHelp();
    return feature === '-h' || feature === '--help' ? 0 : 1;
  }
  try {
    const state = retryAgent(feature, Number(stage), agentName, { cwd });
    const agent = state.stages?.[stage]?.agents?.[agentName];
    process.stdout.write(JSON.stringify({ feature, stage: Number(stage), agent: agentName, status: agent?.status, retryCount: agent?.retryCount }) + '\n');
    return 0;
  } catch (err) {
    process.stderr.write(`${(err as Error).message}\n`);
    return 1;
  }
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  process.exit(main());
}
