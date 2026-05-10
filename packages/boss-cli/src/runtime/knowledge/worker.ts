import * as fs from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';

import { createDefaultKnowledgeClient } from './client.js';
import { processKnowledgeJobs } from './jobs.js';

const STALE_LOCK_MS = 5 * 60 * 1000;

function knowledgeWorkerLockPath(cwd: string, feature: string): string {
  return path.join(cwd, '.boss', feature, '.meta', 'knowledge-worker.lock');
}

function isProcessAlive(pid: number): boolean {
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
}

function acquireWorkerLock(lockPath: string): number | null {
  fs.mkdirSync(path.dirname(lockPath), { recursive: true });

  for (let attempt = 0; attempt < 2; attempt += 1) {
    try {
      return fs.openSync(lockPath, 'wx');
    } catch (err) {
      if ((err as NodeJS.ErrnoException).code !== 'EEXIST') {
        throw err;
      }

      try {
        const raw = fs.readFileSync(lockPath, 'utf8');
        const [pidText] = raw.trim().split('\n');
        const pid = Number(pidText);
        const alive = Number.isInteger(pid) && pid > 0 && isProcessAlive(pid);
        if (alive) {
          return null;
        }

        const stat = fs.statSync(lockPath);
        const stale = Date.now() - stat.mtimeMs >= STALE_LOCK_MS;
        if (!raw.trim()) {
          if (stale) {
            fs.unlinkSync(lockPath);
            continue;
          }
          return null;
        }

        if (stale) {
          fs.unlinkSync(lockPath);
          continue;
        }

        return null;
      } catch {
        try {
          fs.unlinkSync(lockPath);
          continue;
        } catch {
          return null;
        }
      }

      return null;
    }
  }

  return null;
}

function writeLockMetadata(lockFd: number): void {
  fs.writeFileSync(lockFd, `${process.pid}\n${new Date().toISOString()}\n`, 'utf8');
}

function refreshWorkerLock(lockPath: string): void {
  try {
    fs.writeFileSync(lockPath, `${process.pid}\n${new Date().toISOString()}\n`, 'utf8');
  } catch {
    // best effort heartbeat
  }
}

function releaseWorkerLock(lockPath: string, lockFd: number | null): void {
  if (lockFd === null) return;
  try {
    fs.closeSync(lockFd);
  } catch {
    // ignore
  }
  try {
    fs.unlinkSync(lockPath);
  } catch {
    // ignore
  }
}

export async function main(
  feature: string,
  { cwd = process.cwd() }: { cwd?: string } = {}
): Promise<number> {
  if (!feature) {
    return 1;
  }

  const lockPath = knowledgeWorkerLockPath(cwd, feature);
  const lockFd = acquireWorkerLock(lockPath);
  if (lockFd === null) {
    return 0;
  }

  try {
    writeLockMetadata(lockFd);
    refreshWorkerLock(lockPath);
    await processKnowledgeJobs(feature, {
      cwd,
      client: createDefaultKnowledgeClient() ?? undefined
    });
    return 0;
  } finally {
    releaseWorkerLock(lockPath, lockFd);
  }
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const feature = process.argv[2] ?? '';
  const cwd = process.cwd();
  const code = await main(feature, { cwd });
  process.exit(code);
}
