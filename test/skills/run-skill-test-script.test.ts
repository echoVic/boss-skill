import { describe, expect, it } from 'vitest';
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

const SCRIPT = path.resolve(import.meta.dirname, 'run-skill-test.sh');
const GOOD_TRANSCRIPT = path.resolve(import.meta.dirname, 'fixtures', 'claude-good.jsonl');
const BAD_TRANSCRIPT = path.resolve(import.meta.dirname, 'fixtures', 'codex-premature-action.jsonl');

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
        'pm/requirement-penetration'
      ],
      { encoding: 'utf8' }
    );

    expect(result.status, result.stderr).toBe(0);
    const payload = JSON.parse(result.stdout) as { id: string; passed: boolean };
    expect(payload).toMatchObject({ id: 'good', passed: true });
  });

  it('returns non-zero for premature action transcripts', () => {
    const result = spawnSync('bash', [SCRIPT, '--id', 'bad', '--transcript', BAD_TRANSCRIPT], {
      encoding: 'utf8'
    });

    expect(result.status).toBe(1);
    const payload = JSON.parse(result.stdout) as { passed: boolean; failures: string[] };
    expect(payload.passed).toBe(false);
    expect(payload.failures.join('\n')).toContain('apply_patch');
  });

  it('uses the repository-local vite-node runner', () => {
    const source = fs.readFileSync(SCRIPT, 'utf8');

    expect(source).toContain('node_modules/.bin/vite-node');
    expect(source).not.toContain('ts-node');
  });
});
