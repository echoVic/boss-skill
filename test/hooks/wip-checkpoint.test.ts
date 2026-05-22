import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { initPipeline, updateStage } from '../../packages/boss-cli/src/runtime/application/pipeline.js';
import { cleanupTempDir } from '../helpers/fixtures.js';

describe('wip-checkpoint hook', () => {
  let tmpDir: string;
  const cwd = process.cwd();

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'boss-wip-hook-'));
    spawnSync('git', ['init'], { cwd: tmpDir, stdio: 'ignore' });
    spawnSync('git', ['config', 'user.email', 'boss@example.com'], { cwd: tmpDir, stdio: 'ignore' });
    spawnSync('git', ['config', 'user.name', 'Boss Test'], { cwd: tmpDir, stdio: 'ignore' });
    fs.writeFileSync(path.join(tmpDir, 'tracked.txt'), 'base\n', 'utf8');
    spawnSync('git', ['add', 'tracked.txt'], { cwd: tmpDir, stdio: 'ignore' });
    spawnSync('git', ['commit', '-m', 'initial'], { cwd: tmpDir, stdio: 'ignore' });
    initPipeline('test-feat', { cwd: tmpDir });
    updateStage('test-feat', 2, 'running', { cwd: tmpDir });
  });

  afterEach(() => {
    process.chdir(cwd);
    cleanupTempDir(tmpDir);
  });

  it('creates a restorable checkpoint for untracked-only changes', async () => {
    fs.writeFileSync(path.join(tmpDir, 'untracked.txt'), 'new\n', 'utf8');
    process.chdir(tmpDir);

    const result = spawnSync('node', [path.join(cwd, 'scripts/hooks/wip-checkpoint.js')], {
      cwd: tmpDir,
      encoding: 'utf8'
    });

    expect(result.status).toBe(0);
    const checkpoints = JSON.parse(
      fs.readFileSync(path.join(tmpDir, '.boss', 'test-feat', '.meta', 'wip-checkpoints.json'), 'utf8')
    ) as Array<{ message: string; strategy: string; changedFiles: number }>;
    expect(checkpoints.at(-1)).toMatchObject({
      strategy: 'stash',
      changedFiles: 1
    });
    expect(checkpoints.at(-1)?.message).toContain('boss-wip: test-feat stage-2');
    expect(fs.readFileSync(path.join(tmpDir, 'untracked.txt'), 'utf8')).toBe('new\n');
    expect(spawnSync('git', ['stash', 'list'], { cwd: tmpDir, encoding: 'utf8' }).stdout).toContain(
      'boss-wip: test-feat stage-2'
    );
  });
});
