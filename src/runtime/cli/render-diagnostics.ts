#!/usr/bin/env node
import * as fs from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';

import { renderHtml } from '../report/render-html.js';
import { buildSummaryModel } from '../report/summary-model.js';
import { inspectEvents, inspectPipeline, inspectProgress } from './lib/inspection-runtime.js';

function printHelp(): void {
  process.stdout.write(
    [
      'Boss Harness - 诊断页生成',
      '',
      '用法: render-diagnostics.js <feature> [options]',
      '',
      '选项:',
      '  --stdout         输出到标准输出而非文件',
      '  -h, --help       查看帮助',
      ''
    ].join('\n')
  );
}

export function parseArgs(argv: string[]) {
  if (argv.length === 0 || argv.includes('-h') || argv.includes('--help')) {
    return { help: true } as const;
  }

  const parsed = { feature: '', stdout: false };
  for (const arg of argv) {
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

export function buildDiagnosticsModel(feature: string, { cwd = process.cwd() }: { cwd?: string } = {}) {
  const summary = buildSummaryModel(feature, { cwd });
  const inspection = inspectPipeline(feature, { cwd });
  let events: ReturnType<typeof inspectEvents>['events'] = [];
  let progress: ReturnType<typeof inspectProgress>['events'] = [];
  try {
    events = inspectEvents(feature, { cwd, limit: 8 }).events;
  } catch {
    events = [];
  }
  try {
    progress = inspectProgress(feature, { cwd, limit: 8 }).events;
  } catch {
    progress = [];
  }

  return {
    ...summary,
    currentStage: inspection.currentStage,
    readyArtifacts: inspection.readyArtifacts,
    activeAgents: inspection.activeAgents.map((item) => `${item.agent}@${item.stage}`),
    recentFailures: inspection.recentFailures,
    recentEvents: events,
    progressEvents: progress.map((event) => ({
      type: String(event.type || ''),
      timestamp: String(event.timestamp || '')
    }))
  };
}

export function main(argv: string[] = process.argv.slice(2), { cwd = process.cwd() }: { cwd?: string } = {}): number {
  const parsed = parseArgs(argv);
  if ('help' in parsed) {
    printHelp();
    return 0;
  }

  const model = buildDiagnosticsModel(parsed.feature, { cwd });
  const html = renderHtml(model);
  if (parsed.stdout) {
    process.stdout.write(html);
    return 0;
  }

  const outputPath = path.join(cwd, '.boss', parsed.feature, 'diagnostics.html');
  fs.writeFileSync(outputPath, html, 'utf8');
  process.stdout.write(`诊断页已生成: ${outputPath}\n`);
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
