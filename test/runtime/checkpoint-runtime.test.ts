import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

import { initPipeline, updateStage } from '../../packages/boss-cli/src/runtime/application/pipeline.js';
import { buildBossStatus } from '../../packages/boss-cli/src/runtime/application/checkpoints.js';
import { resolveDriverCapabilities } from '../../packages/boss-cli/src/runtime/application/drivers.js';
import {
  createWipCheckpoint,
  restoreWipCheckpoint
} from '../../packages/boss-cli/src/runtime/application/wip-checkpoint.js';
import { cleanupTempDir } from '../helpers/fixtures.js';

describe('multi-driver checkpoint runtime', () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'boss-checkpoint-'));
  });

  afterEach(() => {
    cleanupTempDir(tmpDir);
  });

  it('resolves generic capabilities without assuming hooks', () => {
    expect(resolveDriverCapabilities('generic')).toEqual({
      name: 'generic',
      hooks: false,
      checkpointPrompt: true,
      stopGuards: false,
      subagents: false
    });
  });

  it('resolves Claude Code capabilities with hooks enabled', () => {
    expect(resolveDriverCapabilities('claude-code')).toEqual({
      name: 'claude-code',
      hooks: true,
      checkpointPrompt: false,
      stopGuards: true,
      subagents: true
    });
  });

  it('normalizes unknown drivers to generic capabilities', () => {
    expect(resolveDriverCapabilities('unknown-driver')).toEqual({
      name: 'generic',
      hooks: false,
      checkpointPrompt: true,
      stopGuards: false,
      subagents: false
    });
  });

  it('builds status from execution state and ready artifacts', () => {
    initPipeline('test-feat', { cwd: tmpDir });
    updateStage('test-feat', 1, 'running', { cwd: tmpDir });

    const status = buildBossStatus('test-feat', { cwd: tmpDir, driver: 'codex' });

    expect(status.feature).toBe('test-feat');
    expect(status.driver.name).toBe('codex');
    expect(status.capabilities.checkpointPrompt).toBe(true);
    expect(status.currentStage).toMatchObject({ id: 1, status: 'running' });
    expect(status.currentWave).toBeNull();
    expect(status.readyArtifacts).toContain('prd.md');
    expect(status.checkpoint).toMatchObject({
      checkpointRequired: false,
      reason: 'next-action-ready',
      continueCommand: 'boss continue test-feat'
    });
  });

  it('requires default checks for stage 3 and later checkpoints', () => {
    initPipeline('test-feat', { cwd: tmpDir });
    updateStage('test-feat', 3, 'running', { cwd: tmpDir });

    const status = buildBossStatus('test-feat', { cwd: tmpDir, driver: 'codex' });

    expect(status.checkpoint.requiredChecks.map((check) => check.command)).toEqual([
      'npm run typecheck',
      'npm test'
    ]);
  });

  it('keeps stash checkpoints restorable without clearing the working tree', () => {
    spawnSync('git', ['init'], { cwd: tmpDir, stdio: 'ignore' });
    spawnSync('git', ['config', 'user.email', 'boss@example.com'], { cwd: tmpDir, stdio: 'ignore' });
    spawnSync('git', ['config', 'user.name', 'Boss Test'], { cwd: tmpDir, stdio: 'ignore' });
    fs.writeFileSync(path.join(tmpDir, 'tracked.txt'), 'base\n', 'utf8');
    spawnSync('git', ['add', 'tracked.txt'], { cwd: tmpDir, stdio: 'ignore' });
    spawnSync('git', ['commit', '-m', 'initial'], { cwd: tmpDir, stdio: 'ignore' });
    initPipeline('test-feat', { cwd: tmpDir });

    fs.writeFileSync(path.join(tmpDir, 'tracked.txt'), 'changed\n', 'utf8');
    fs.writeFileSync(path.join(tmpDir, 'new.txt'), 'new\n', 'utf8');

    const checkpoint = createWipCheckpoint('test-feat', { cwd: tmpDir, strategy: 'stash', stage: 2 });

    expect(checkpoint.created).toBe(true);
    expect(fs.readFileSync(path.join(tmpDir, 'tracked.txt'), 'utf8')).toBe('changed\n');
    expect(fs.existsSync(path.join(tmpDir, 'new.txt'))).toBe(true);
    expect(spawnSync('git', ['stash', 'list'], { cwd: tmpDir, encoding: 'utf8' }).stdout).toContain(
      'boss-wip: test-feat stage-2'
    );

    fs.writeFileSync(path.join(tmpDir, 'tracked.txt'), 'base\n', 'utf8');
    fs.rmSync(path.join(tmpDir, 'new.txt'), { force: true });
    const restored = restoreWipCheckpoint('test-feat', { cwd: tmpDir, ref: checkpoint.ref });

    expect(restored).toEqual({ restored: true, ref: checkpoint.ref, conflicts: [] });
    expect(fs.readFileSync(path.join(tmpDir, 'tracked.txt'), 'utf8')).toBe('changed\n');
    expect(fs.readFileSync(path.join(tmpDir, 'new.txt'), 'utf8')).toBe('new\n');
  });
});
