import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

const REPO_ROOT = path.resolve(import.meta.dirname, '..', '..');
const RELEASE_SCRIPT = path.join(REPO_ROOT, 'scripts', 'release.js');

describe('release script contract', () => {
  it('syncs every public release version owner', () => {
    const source = fs.readFileSync(RELEASE_SCRIPT, 'utf8');
    for (const expectedPath of [
      'package.json',
      'packages/boss-cli/package.json',
      '.claude-plugin/plugin.json',
      '.claude-plugin/marketplace.json',
      'skill/SKILL.md'
    ]) {
      expect(source).toContain(`path: '${expectedPath}'`);
    }
  });

  it('runs the full verification chain before npm publish', () => {
    const source = fs.readFileSync(RELEASE_SCRIPT, 'utf8');
    const buildIndex = source.indexOf("run('npm run build')");
    const typecheckIndex = source.indexOf("run('npm run typecheck')");
    const testIndex = source.indexOf("run('npm test')");
    const installMatrixIndex = source.indexOf("run('npm run test:install-matrix')");
    const packIndex = source.indexOf("run('npm pack --dry-run')");
    const publishIndex = source.indexOf("run('npm publish')");

    expect(buildIndex).toBeGreaterThan(-1);
    expect(typecheckIndex).toBeGreaterThan(buildIndex);
    expect(testIndex).toBeGreaterThan(typecheckIndex);
    expect(installMatrixIndex).toBeGreaterThan(testIndex);
    expect(packIndex).toBeGreaterThan(installMatrixIndex);
    expect(publishIndex).toBeGreaterThan(packIndex);
  });

  it('commits only source release metadata and never commits generated dist', () => {
    const source = fs.readFileSync(RELEASE_SCRIPT, 'utf8');
    const gitAddLine = source
      .split('\n')
      .find((line) => line.includes('git add') && line.includes('VERSION_FILES'));

    expect(gitAddLine).toBeTruthy();
    expect(source).not.toMatch(/git add[^'\n]*packages\/boss-cli\/dist/);
  });

  it('validates versions using structured readers instead of substring matching', () => {
    const source = fs.readFileSync(RELEASE_SCRIPT, 'utf8');
    expect(source).toContain('function verifyVersionFile');
    expect(source).not.toContain('content.includes(next)');
  });
});
