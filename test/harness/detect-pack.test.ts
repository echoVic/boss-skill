import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { detectPipelinePacks } from '../../packages/boss-cli/src/runtime/application/pack-runtime.js';

const REPO_ROOT = path.resolve(import.meta.dirname, '..', '..');
const BOSS_BIN = path.join(REPO_ROOT, 'packages', 'boss-cli', 'dist', 'bin', 'boss.js');

describe('boss packs detect', () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'boss-detect-pack-'));
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  function run(projectDir: string, extraArgs: string[] = []) {
    const result = spawnSync(process.execPath, [BOSS_BIN, 'packs', 'detect', ...extraArgs, projectDir], {
      encoding: 'utf8',
      cwd: REPO_ROOT
    });
    expect(result.status, result.stderr).toBe(0);
    const parsed = JSON.parse(result.stdout) as { detected: string; matched: unknown[] };
    return parsed;
  }

  it('returns "default" when no pack matches', () => {
    expect(run(tmpDir).detected).toBe('default');
  });

  it('detects solana-contract when Anchor.toml exists', () => {
    fs.writeFileSync(path.join(tmpDir, 'Anchor.toml'), '[programs]\n', 'utf8');
    expect(run(tmpDir).detected).toBe('solana-contract');
  });

  it('detects api-only when package.json exists but no frontend dirs', () => {
    fs.writeFileSync(path.join(tmpDir, 'package.json'), '{"name":"test","dependencies":{}}', 'utf8');
    expect(run(tmpDir).detected).toBe('api-only');
  });

  it('uses .boss pipeline pack overrides before built-in packs', () => {
    fs.writeFileSync(path.join(tmpDir, 'package.json'), '{"name":"test"}', 'utf8');
    const packDir = path.join(tmpDir, '.boss', 'pipeline-packs', 'api-only');
    fs.mkdirSync(packDir, { recursive: true });
    fs.writeFileSync(
      path.join(packDir, 'pipeline.json'),
      JSON.stringify({
        name: 'api-only',
        version: '9.9.9',
        type: 'pipeline-pack',
        when: { fileExists: ['custom-api.marker'] },
        priority: 99,
        config: { stages: [1], agents: ['boss-pm'], gates: [] },
        enabled: true
      }),
      'utf8'
    );
    fs.writeFileSync(path.join(tmpDir, 'custom-api.marker'), '', 'utf8');

    const result = detectPipelinePacks(tmpDir);
    expect(result.detected.name).toBe('api-only');
    expect(result.detected.version).toBe('9.9.9');
    expect(result.detected.config.stages).toEqual([1]);
    expect(result.detected.config.agents).toEqual(['boss-pm']);
  });

  it('does not detect api-only when src/app exists', () => {
    fs.writeFileSync(path.join(tmpDir, 'package.json'), '{"name":"test"}', 'utf8');
    fs.mkdirSync(path.join(tmpDir, 'src', 'app'), { recursive: true });
    expect(run(tmpDir).detected).toBe('default');
  });

  it('prefers higher priority pack (solana-contract > api-only)', () => {
    fs.writeFileSync(path.join(tmpDir, 'Anchor.toml'), '[programs]\n', 'utf8');
    fs.writeFileSync(path.join(tmpDir, 'package.json'), '{"name":"test"}', 'utf8');
    expect(run(tmpDir).detected).toBe('solana-contract');
  });

  it('returns JSON when --json flag is used', () => {
    const parsed = run(tmpDir, ['--json']);

    expect(parsed.detected).toBe('default');
    expect(Array.isArray(parsed.matched)).toBe(true);
  });
});
