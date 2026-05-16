import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { detectPipelinePacks } from '../../packages/boss-cli/src/runtime/application/packs.js';
import { cleanupTempDir } from '../helpers/fixtures.js';

const REPO_ROOT = path.resolve(import.meta.dirname, '..', '..');
const BOSS_BIN = path.join(REPO_ROOT, 'packages', 'boss-cli', 'dist', 'bin', 'boss.js');

describe('boss packs detect', () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'boss-detect-pack-'));
  });

  afterEach(() => {
    cleanupTempDir(tmpDir);
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

  it('detects web-app for React/Vite projects and reports match evidence', () => {
    fs.writeFileSync(
      path.join(tmpDir, 'package.json'),
      JSON.stringify({
        name: 'web-app',
        dependencies: { react: '^19.0.0' },
        devDependencies: { vite: '^7.0.0' }
      }),
      'utf8'
    );
    fs.mkdirSync(path.join(tmpDir, 'src'), { recursive: true });
    fs.writeFileSync(path.join(tmpDir, 'vite.config.ts'), 'export default {};\n', 'utf8');

    const result = detectPipelinePacks(tmpDir);
    expect(result.detected.name).toBe('web-app');
    expect(result.detected.config.skipUI).toBe(false);
    expect(result.matched[0]).toEqual(
      expect.objectContaining({
        name: 'web-app',
        evidence: expect.arrayContaining([
          expect.objectContaining({ type: 'fileExists', value: 'package.json', matched: true }),
          expect.objectContaining({ type: 'packageJsonHas', value: 'react', matched: true })
        ])
      })
    );
  });

  it('packs detect CLI exposes detected pack evidence for orchestrators', () => {
    fs.writeFileSync(
      path.join(tmpDir, 'package.json'),
      JSON.stringify({ name: 'web-app', dependencies: { react: '^19.0.0' } }),
      'utf8'
    );

    const result = spawnSync(process.execPath, [BOSS_BIN, 'packs', 'detect', '--json', tmpDir], {
      encoding: 'utf8',
      cwd: REPO_ROOT
    });
    expect(result.status, result.stderr).toBe(0);
    const payload = JSON.parse(result.stdout) as {
      detected: string;
      detectedPack: { evidence: Array<{ type: string; value: string; matched: boolean }> };
    };

    expect(payload.detected).toBe('web-app');
    expect(payload.detectedPack.evidence).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ type: 'packageJsonHas', value: 'react', matched: true })
      ])
    );
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
