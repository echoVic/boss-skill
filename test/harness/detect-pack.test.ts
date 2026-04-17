import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { execSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const SCRIPT_PATH = path.join(import.meta.dirname, '..', '..', 'scripts', 'harness', 'detect-pack.sh');

function getCommandOutput(error: unknown) {
  const execError = error as Error & { stdout?: string };
  return execError.stdout ? String(execError.stdout).trim() : '';
}

describe('detect-pack.sh', () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'boss-detect-pack-'));
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  function run(projectDir: string, extraArgs = '') {
    try {
      return execSync(`bash "${SCRIPT_PATH}" ${extraArgs} "${projectDir}"`, {
        encoding: 'utf8',
        env: { ...process.env, PATH: process.env.PATH }
      }).trim();
    } catch (error) {
      return getCommandOutput(error);
    }
  }

  it('returns "default" when no pack matches', () => {
    expect(run(tmpDir)).toBe('default');
  });

  it('detects solana-contract when Anchor.toml exists', () => {
    fs.writeFileSync(path.join(tmpDir, 'Anchor.toml'), '[programs]\n', 'utf8');
    expect(run(tmpDir)).toBe('solana-contract');
  });

  it('detects api-only when package.json exists but no frontend dirs', () => {
    fs.writeFileSync(path.join(tmpDir, 'package.json'), '{"name":"test","dependencies":{}}', 'utf8');
    expect(run(tmpDir)).toBe('api-only');
  });

  it('does not detect api-only when src/app exists', () => {
    fs.writeFileSync(path.join(tmpDir, 'package.json'), '{"name":"test"}', 'utf8');
    fs.mkdirSync(path.join(tmpDir, 'src', 'app'), { recursive: true });
    expect(run(tmpDir)).toBe('default');
  });

  it('prefers higher priority pack (solana-contract > api-only)', () => {
    fs.writeFileSync(path.join(tmpDir, 'Anchor.toml'), '[programs]\n', 'utf8');
    fs.writeFileSync(path.join(tmpDir, 'package.json'), '{"name":"test"}', 'utf8');
    expect(run(tmpDir)).toBe('solana-contract');
  });

  it('returns JSON when --json flag is used', () => {
    const parsed = JSON.parse(run(tmpDir, '--json')) as {
      detected: string;
      matched: unknown[];
    };

    expect(parsed.detected).toBe('default');
    expect(Array.isArray(parsed.matched)).toBe(true);
  });
});
