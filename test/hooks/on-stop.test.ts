import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { cleanupTempDir, createExecData, createTempBossDir } from '../helpers/fixtures.js';

describe('on-stop hook', () => {
  let hook: typeof import('../../scripts/hooks/on-stop.js');
  let tmpDir: string | null = null;

  beforeEach(async () => {
    vi.resetModules();
    hook = await import('../../scripts/hooks/on-stop.js');
  });

  afterEach(() => {
    if (tmpDir) {
      cleanupTempDir(tmpDir);
      tmpDir = null;
    }
  });

  it('returns empty when stop_hook_active is true', () => {
    expect(hook.run(JSON.stringify({ stop_hook_active: true, cwd: '/tmp' }))).toBe('');
  });

  it('returns empty when no active pipeline', () => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'boss-test-'));
    expect(hook.run(JSON.stringify({ cwd: tmpDir }))).toBe('');
  });

  it('blocks when stages are running', () => {
    const execData = createExecData({
      feature: 'blocking-feat',
      status: 'running',
      stages: {
        '1': { name: 'Planning', status: 'completed' },
        '2': { name: 'Review', status: 'running' },
        '3': { name: 'Development', status: 'pending' },
        '4': { name: 'Deployment', status: 'pending' }
      }
    });
    tmpDir = createTempBossDir('blocking-feat', execData);

    const parsed = JSON.parse(hook.run(JSON.stringify({ cwd: tmpDir }))) as {
      decision: string;
      reason: string;
    };

    expect(parsed.decision).toBe('block');
    expect(parsed.reason).toContain('blocking-feat');
  });

  it('allows stop when no stages are running', () => {
    const execData = createExecData({
      feature: 'done-feat',
      status: 'running',
      stages: {
        '1': { name: 'Planning', status: 'completed' },
        '2': { name: 'Review', status: 'completed' },
        '3': { name: 'Development', status: 'pending' },
        '4': { name: 'Deployment', status: 'pending' }
      }
    });
    tmpDir = createTempBossDir('done-feat', execData);

    expect(hook.run(JSON.stringify({ cwd: tmpDir }))).toBe('');
  });

  it('detects running stage beyond stage 4', () => {
    const execData = createExecData({
      feature: 'extra-feat',
      status: 'running',
      stages: {
        '1': { name: 'Planning', status: 'completed' },
        '2': { name: 'Review', status: 'completed' },
        '3': { name: 'Development', status: 'completed' },
        '4': { name: 'Deployment', status: 'completed' },
        '5': { name: 'PostDeploy', status: 'running' }
      }
    });
    tmpDir = createTempBossDir('extra-feat', execData);

    const parsed = JSON.parse(hook.run(JSON.stringify({ cwd: tmpDir }))) as {
      decision: string;
      reason: string;
    };

    expect(parsed.decision).toBe('block');
    expect(parsed.reason).toContain('extra-feat');
  });
});
