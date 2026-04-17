#!/usr/bin/env node
import * as runtime from './lib/pipeline-runtime.js';

function showHelp() {
  process.stderr.write([
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
  ].join('\n'));
}

const [feature, artifact, stage] = process.argv.slice(2);
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
  process.exit(feature === '-h' || feature === '--help' || (feature && artifact && stage) ? 0 : 1);
}

try {
  const execution = runtime.recordArtifact(feature, artifact, Number(stage));
  const stageKey = String(stage);
  const artifacts = execution.stages && execution.stages[stageKey] ? execution.stages[stageKey].artifacts : [];
  process.stdout.write(JSON.stringify({
    feature,
    artifact,
    stage: Number(stage),
    artifacts
  }) + '\n');
} catch (err) {
  process.stderr.write(`${err.message}\n`);
  process.exit(1);
}
