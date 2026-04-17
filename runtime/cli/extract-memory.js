#!/usr/bin/env node
import * as runtime from './lib/memory-runtime.js';

function printHelp() {
  process.stdout.write([
    'Boss Harness - 提炼 feature memory',
    '',
    '用法: extract-memory.js <feature>',
    ''
  ].join('\n'));
}

const feature = process.argv[2];
if (!feature || feature === '--help' || feature === '-h') {
  printHelp();
  process.exit(feature ? 0 : 1);
}

try {
  const payload = runtime.rebuildFeatureMemory(feature, { cwd: process.cwd() });
  process.stdout.write(`${JSON.stringify({ feature, count: payload.records.length })}\n`);
} catch (err) {
  process.stderr.write(`${err.message}\n`);
  process.exit(1);
}
