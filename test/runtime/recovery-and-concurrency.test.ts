import { spawnSync } from 'node:child_process';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';

import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { readJsonlTolerant } from '../../packages/boss-cli/src/infrastructure/fs.js';
import * as runtime from '../../packages/boss-cli/src/runtime/application/pipeline.js';
import { ensureBuilt } from '../helpers/run-cli.js';

const BOSS_ENTRYPOINT = 'packages/boss-cli/dist/bin/boss.js';
const REPO_ROOT = path.resolve(import.meta.dirname, '..', '..');

/**
 * 「事件是真相源，execution.json 只是投影」必须有一条能走通的恢复路径。
 *
 * 此前没有任何命令能重建投影：投影一旦损坏（手工编辑、磁盘错误、写入中途被杀），
 * 事件流完好也没用——每条命令都先 readExecutionView，抛出裸 JSON 解析错误，
 * feature 从此不可用。38 个 runtime 子命令里 `replay-events` 只读、不重写。
 */
describe('a corrupt projection is recoverable from the event stream', () => {
  let tmpDir: string;
  const feature = 'recover-feat';

  function boss(args: string[]) {
    ensureBuilt(BOSS_ENTRYPOINT);
    return spawnSync(process.execPath, [path.join(REPO_ROOT, BOSS_ENTRYPOINT), ...args], {
      cwd: tmpDir,
      encoding: 'utf8',
    });
  }

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'boss-recover-'));
    runtime.initPipeline(feature, { cwd: tmpDir });
    runtime.updateStage(feature, 1, 'running', { cwd: tmpDir });
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  function corruptProjection(): void {
    fs.writeFileSync(
      path.join(tmpDir, '.boss', feature, '.meta', 'execution.json'),
      '{bad json',
      'utf8',
    );
  }

  it('points the caller at the rebuild command instead of a raw parse error', () => {
    corruptProjection();
    const result = boss(['status', feature, '--json']);
    const payload = JSON.parse(result.stderr) as { error: { code: string; suggestion: string } };

    expect(payload.error.code).toBe('state_unreadable');
    expect(payload.error.suggestion).toContain('rebuild-state');
  });

  it('rebuilds the projection from events', () => {
    corruptProjection();
    expect(boss(['runtime', 'rebuild-state', feature, '--json']).status).toBe(0);

    const rebuilt = JSON.parse(
      fs.readFileSync(path.join(tmpDir, '.boss', feature, '.meta', 'execution.json'), 'utf8'),
    ) as { status: string; stages: Record<string, { status: string }> };
    expect(rebuilt.status).toBe('running');
    expect(rebuilt.stages['1']?.status).toBe('running');
  });

  it('leaves the feature usable afterwards', () => {
    corruptProjection();
    boss(['runtime', 'rebuild-state', feature, '--json']);
    expect(boss(['status', feature, '--json']).status).toBe(0);
  });
});

/**
 * 并行子 Agent 各自跑 `boss runtime report-agent-status`，多个进程同时追加同一份
 * events.jsonl。一条都不能丢，事件流也不能变得不可读。
 */
describe('concurrent appenders lose no event', () => {
  let tmpDir: string;
  const feature = 'conc-feat';

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'boss-conc-'));
    runtime.initPipeline(feature, { cwd: tmpDir });
    runtime.updateStage(feature, 3, 'running', { cwd: tmpDir });
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it('keeps every record when several processes append at once', async () => {
    ensureBuilt(BOSS_ENTRYPOINT);
    const eventsFile = path.join(tmpDir, '.boss', feature, '.meta', 'events.jsonl');
    const before = readJsonlTolerant(eventsFile).records.length;
    const agents = ['boss-frontend', 'boss-backend', 'boss-qa', 'boss-devops'];

    await Promise.all(
      agents.map(
        (agent) =>
          new Promise<void>((resolve, reject) => {
            const child = spawnSync(
              process.execPath,
              [
                path.join(REPO_ROOT, BOSS_ENTRYPOINT),
                'runtime',
                'update-agent',
                feature,
                '3',
                agent,
                'running',
                '--json',
              ],
              { cwd: tmpDir, encoding: 'utf8' },
            );
            child.status === 0 ? resolve() : reject(new Error(child.stderr));
          }),
      ),
    );

    const after = readJsonlTolerant(eventsFile);
    expect(after.corruptLines).toEqual([]);
    expect(after.records.length).toBe(before + agents.length);
  });
});
