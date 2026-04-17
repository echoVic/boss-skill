import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const REPO_ROOT = path.resolve(import.meta.dirname, '..', '..');

describe('runtime check-stage and replay-events CLIs', () => {
  let tmpDir: string;
  let cwd: string;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'boss-check-replay-'));
    cwd = process.cwd();
    process.chdir(tmpDir);
  });

  afterEach(() => {
    process.chdir(cwd);
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  function runtimeCli(name: string) {
    return path.join(REPO_ROOT, 'dist', 'runtime', 'cli', `${name}.js`);
  }

  function runRuntimeCommand(name: string, args: string[]) {
    return spawnSync(process.execPath, [runtimeCli(name), ...args], {
      cwd: tmpDir,
      encoding: 'utf8'
    });
  }

  function expectSuccess(result: ReturnType<typeof spawnSync>, label: string) {
    expect(result.status, `${label} should exit 0\nstdout:\n${result.stdout}\nstderr:\n${result.stderr}`).toBe(0);
  }

  it('check-stage returns execution summary and stage JSON through runtime', () => {
    expectSuccess(runRuntimeCommand('init-pipeline', ['test-feat']), 'init-pipeline');
    expectSuccess(runRuntimeCommand('update-stage', ['test-feat', '1', 'running']), 'stage-running');
    expectSuccess(runRuntimeCommand('record-artifact', ['test-feat', 'prd.md', '1']), 'record-artifact');

    const summary = runRuntimeCommand('check-stage', ['test-feat', '--json']);
    expectSuccess(summary, 'check-stage summary');
    const summaryPayload = JSON.parse(summary.stdout) as {
      status: string;
      metrics: { retryTotal: number };
    };
    expect(summaryPayload.status).toBe('running');
    expect(summaryPayload.metrics.retryTotal).toBe(0);

    const stage = runRuntimeCommand('check-stage', ['test-feat', '1', '--json']);
    expectSuccess(stage, 'check-stage stage');
    const stagePayload = JSON.parse(stage.stdout) as {
      status: string;
      artifacts: string[];
    };
    expect(stagePayload.status).toBe('running');
    expect(stagePayload.artifacts).toEqual(['prd.md']);
  });

  it('replay-events returns recent events and snapshot-at-event through runtime', () => {
    expectSuccess(runRuntimeCommand('init-pipeline', ['test-feat']), 'init-pipeline');
    expectSuccess(runRuntimeCommand('update-stage', ['test-feat', '1', 'running']), 'stage-running');
    expectSuccess(runRuntimeCommand('record-artifact', ['test-feat', 'prd.md', '1']), 'record-artifact');
    expectSuccess(runRuntimeCommand('update-stage', ['test-feat', '1', 'completed']), 'stage-completed');

    const events = runRuntimeCommand('replay-events', ['test-feat', '--json', '--limit', '2']);
    expectSuccess(events, 'replay-events recent');
    const eventsPayload = JSON.parse(events.stdout) as { events: Array<{ type: string }> };
    expect(eventsPayload.events).toHaveLength(2);
    expect(eventsPayload.events[0].type).toBe('StageCompleted');

    const at = runRuntimeCommand('replay-events', ['test-feat', '--json', '--at', '3']);
    expectSuccess(at, 'replay-events at');
    const atPayload = JSON.parse(at.stdout) as {
      snapshot: {
        stages: Record<string, { status: string; artifacts: string[] }>;
      };
    };
    expect(atPayload.snapshot.stages['1'].status).toBe('running');
    expect(atPayload.snapshot.stages['1'].artifacts).toEqual(['prd.md']);
  });
});
