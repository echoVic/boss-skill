#!/usr/bin/env node
import * as fs from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const PKG_ROOT = path.resolve(__dirname, '..', '..');
const pkg = JSON.parse(fs.readFileSync(path.join(PKG_ROOT, 'package.json'), 'utf8')) as {
  version: string;
};

export function showHelp(): void {
  process.stdout.write(`@blade-ai/boss-skill v${pkg.version}\nUsage:\n  boss-skill install\n`);
}

export function main(argv: string[] = process.argv.slice(2)): void {
  if (argv.includes('--help')) {
    showHelp();
    return;
  }

  if (argv.includes('--version')) {
    process.stdout.write(`${pkg.version}\n`);
    return;
  }

  if (argv[0] === 'install') {
    showHelp();
    return;
  }

  showHelp();
}

function isDirectExecution(): boolean {
  const entrypoint = process.argv[1];
  return entrypoint !== undefined && import.meta.url === pathToFileURL(entrypoint).href;
}

if (isDirectExecution()) {
  main();
}
