import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';

import { enqueueKnowledgeJob } from '../knowledge/jobs.js';

type SpawnFn = (
  command: string,
  args: string[],
  options: { cwd: string; detached: true; stdio: 'ignore' }
) => { unref: () => void };

export interface StartKnowledgeWorkerResult {
  started: boolean;
  error?: string;
}

export function startKnowledgeWorker(
  feature: string,
  {
    cwd = process.cwd(),
    spawn: spawnFn = spawn as SpawnFn
  }: { cwd?: string; spawn?: SpawnFn } = {}
): StartKnowledgeWorkerResult {
  try {
    const workerPath = fileURLToPath(new URL('../knowledge/worker.js', import.meta.url));
    const child = spawnFn(process.execPath, [workerPath, feature], {
      cwd,
      detached: true,
      stdio: 'ignore'
    });
    child.unref();
    return { started: true };
  } catch (err) {
    return { started: false, error: (err as Error).message };
  }
}

export function refreshKnowledge(feature: string, cwd: string): void {
  try {
    enqueueKnowledgeJob(
      feature,
      {
        sources: [{ type: 'runtime-events', ref: `.boss/${feature}/.meta/events.jsonl` }]
      },
      { cwd }
    );
    startKnowledgeWorker(feature, { cwd });
  } catch (err) {
    process.stderr.write(`[boss-skill] knowledge refresh skipped: ${(err as Error).message}\n`);
  }
}
