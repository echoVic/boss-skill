#!/usr/bin/env node
import { readdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';

const root = path.resolve(import.meta.dirname, '..');
const skill = path.join(root, 'skill');
const plugin = path.join(root, 'integrations/deepseek-harness');
const files = {};
function collect(relative) {
  for (const entry of readdirSync(path.join(skill, relative), { withFileTypes: true }).sort(
    (a, b) => a.name.localeCompare(b.name, 'en'),
  )) {
    const key = path.posix.join(relative, entry.name);
    if (entry.isDirectory()) collect(key);
    else if (entry.isFile()) files[key] = readFileSync(path.join(skill, key), 'utf8');
  }
}
files['SKILL.md'] = readFileSync(path.join(skill, 'SKILL.md'), 'utf8');
for (const directory of ['agents', 'references', 'templates', 'skills']) collect(directory);
const content =
  JSON.stringify(
    {
      bossVersion: JSON.parse(readFileSync(path.join(root, 'package.json'), 'utf8')).version,
      files,
    },
    null,
    2,
  ) + '\n';
const license = readFileSync(path.join(root, 'LICENSE'), 'utf8');
for (const [file, value] of [
  ['resources.json', content],
  ['LICENSE', license],
]) {
  const destination = path.join(plugin, file);
  if (process.argv.includes('--check')) {
    if (readFileSync(destination, 'utf8') !== value)
      throw new Error(`${file} is stale; run npm run dsh:build`);
  } else writeFileSync(destination, value);
}
console.log(
  `Boss DSH resources ${process.argv.includes('--check') ? 'verified' : 'generated'}: ${Object.keys(files).length} files`,
);
