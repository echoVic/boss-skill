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
      '.claude-plugin/plugin.json',
      '.claude-plugin/marketplace.json',
      'skill/SKILL.md',
    ]) {
      expect(source).toContain(`path: '${expectedPath}'`);
    }
  });

  it('runs the full verification chain with no build step', () => {
    const source = fs.readFileSync(RELEASE_SCRIPT, 'utf8');
    const typecheckIndex = source.indexOf("run('npm', ['run', 'typecheck'])");
    const lintIndex = source.indexOf("run('npm', ['run', 'lint'])");
    const testIndex = source.indexOf("run('npm', ['test'])");

    expect(typecheckIndex).toBeGreaterThan(-1);
    expect(lintIndex).toBeGreaterThan(typecheckIndex);
    expect(testIndex).toBeGreaterThan(lintIndex);
    // Expert-squad 模式：无 CLI runtime，发布链里不允许再出现构建/产物同步步骤。
    expect(source).not.toContain('build:skill');
    expect(source).not.toContain('build-skill-cli');
    expect(source).not.toContain('skill/cli/bin/boss.mts');
  });

  it('reformats version files after syncing so the release commit stays biome-clean', () => {
    const source = fs.readFileSync(RELEASE_SCRIPT, 'utf8');
    const syncIndex = source.indexOf('同步版本号');
    const formatIndex = source.indexOf("run('npm', ['run', 'format'])");
    const provenanceIndex = source.indexOf("run('npm', ['run', 'provenance:generate'])");

    expect(syncIndex).toBeGreaterThan(-1);
    expect(formatIndex).toBeGreaterThan(syncIndex);
    expect(provenanceIndex).toBeGreaterThan(formatIndex);
  });

  it('rebuilds the DSH resources snapshot after syncing so it carries the new version', () => {
    const source = fs.readFileSync(RELEASE_SCRIPT, 'utf8');
    const syncIndex = source.indexOf('同步版本号');
    const dshIndex = source.indexOf("run('npm', ['run', 'dsh:build'])");
    const formatIndex = source.indexOf("run('npm', ['run', 'format'])");
    const commitPathsLine = source
      .split('\n')
      .find((line) => line.includes('commitPaths') && line.includes('VERSION_FILES'));

    // resources.json embeds the root version and skill/SKILL.md; test/dsh/plugin.test.ts fails
    // on the release commit when the snapshot is left at the previous version.
    expect(dshIndex).toBeGreaterThan(syncIndex);
    expect(formatIndex).toBeGreaterThan(dshIndex);
    expect(source).toContain("'integrations/deepseek-harness/resources.json'");
    expect(commitPathsLine).toContain('DSH_RESOURCES_FILE');
  });

  it('never publishes to npm anymore', () => {
    const source = fs.readFileSync(RELEASE_SCRIPT, 'utf8');
    expect(source).not.toContain('npm publish');
    expect(source).not.toContain('NPM_TOKEN');
    expect(source).not.toContain('npm pack');
    expect(source).not.toContain('--no-publish');
  });

  it('commits only version metadata files', () => {
    const source = fs.readFileSync(RELEASE_SCRIPT, 'utf8');
    const commitPathsLine = source
      .split('\n')
      .find((line) => line.includes('commitPaths') && line.includes('VERSION_FILES'));

    expect(commitPathsLine).toBeTruthy();
    expect(commitPathsLine).not.toContain('skill/cli');
    expect(commitPathsLine).not.toContain('packages');
    expect(source).toContain("run('git', ['add', ...commitPaths])");
    // 必须使用 execFileSync 传参数组，禁止 shell 拼接（SHELL_INJECTION_PATTERN）。
    expect(source).not.toContain('execSync');
    expect(source).toContain('execFileSync');
  });

  it('validates versions using structured readers instead of substring matching', () => {
    const source = fs.readFileSync(RELEASE_SCRIPT, 'utf8');
    expect(source).toContain('function verifyVersionFile');
    expect(source).not.toContain('content.includes(next)');
  });
});
