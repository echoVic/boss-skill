#!/usr/bin/env node
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  getArtifactStatus,
  getReadyArtifacts,
  listArtifactStatuses
} from './lib/pipeline-runtime.js';

function showHelp(): void {
  process.stdout.write(`Boss Harness - Artifact DAG 检查

用法: get-ready-artifacts.js <feature> <artifact> [options]

检查指定产物在 DAG 中的就绪状态。

参数:
  feature     功能名称
  artifact    产物名称（如 prd.md、architecture.md、code）

选项:
  --can-start       检查该产物的所有输入依赖是否已就绪
  --ready           列出所有当前可以开始的产物
  --dag <path>      指定 DAG 文件路径（默认 harness/artifact-dag.json）
  --json            JSON 格式输出

示例:
  get-ready-artifacts.js my-feature --ready --json
  get-ready-artifacts.js my-feature architecture.md --can-start
`);
}

function exitError(message: string): never {
  throw new Error(message);
}

export function main(argv: string[] = process.argv.slice(2), { cwd = process.cwd() }: { cwd?: string } = {}): number {
  if (argv.length === 0 || argv.includes('-h') || argv.includes('--help')) {
    showHelp();
    return argv.length === 0 ? 1 : 0;
  }

  let feature = '';
  let artifact = '';
  let canStart = false;
  let ready = false;
  let dagPath = '';
  let jsonOutput = false;

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i]!;
    if (arg === '--can-start') {
      canStart = true;
      continue;
    }
    if (arg === '--ready') {
      ready = true;
      continue;
    }
    if (arg === '--dag') {
      const nextValue = argv[i + 1];
      if (!nextValue || nextValue.startsWith('-')) {
        exitError('--dag 需要指定 path');
      }
      dagPath = nextValue;
      i += 1;
      continue;
    }
    if (arg === '--json') {
      jsonOutput = true;
      continue;
    }
    if (arg.startsWith('-')) {
      exitError(`未知选项: ${arg}`);
    }
    if (!feature) {
      feature = arg;
    } else if (!artifact) {
      artifact = arg;
    } else {
      exitError(`多余的参数: ${arg}`);
    }
  }

  if (!feature) {
    exitError('缺少 feature 参数');
  }

  try {
    if (canStart) {
      if (!artifact) {
        exitError('--can-start 需要指定 artifact');
      }
      const status = getArtifactStatus(feature, artifact, {
        cwd,
        dagPath,
        ignoreSkipped: true
      });
      if (status.status === 'completed') {
        process.stdout.write(`${artifact} 已完成\n`);
        return 0;
      }
      if (status.status === 'ready') {
        process.stdout.write(`${artifact} 可以开始（所有依赖已就绪）\n`);
        return 0;
      }
      if (status.status === 'blocked') {
        process.stderr.write(`${artifact} 不能开始，缺少依赖:${status.missing!.join(' ')}\n`);
        return 1;
      }
      process.stderr.write(`${artifact} 不能开始\n`);
      return 1;
    }

    if (ready) {
      const readyList = getReadyArtifacts(feature, { cwd, dagPath });
      if (readyList.length === 0) {
        process.stdout.write(jsonOutput ? '[]\n' : '没有就绪的产物\n');
        return 0;
      }
      if (jsonOutput) {
        process.stdout.write(`${JSON.stringify(readyList.map((item) => item.artifact))}\n`);
        return 0;
      }
      process.stdout.write('就绪的产物：\n');
      for (const item of readyList) {
        process.stdout.write(`  ✅ ${item.artifact} (Agent: ${item.agent}, 阶段: ${item.stage})\n`);
      }
      return 0;
    }

    if (artifact) {
      const status = getArtifactStatus(feature, artifact, { cwd, dagPath });
      if (status.status === 'completed') {
        process.stdout.write(`${artifact}: completed\n`);
      } else if (status.status === 'skipped') {
        process.stdout.write(`${artifact}: skipped\n`);
      } else {
        process.stdout.write(`${artifact}: pending\n`);
      }
      return 0;
    }

    const statuses = listArtifactStatuses(feature, { cwd, dagPath });
    for (const { artifact: name, status } of statuses) {
      if (status === 'completed') {
        process.stdout.write(`  ✅ ${name}\n`);
      } else if (status === 'skipped') {
        process.stdout.write(`  ⏭️  ${name} (skipped)\n`);
      } else {
        process.stdout.write(`  ⏳ ${name}\n`);
      }
    }
    return 0;
  } catch (err) {
    process.stderr.write(`${(err as Error).message}\n`);
    return 1;
  }
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  process.exit(main(process.argv.slice(2), { cwd: process.cwd() }));
}
