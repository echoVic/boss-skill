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

function runCli(args: string[], cwd: string) {
  ensureBuilt('packages/boss-cli/dist/bin/boss.js');
  return spawnSync(process.execPath, [BOSS_BIN, ...args], { cwd, encoding: 'utf8' });
}

function createWorkspace(): string {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'boss-user-choice-'));
  const init = runCli(['runtime', 'init-pipeline', 'demo', '--json'], dir);
  expect(init.status, init.stderr).toBe(0);
  tmpDir = dir;
  return dir;
}

function preferences(cwd: string) {
  const payload = JSON.parse(
    fs.readFileSync(path.join(cwd, '.boss', 'demo', '.meta', 'feature-memory.json'), 'utf8'),
  ) as {
    records: Array<{
      influence?: string;
      category: string;
      tags: string[];
      confidence: number;
      evidence: unknown[];
    }>;
  };
  return payload.records.filter((r) => r.influence === 'preference');
}

afterEach(() => {
  if (tmpDir) {
    fs.rmSync(tmpDir, { recursive: true, force: true });
    tmpDir = null;
  }
});

describe('boss runtime record-user-choice', () => {
  it('emits UserChoiceRecorded into the event stream', () => {
    const cwd = createWorkspace();
    const result = runCli(
      [
        'runtime',
        'record-user-choice',
        'demo',
        '--choice-type',
        'design-variant',
        '--selected',
        '方案A',
        '--json',
      ],
      cwd,
    );
    expect(result.status, result.stderr).toBe(0);

    const events = fs
      .readFileSync(path.join(cwd, '.boss', 'demo', '.meta', 'events.jsonl'), 'utf8')
      .trim()
      .split('\n')
      .map((line) => JSON.parse(line) as { type: string; data?: Record<string, unknown> });
    const choice = events.find((e) => e.type === 'UserChoiceRecorded');
    expect(choice?.data?.selected).toBe('方案A');
  });

  it('projects the choice into a deterministic preference memory record', () => {
    const cwd = createWorkspace();
    runCli(
      [
        'runtime',
        'record-user-choice',
        'demo',
        '--choice-type',
        'design-variant',
        '--selected',
        '方案A',
        '--json',
      ],
      cwd,
    );

    const prefs = preferences(cwd);
    expect(prefs).toHaveLength(1);
    expect(prefs[0]!.category).toBe('design-style');
    expect(prefs[0]!.confidence).toBeCloseTo(0.5);
  });

  it('rebuild is a full replay: repeated choices do not accumulate evidence beyond the event count', () => {
    const cwd = createWorkspace();
    // 两次相同选择 → 每次都触发一次 refreshMemory（全量重放）
    runCli(
      [
        'runtime',
        'record-user-choice',
        'demo',
        '--choice-type',
        'design-variant',
        '--selected',
        '方案A',
        '--json',
      ],
      cwd,
    );
    runCli(
      [
        'runtime',
        'record-user-choice',
        'demo',
        '--choice-type',
        'design-variant',
        '--selected',
        '方案A',
        '--json',
      ],
      cwd,
    );

    const prefs = preferences(cwd);
    expect(prefs).toHaveLength(1);
    // 关键回归：evidence 恰好等于事件数 2，而不是被 merge 路径累积成更多
    expect(prefs[0]!.evidence).toHaveLength(2);
    expect(prefs[0]!.confidence).toBeCloseTo(0.7);
  });

  it('rejects a missing required flag', () => {
    const cwd = createWorkspace();
    const result = runCli(
      ['runtime', 'record-user-choice', 'demo', '--selected', '方案A', '--json'],
      cwd,
    );
    expect(result.status).not.toBe(0);
  });

  it('exposes options through --describe', () => {
    const result = runCli(['runtime', 'record-user-choice', '--describe'], process.cwd());
    expect(result.status, result.stderr).toBe(0);
    const description = JSON.parse(result.stdout) as { options: { name: string }[] };
    const names = description.options.map((o) => o.name);
    expect(names).toContain('choice-type');
    expect(names).toContain('selected');
  });
});
