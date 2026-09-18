import { spawnSync } from 'node:child_process';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';

import { ensureBuilt } from '../helpers/run-cli.js';

const BOSS_BIN = path.resolve(
  import.meta.dirname,
  '..',
  '..',
  'packages',
  'boss-cli',
  'dist',
  'bin',
  'boss.js',
);

let tmpDir: string | null = null;

function runCli(args: string[], { cwd }: { cwd?: string } = {}) {
  ensureBuilt('packages/boss-cli/dist/bin/boss.js');
  return spawnSync(process.execPath, [BOSS_BIN, ...args], {
    cwd: cwd ?? process.cwd(),
    encoding: 'utf8',
  });
}

function createWorkspace(): string {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'boss-report-status-'));
  const init = runCli(['runtime', 'init-pipeline', 'demo', '--json'], { cwd: dir });
  expect(init.status, init.stderr).toBe(0);
  tmpDir = dir;
  return dir;
}

function readAgent(cwd: string, stage: string, agent: string) {
  const execution = JSON.parse(
    fs.readFileSync(path.join(cwd, '.boss', 'demo', '.meta', 'execution.json'), 'utf8'),
  ) as {
    stages: Record<string, { agents?: Record<string, { status: string; failureReason?: string }> }>;
  };
  return execution.stages[stage]?.agents?.[agent];
}

afterEach(() => {
  if (tmpDir) {
    fs.rmSync(tmpDir, { recursive: true, force: true });
    tmpDir = null;
  }
});

describe('boss runtime report-agent-status', () => {
  it('exposes the allowed statuses through --describe', () => {
    const result = runCli(['runtime', 'report-agent-status', '--describe']);
    expect(result.status, result.stderr).toBe(0);

    const description = JSON.parse(result.stdout) as {
      parameters: { name: string; enum?: string[]; required?: boolean }[];
    };
    const status = description.parameters.find((param) => param.name === 'status');
    expect(status?.required).toBe(true);
    expect(status?.enum).toEqual([
      'DONE',
      'DONE_WITH_CONCERNS',
      'NEEDS_CONTEXT',
      'BLOCKED',
      'REVISION_NEEDED',
    ]);
  });

  it('maps DONE to a completed agent in the event stream', () => {
    const cwd = createWorkspace();
    const result = runCli(
      [
        'runtime',
        'report-agent-status',
        'demo',
        '1',
        'boss-pm',
        'DONE',
        '--reason',
        'prd ready',
        '--json',
      ],
      { cwd },
    );
    expect(result.status, result.stderr).toBe(0);
    expect(JSON.parse(result.stdout)).toMatchObject({
      reportedStatus: 'DONE',
      agentStatus: 'completed',
    });
    expect(readAgent(cwd, '1', 'boss-pm')?.status).toBe('completed');
  });

  it('treats DONE_WITH_CONCERNS as completed but keeps the reported status distinct', () => {
    const cwd = createWorkspace();
    const result = runCli(
      [
        'runtime',
        'report-agent-status',
        'demo',
        '1',
        'boss-pm',
        'DONE_WITH_CONCERNS',
        '--reason',
        'flaky test',
        '--json',
      ],
      { cwd },
    );
    expect(result.status, result.stderr).toBe(0);
    expect(JSON.parse(result.stdout)).toMatchObject({
      reportedStatus: 'DONE_WITH_CONCERNS',
      agentStatus: 'completed',
    });
  });

  it.each(['NEEDS_CONTEXT', 'BLOCKED', 'REVISION_NEEDED'])(
    'maps %s to a failed agent and records the reason',
    (status) => {
      const cwd = createWorkspace();
      const result = runCli(
        [
          'runtime',
          'report-agent-status',
          'demo',
          '1',
          'boss-pm',
          status,
          '--reason',
          'needs schema',
          '--json',
        ],
        { cwd },
      );
      expect(result.status, result.stderr).toBe(0);
      expect(JSON.parse(result.stdout)).toMatchObject({
        reportedStatus: status,
        agentStatus: 'failed',
      });

      const agent = readAgent(cwd, '1', 'boss-pm');
      expect(agent?.status).toBe('failed');
      expect(agent?.failureReason).toBe('needs schema');
    },
  );

  it('rejects an unknown status with a retryable structured error', () => {
    const cwd = createWorkspace();
    const result = runCli(
      ['runtime', 'report-agent-status', 'demo', '1', 'boss-pm', 'ALL_GOOD', '--json'],
      { cwd },
    );
    expect(result.status).not.toBe(0);

    const payload = JSON.parse(result.stderr) as {
      error: { code: string; retryable: boolean; suggestion: string; input: { allowed: string[] } };
    };
    expect(payload.error.code).toBe('invalid_agent_status');
    expect(payload.error.retryable).toBe(true);
    expect(payload.error.input.allowed).toContain('DONE');
    expect(payload.error.suggestion).toContain('DONE_WITH_CONCERNS');

    // 非法上报不得写入事件流
    expect(readAgent(cwd, '1', 'boss-pm')).toBeUndefined();
  });

  it('is case sensitive so lowercase variants are rejected rather than coerced', () => {
    const cwd = createWorkspace();
    const result = runCli(
      ['runtime', 'report-agent-status', 'demo', '1', 'boss-pm', 'done', '--json'],
      { cwd },
    );
    expect(result.status).not.toBe(0);
    expect(result.stderr).toContain('invalid_agent_status');
  });

  it('plans without mutating state under --dry-run', () => {
    const cwd = createWorkspace();
    const result = runCli(
      ['runtime', 'report-agent-status', 'demo', '1', 'boss-pm', 'DONE', '--dry-run', '--json'],
      { cwd },
    );
    expect(result.status, result.stderr).toBe(0);

    const plan = JSON.parse(result.stdout) as {
      actions: { type: string; reported_status: string; target_status: string }[];
    };
    expect(plan.actions[0]).toMatchObject({
      type: 'report_agent_status',
      reported_status: 'DONE',
      target_status: 'completed',
    });
    expect(readAgent(cwd, '1', 'boss-pm')).toBeUndefined();
  });

  it('accepts a JSON input payload', () => {
    const cwd = createWorkspace();
    const result = runCli(
      [
        'runtime',
        'report-agent-status',
        '--json-input',
        JSON.stringify({
          feature: 'demo',
          stage: '1',
          agent: 'boss-pm',
          status: 'DONE',
          reason: 'via json',
        }),
        '--json',
      ],
      { cwd },
    );
    expect(result.status, result.stderr).toBe(0);
    expect(JSON.parse(result.stdout)).toMatchObject({ agentStatus: 'completed' });
  });
});
