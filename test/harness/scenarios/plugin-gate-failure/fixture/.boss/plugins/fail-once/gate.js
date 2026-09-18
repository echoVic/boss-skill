#!/usr/bin/env node
const fs = require('node:fs');
const path = require('node:path');

const feature = process.argv[2] || '';
const marker = path.join(process.cwd(), '.boss', feature, '.meta', 'allow-gate');
const checks = [];

if (fs.existsSync(marker)) {
  checks.push({ name: 'allow-gate', passed: true });
  process.stdout.write(`${JSON.stringify(checks)}\n`);
  process.exit(0);
} else {
  checks.push({ name: 'allow-gate', passed: false, detail: 'allow-gate marker missing' });
  process.stdout.write(`${JSON.stringify(checks)}\n`);
  process.exit(1);
}
