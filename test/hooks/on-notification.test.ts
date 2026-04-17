import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

import { cleanupTempDir, createExecData, createTempBossDir } from '../helpers/fixtures.js';

describe('on-notification hook', () => {
  let hook: typeof import('../../scripts/hooks/on-notification.js');
  let tmpDir: string | null = null;

  beforeEach(async () => {
    vi.resetModules();
    hook = await import('../../scripts/hooks/on-notification.js');
  });

  afterEach(() => {
    if (tmpDir) {
      cleanupTempDir(tmpDir);
      tmpDir = null;
    }
  });

  it('returns empty string when message is empty', () => {
    expect(hook.run(JSON.stringify({ message: '', cwd: '/tmp' }))).toBe('');
  });

  it('returns empty string when no .boss dir', () => {
    expect(
      hook.run(
        JSON.stringify({
          message: 'test notification',
          cwd: '/nonexistent'
        })
      )
    ).toBe('');
  });

  it('logs notification for running pipeline', () => {
    const execData = createExecData({ feature: 'test-feat', status: 'running' });
    tmpDir = createTempBossDir('test-feat', execData);

    hook.run(
      JSON.stringify({
        message: 'Build completed',
        notification_type: 'info',
        cwd: tmpDir
      })
    );

    const logFile = path.join(tmpDir, '.boss', 'test-feat', '.meta', 'notifications.jsonl');
    expect(fs.existsSync(logFile)).toBe(true);

    const entry = JSON.parse(fs.readFileSync(logFile, 'utf8').trim()) as {
      message: string;
      type: string;
    };

    expect(entry.message).toBe('Build completed');
    expect(entry.type).toBe('info');
  });

  it('skips non-running pipelines', () => {
    const execData = createExecData({ feature: 'test-feat', status: 'completed' });
    tmpDir = createTempBossDir('test-feat', execData);

    hook.run(
      JSON.stringify({
        message: 'test',
        cwd: tmpDir
      })
    );

    const logFile = path.join(tmpDir, '.boss', 'test-feat', '.meta', 'notifications.jsonl');
    expect(fs.existsSync(logFile)).toBe(false);
  });
});
