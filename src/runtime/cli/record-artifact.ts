#!/usr/bin/env node
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';

import { recordArtifact } from './lib/pipeline-runtime.js';

function showHelp(): void {
  process.stderr.write(
    [
      'Boss Harness - 记录产物完成',
      '',
      '用法: record-artifact.js <feature> <artifact> <stage>',
      '',
      '参数:',
      '  feature    功能名称',
      '  artifact   产物名称（如 prd.md、architecture.md、code）',
      '  stage      所属阶段编号 (1-4)',
      '',
      '说明:',
      '  1. 追加 ArtifactRecorded 事件',
      '  2. 物化 execution.json 只读视图',
      '  3. 返回该阶段当前已记录的产物列表',
      '',
      '示例:',
      '  record-artifact.js my-feature prd.md 1',
      ''
    ].join('\n')
  );
}

export function main(argv: string[] = process.argv.slice(2), { cwd = process.cwd() }: { cwd?: string } = {}): number {
  const [feature, artifact, stage] = argv;
  if (
    !feature ||
    feature === '-h' ||
    feature === '--help' ||
    !artifact ||
    !stage ||
    stage === '-h' ||
    stage === '--help'
  ) {
    showHelp();
    return feature === '-h' || feature === '--help' || (feature && artifact && stage) ? 0 : 1;
  }

  try {
    const execution = recordArtifact(feature, artifact, Number(stage), { cwd });
    const stageKey = String(stage);
    const artifacts =
      execution.stages && execution.stages[stageKey] ? execution.stages[stageKey]!.artifacts : [];
    process.stdout.write(
      `${JSON.stringify({
        feature,
        artifact,
        stage: Number(stage),
        artifacts
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
