#!/usr/bin/env node
// 测试用门禁插件：作为「门禁失败 → 恢复」场景的确定性靶子。
// 契约（与内置 gate 一致）：feature 作为 argv[0] 传入，cwd 为工作区根，stdin 关闭。
// 缺少 .boss/<feature>/.meta/allow-gate 时判失败（exit 1），存在时判通过（exit 0）。
const fs = require('node:fs');
const path = require('node:path');

const feature = process.argv[2] || '';
const allowGate = path.join(process.cwd(), '.boss', feature, '.meta', 'allow-gate');
const passed = fs.existsSync(allowGate);

const checks = [
  {
    name: 'gate-harness-allow',
    passed,
    detail: passed ? 'allow-gate present' : '缺少 allow-gate 恢复信号，门禁失败',
  },
];

process.stdout.write(JSON.stringify(checks) + '\n');
process.exit(passed ? 0 : 1);
