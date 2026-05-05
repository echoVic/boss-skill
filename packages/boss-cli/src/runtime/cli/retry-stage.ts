#!/usr/bin/env node
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';

import { retryStage } from './lib/pipeline-runtime.js';

function showHelp(): void {
  process.stderr.write(
    [
      'Boss Harness - 阶段重试',
      '',
      '用法: retry-stage.js <feature> <stage>',
      '',
      '参数:',
      '  feature    功能名称',
      '  stage      阶段编号',
      ''
    ].join('\n')
  );
}

export function main(argv: string[] = process.argv.slice(2), { cwd = process.cwd() }: { cwd?: string } = {}): number {
  const [feature, stage] = argv;
  if (!feature || feature === '-h' || feature === '--help' || !stage) {
    showHelp();
    return feature === '-h' || feature === '--help' ? 0 : 1;
  }
  try {
    const state = retryStage(feature, Number(stage), { cwd });
    const stageState = state.stages?.[stage];
    process.stdout.write(JSON.stringify({ feature, stage: Number(stage), status: stageState?.status, retryCount: stageState?.retryCount }) + '\n');
    return 0;
  } catch (err) {
    process.stderr.write(`${(err as Error).message}\n`);
    return 1;
  }
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  process.exit(main());
}
