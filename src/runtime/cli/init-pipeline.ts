#!/usr/bin/env node
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';

import { initPipeline } from './lib/pipeline-runtime.js';

function showHelp(): void {
  process.stderr.write(
    [
      'Boss Harness - 初始化流水线',
      '',
      '用法: init-pipeline.js <feature>',
      '',
      '参数:',
      '  feature   功能名称',
      '',
      '说明:',
      '  1. 初始化 .boss/<feature>/ 目录和元数据',
      '  2. 追加 PipelineInitialized 事件',
      '  3. 物化 .boss/<feature>/.meta/execution.json 只读视图',
      '',
      '示例:',
      '  init-pipeline.js my-feature',
      ''
    ].join('\n')
  );
}

export function main(argv: string[] = process.argv.slice(2), { cwd = process.cwd() }: { cwd?: string } = {}): number {
  const [feature] = argv;
  if (!feature || feature === '-h' || feature === '--help') {
    showHelp();
    return feature ? 0 : 1;
  }

  try {
    const execution = initPipeline(feature, { cwd });
    process.stdout.write(
      `${JSON.stringify({
        feature: execution.feature,
        status: execution.status,
        executionPath: `.boss/${execution.feature}/.meta/execution.json`
      })}\n`
    );
    return 0;
  } catch (err) {
    process.stderr.write(`${(err as Error).message}\n`);
    return 1;
  }
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  process.exit(main(process.argv.slice(2), { cwd: process.cwd() }));
}
