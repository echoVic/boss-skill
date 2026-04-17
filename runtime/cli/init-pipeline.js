#!/usr/bin/env node
import * as runtime from './lib/pipeline-runtime.js';

function showHelp() {
  process.stderr.write([
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
  ].join('\n'));
}

const [feature] = process.argv.slice(2);
if (!feature || feature === '-h' || feature === '--help') {
  showHelp();
  process.exit(feature ? 0 : 1);
}

try {
  const execution = runtime.initPipeline(feature);
  process.stdout.write(JSON.stringify({
    feature: execution.feature,
    status: execution.status,
    executionPath: `.boss/${execution.feature}/.meta/execution.json`
  }) + '\n');
} catch (err) {
  process.stderr.write(`${err.message}\n`);
  process.exit(1);
}
