import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { initPipeline, updateStage } from '../../packages/boss-cli/src/runtime/application/pipeline.js';
import { buildBossStatus } from '../../packages/boss-cli/src/runtime/application/checkpoints.js';
import { resolveDriverCapabilities } from '../../packages/boss-cli/src/runtime/application/drivers.js';
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
});
