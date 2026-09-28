import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

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
      'skill/SKILL.md',
    ]) {
      expect(source).toContain(`path: '${expectedPath}'`);
    }
  });

  it('runs the full verification chain and rebuilds the bundled skill CLI', () => {
    const source = fs.readFileSync(RELEASE_SCRIPT, 'utf8');
    const buildIndex = source.indexOf("run('npm run build:skill')");
    const typecheckIndex = source.indexOf("run('npm run typecheck')");
    const testIndex = source.indexOf("run('npm test')");
    const installMatrixIndex = source.indexOf("run('npm run test:install-matrix')");
    const bundleCheckIndex = source.indexOf('skill/cli/bin/boss.js --version');

    expect(buildIndex).toBeGreaterThan(-1);
    expect(typecheckIndex).toBeGreaterThan(buildIndex);
    expect(testIndex).toBeGreaterThan(typecheckIndex);
    expect(installMatrixIndex).toBeGreaterThan(testIndex);
    expect(bundleCheckIndex).toBeGreaterThan(installMatrixIndex);
  });

  it('never publishes to npm anymore', () => {
    const source = fs.readFileSync(RELEASE_SCRIPT, 'utf8');
    expect(source).not.toContain('npm publish');
    expect(source).not.toContain('NPM_TOKEN');
    expect(source).not.toContain('npm pack');
    expect(source).not.toContain('--no-publish');
  });

  it('commits source release metadata plus the generated skill CLI bundle', () => {
    const source = fs.readFileSync(RELEASE_SCRIPT, 'utf8');
    const commitPathsLine = source
      .split('\n')
      .find((line) => line.includes('commitPaths') && line.includes('VERSION_FILES'));

    expect(commitPathsLine).toBeTruthy();
    expect(commitPathsLine).toContain("'skill/cli'");
    expect(source).toContain('git add ${commitPaths.join');
    expect(source).not.toMatch(/git add[^'\n]*packages\/boss-cli\/dist/);
  });

  it('validates versions using structured readers instead of substring matching', () => {
    const source = fs.readFileSync(RELEASE_SCRIPT, 'utf8');
    expect(source).toContain('function verifyVersionFile');
    expect(source).not.toContain('content.includes(next)');
  });
});
