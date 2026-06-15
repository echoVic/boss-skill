import { describe, expect, it } from 'vitest';
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

const SCRIPT = path.resolve(import.meta.dirname, 'run-evals.sh');
const README = path.resolve(import.meta.dirname, 'README.md');
const BAD_CASE = path.resolve(import.meta.dirname, 'fixtures', 'missing-qa', 'case.json');

describe('Boss eval shell runner', () => {
  it('prints usage for help', () => {
    const result = spawnSync('bash', [SCRIPT, '--help'], { encoding: 'utf8' });

    expect(result.status).toBe(0);
    expect(result.stdout).toContain('Usage:');
    expect(result.stdout).toContain('does not launch a real agent');
    expect(result.stdout).toContain('--smoke');
    expect(result.stdout).toContain('--release');
  });

  it('runs the default smoke eval and prints JSON', () => {
    const result = spawnSync('bash', [SCRIPT], { encoding: 'utf8' });

    expect(result.status, result.stderr).toBe(0);
    const payload = JSON.parse(result.stdout) as { passed: boolean; reports: Array<{ id: string }> };
    expect(payload.passed).toBe(true);
    expect(payload.reports[0].id).toBe('smoke-success');
  });

  it('runs the explicit smoke eval set', () => {
    const result = spawnSync('bash', [SCRIPT, '--smoke'], { encoding: 'utf8' });

    expect(result.status, result.stderr).toBe(0);
    const payload = JSON.parse(result.stdout) as { passed: boolean; reports: Array<{ id: string }> };
    expect(payload.passed).toBe(true);
    expect(payload.reports.map((report) => report.id)).toEqual(['smoke-success']);
  });

  it('runs the deterministic release eval set', () => {
    const result = spawnSync('bash', [SCRIPT, '--release'], { encoding: 'utf8' });

    expect(result.status, result.stderr).toBe(0);
    const payload = JSON.parse(result.stdout) as { passed: boolean; reports: Array<{ id: string }> };
    expect(payload.passed).toBe(true);
    expect(payload.reports.map((report) => report.id)).toEqual(['release-evidence', 'pipeline-compliance']);
  });

  it('returns non-zero when an eval case fails deterministic checks', () => {
    const result = spawnSync('bash', [SCRIPT, '--case', BAD_CASE], { encoding: 'utf8' });

    expect(result.status).toBe(1);
    const payload = JSON.parse(result.stdout) as { passed: boolean; reports: Array<{ failures: string[] }> };
    expect(payload.passed).toBe(false);
    expect(payload.reports[0].failures).toContain('missing artifact: qa-report.md');
  });

  it('uses repository-local vite-node and the deterministic eval runner', () => {
    const source = fs.readFileSync(SCRIPT, 'utf8');

    expect(source).toContain('node_modules/.bin/vite-node');
    expect(source).toContain('eval-runner.ts');
    expect(source).not.toContain('claude');
  });

  it('documents deterministic eval usage and case format', () => {
    const readme = fs.readFileSync(README, 'utf8');

    expect(readme).toContain('npm run evals');
    expect(readme).toContain('--smoke');
    expect(readme).toContain('--release');
    expect(readme).toContain('pipeline-compliance');
    expect(readme).toContain('uses-runtime-cli');
    expect(readme).toContain('does not launch a');
    expect(readme).toContain('case.json');
    expect(readme).toContain('transcript.jsonl');
  });
});
