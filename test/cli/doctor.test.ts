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

function runDoctor(args: string[], cwd: string) {
  ensureBuilt('packages/boss-cli/dist/bin/boss.js');
  return spawnSync(process.execPath, [BOSS_BIN, 'doctor', ...args], { cwd, encoding: 'utf8' });
}

function initFeature(cwd: string, feature = 'demo') {
  ensureBuilt('packages/boss-cli/dist/bin/boss.js');
  const r = spawnSync(process.execPath, [BOSS_BIN, 'runtime', 'init-pipeline', feature, '--json'], {
    cwd,
    encoding: 'utf8',
  });
  expect(r.status, r.stderr).toBe(0);
}

afterEach(() => {
  if (tmpDir) {
    fs.rmSync(tmpDir, { recursive: true, force: true });
    tmpDir = null;
  }
});

describe('boss doctor', () => {
  it('reports ok/warn on a clean directory and exits 0', () => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'boss-doctor-'));
    const result = runDoctor(['--json'], tmpDir);
    expect(result.status).toBe(0);
    const report = JSON.parse(result.stdout) as {
      status: string;
      checks: Array<{ name: string; status: string }>;
    };
    expect(['ok', 'warn']).toContain(report.status);
    expect(report.checks.some((c) => c.name === 'version')).toBe(true);
    expect(report.checks.some((c) => c.name === 'features')).toBe(true);
  });

  it('reports runtime environment boundaries (node/platform/git)', () => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'boss-doctor-'));
    const report = JSON.parse(runDoctor(['--json'], tmpDir).stdout) as {
      checks: Array<{ name: string; status: string; detail: string }>;
    };
    expect(report.checks.some((c) => c.name === 'node')).toBe(true);
    expect(report.checks.some((c) => c.name === 'platform')).toBe(true);
    const git = report.checks.find((c) => c.name === 'git');
    expect(git).toBeDefined();
    // git 缺失不是错误，只影响可选的 WIP checkpoint —— 状态始终 ok
    expect(git?.status).toBe('ok');
  });

  it('reports an intact feature event stream as ok', () => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'boss-doctor-'));
    initFeature(tmpDir);
    const report = JSON.parse(runDoctor(['--json'], tmpDir).stdout) as {
      checks: Array<{ name: string; status: string; detail: string }>;
    };
    const feat = report.checks.find((c) => c.name === 'feature:demo');
    expect(feat?.status).toBe('ok');
    expect(feat?.detail).toContain('事件流完整');
  });

  it('warns (not errors) on a crash-corrupted trailing event line', () => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'boss-doctor-'));
    initFeature(tmpDir);
    fs.appendFileSync(
      path.join(tmpDir, '.boss', 'demo', '.meta', 'events.jsonl'),
      '{"broken',
      'utf8',
    );
    const result = runDoctor(['--json'], tmpDir);
    expect(result.status).toBe(0); // warn 不阻断
    const report = JSON.parse(result.stdout) as {
      status: string;
      checks: Array<{ name: string; status: string }>;
    };
    expect(report.status).toBe('warn');
    expect(report.checks.find((c) => c.name === 'feature:demo')?.status).toBe('warn');
  });

  it('errors (exit 1) on a corrupt non-trailing event line', () => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'boss-doctor-'));
    initFeature(tmpDir);
    const eventsFile = path.join(tmpDir, '.boss', 'demo', '.meta', 'events.jsonl');
    // 追加一条真实事件后，在中间插入损坏行，使其非末行
    const lines = fs.readFileSync(eventsFile, 'utf8').trim().split('\n');
    lines.push('{"type":"StageStarted","id":2,"timestamp":"2026-07-30T00:00:00Z","data":{}}');
    lines.splice(1, 0, '{corrupt}');
    fs.writeFileSync(eventsFile, lines.join('\n') + '\n', 'utf8');

    const result = runDoctor(['--json'], tmpDir);
    expect(result.status).toBe(1);
    const report = JSON.parse(result.stdout) as { status: string };
    expect(report.status).toBe('error');
  });

  it('exposes describe metadata', () => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'boss-doctor-'));
    const result = runDoctor(['--describe'], tmpDir);
    expect(result.status).toBe(0);
    const desc = JSON.parse(result.stdout) as { command: string };
    expect(desc.command).toBe('boss doctor');
  });
});
