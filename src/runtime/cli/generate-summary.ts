#!/usr/bin/env node
import * as fs from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';

import { renderJson } from '../report/render-json.js';
import { renderMarkdown } from '../report/render-markdown.js';
import { buildSummaryModel } from '../report/summary-model.js';

function printHelp(): void {
  process.stdout.write(
    [
      'Boss Harness - 流水线报告生成器（Runtime）',
      '',
      '用法: generate-summary.js <feature> [options]',
      '',
      '选项:',
      '  --json     输出 JSON 格式而非 Markdown',
      '  --stdout   输出到标准输出而非文件',
      '  -h, --help 查看帮助',
      ''
    ].join('\n')
  );
}

export function parseArgs(argv: string[]) {
  if (argv.length === 0 || argv.includes('-h') || argv.includes('--help')) {
    return { help: true } as const;
  }

  const parsed = {
    feature: '',
    json: false,
    stdout: false
  };

  for (const arg of argv) {
    if (arg === '--json') {
      parsed.json = true;
      continue;
    }
    if (arg === '--stdout') {
      parsed.stdout = true;
      continue;
    }
    if (arg.startsWith('-')) {
      throw new Error(`未知选项: ${arg}`);
    }
    if (!parsed.feature) {
      parsed.feature = arg;
      continue;
    }
    throw new Error(`多余的参数: ${arg}`);
  }

  if (!parsed.feature) {
    throw new Error('缺少 feature 参数');
  }
  return parsed;
}

export function main(argv: string[] = process.argv.slice(2), { cwd = process.cwd() }: { cwd?: string } = {}): number {
  const parsed = parseArgs(argv);
  if ('help' in parsed) {
    printHelp();
    return 0;
  }

  const model = buildSummaryModel(parsed.feature, { cwd });
  const rendered = parsed.json ? renderJson(model) : renderMarkdown(model);
  const outputPath = path.join(
    cwd,
    '.boss',
    parsed.feature,
    parsed.json ? 'summary-report.json' : 'summary-report.md'
  );

  if (parsed.stdout) {
    process.stdout.write(rendered);
    return 0;
  }

  fs.writeFileSync(outputPath, rendered, 'utf8');
  process.stdout.write(`报告已生成: ${outputPath}\n`);
  return 0;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    process.exit(main(process.argv.slice(2), { cwd: process.cwd() }));
  } catch (err) {
    process.stderr.write(`${(err as Error).message}\n`);
    process.exit(1);
  }
}
