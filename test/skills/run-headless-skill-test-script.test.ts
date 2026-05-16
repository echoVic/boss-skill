import { describe, expect, it } from 'vitest';
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

const SCRIPT = path.resolve(import.meta.dirname, 'run-headless-skill-test.sh');

describe('Boss headless skill behavior script', () => {
  it('prints usage and exits non-zero without required args', () => {
    const result = spawnSync('bash', [SCRIPT], { encoding: 'utf8' });

    expect(result.status).toBe(1);
    expect(result.stderr).toContain('Usage:');
    expect(result.stderr).toContain('--prompt');
  });

  it('documents that real Claude execution is opt-in', () => {
    const result = spawnSync('bash', [SCRIPT, '--help'], { encoding: 'utf8' });

    expect(result.status).toBe(0);
    expect(result.stdout).toContain('requires the `claude` CLI');
    expect(result.stdout).toContain('not used by default CI');
  });

  it('uses Claude headless mode and evaluates the generated transcript with the deterministic runner', () => {
    const source = fs.readFileSync(SCRIPT, 'utf8');

    expect(source).toContain('command -v claude');
    expect(source).toContain('claude -p "$PROMPT"');
    expect(source).toContain('--allowed-tools=all');
    expect(source).toContain('--permission-mode bypassPermissions');
    expect(source).toContain('run-skill-test.sh');
    expect(source).toContain('--transcript "$SESSION_FILE"');
  });
});
