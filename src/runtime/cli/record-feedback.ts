#!/usr/bin/env node
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';

import { recordFeedback } from './lib/pipeline-runtime.js';

function showHelp(): void {
  process.stderr.write(
    [
      'Boss Harness - 反馈循环记录',
      '',
      '用法: record-feedback.js <feature> --from <agent> --to <agent> --artifact <name> --reason <text>',
      '',
      '选项:',
      '  --from       发起修订的 Agent 名称',
      '  --to         需要修订的目标 Agent',
      '  --artifact   需要修订的产物名称',
      '  --reason     修订原因',
      '  --priority   优先级（critical | recommended，默认 recommended）',
      ''
    ].join('\n')
  );
}

export function main(argv: string[] = process.argv.slice(2), { cwd = process.cwd() }: { cwd?: string } = {}): number {
  let feature = '', from = '', to = '', artifact = '', reason = '', priority = 'recommended';
  const args = [...argv];
  while (args.length > 0) {
    const arg = args.shift()!;
    switch (arg) {
      case '-h': case '--help': showHelp(); return 0;
      case '--from': from = args.shift() ?? ''; break;
      case '--to': to = args.shift() ?? ''; break;
      case '--artifact': artifact = args.shift() ?? ''; break;
      case '--reason': reason = args.shift() ?? ''; break;
      case '--priority': priority = args.shift() ?? 'recommended'; break;
      default: if (!feature) feature = arg; break;
    }
  }
  if (!feature || !from || !to || !artifact || !reason) { showHelp(); return 1; }
  try {
    const state = recordFeedback(feature, { from, to, artifact, reason, priority, cwd });
    const fl = (state as any).feedbackLoops || {};
    process.stdout.write(JSON.stringify({ feature, round: fl.currentRound, maxRounds: fl.maxRounds }) + '\n');
    return 0;
  } catch (err) {
    process.stderr.write(`${(err as Error).message}\n`);
    return 1;
  }
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  process.exit(main());
}
