import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const ROOT = path.resolve(import.meta.dirname, '..', '..');
const SCRIPT = path.resolve(import.meta.dirname, 'run-skill-test.sh');
const GOOD_TRANSCRIPT = path.resolve(import.meta.dirname, 'fixtures', 'claude-good.jsonl');
const BAD_TRANSCRIPT = path.resolve(
  import.meta.dirname,
  'fixtures',
  'codex-premature-action.jsonl',
);

describe('Boss skill behavior shell runner', () => {
  it('prints usage and exits non-zero without arguments', () => {
    const result = spawnSync('bash', [SCRIPT], { encoding: 'utf8' });

    expect(result.status).toBe(1);
    expect(result.stderr).toContain('Usage:');
    expect(result.stderr).toContain('--transcript');
  });

  it('evaluates a passing transcript as JSON', () => {
    const result = spawnSync(
      'bash',
      [
        SCRIPT,
        '--id',
        'good',
        '--transcript',
        GOOD_TRANSCRIPT,
        '--methodology',
        'pm/requirement-penetration',
      ],
      { encoding: 'utf8' },
    );

    expect(result.status, result.stderr).toBe(0);
    const payload = JSON.parse(result.stdout) as { id: string; passed: boolean };
    expect(payload).toMatchObject({ id: 'good', passed: true });
  });

  it('returns non-zero for premature action transcripts', () => {
    const result = spawnSync('bash', [SCRIPT, '--id', 'bad', '--transcript', BAD_TRANSCRIPT], {
      encoding: 'utf8',
    });

    expect(result.status).toBe(1);
    const payload = JSON.parse(result.stdout) as { passed: boolean; failures: string[] };
    expect(payload.passed).toBe(false);
    expect(payload.failures.join('\n')).toContain('apply_patch');
  });

  it('evaluates a transcript when invoked through a symlinked checkout path', () => {
    const linkRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'boss-skill-symlink-'));
    const repoLink = path.join(linkRoot, 'repo');
    fs.symlinkSync(ROOT, repoLink, 'dir');
    try {
      const result = spawnSync(
        'bash',
        [
          path.join(repoLink, 'test', 'skills', 'run-skill-test.sh'),
          '--id',
          'good',
          '--transcript',
          GOOD_TRANSCRIPT,
        ],
        { encoding: 'utf8' },
      );

      expect(result.status, result.stderr).toBe(0);
      const payload = JSON.parse(result.stdout) as { id: string; passed: boolean };
      expect(payload).toMatchObject({ id: 'good', passed: true });
    } finally {
      fs.unlinkSync(repoLink);
      fs.rmSync(linkRoot, { recursive: true, force: true });
    }
  });

  it('uses the repository-local tsx runner', () => {
    const source = fs.readFileSync(SCRIPT, 'utf8');

    expect(source).toContain('node_modules/.bin/tsx');
    expect(source).toContain('skill-test-runner.ts');
    expect(source).not.toContain('vite-node');
    expect(source).not.toContain('ts-node');
  });
});
