import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

import { cleanupTempDir, createExecData, createTempBossDir } from '../helpers/fixtures.js';

describe('session-resume hook', () => {
  let hook: typeof import('../../scripts/hooks/session-resume.js');
  let tmpDir: string | null = null;

  beforeEach(async () => {
    vi.resetModules();
    hook = await import('../../scripts/hooks/session-resume.js');
  });

  afterEach(() => {
    if (tmpDir) {
      cleanupTempDir(tmpDir);
      tmpDir = null;
    }
  });

  it('returns empty string when cwd is empty', () => {
    expect(hook.run(JSON.stringify({ cwd: '' }))).toBe('');
  });

  it('returns empty string when no .boss dir', () => {
    expect(hook.run(JSON.stringify({ cwd: '/nonexistent' }))).toBe('');
  });

  it('detects unfinished pipelines', () => {
    const execData = createExecData({ feature: 'test-feat', status: 'running' });
    tmpDir = createTempBossDir('test-feat', execData);

    const result = hook.run(JSON.stringify({ cwd: tmpDir }));
    expect(result.length).toBeGreaterThan(0);

    const parsed = JSON.parse(result) as {
      hookSpecificOutput: { additionalContext: string };
    };
    expect(parsed.hookSpecificOutput.additionalContext).toContain('test-feat');
    expect(parsed.hookSpecificOutput.additionalContext).toContain('会话恢复');
  });

  it('returns empty when all pipelines are completed', () => {
    const execData = createExecData({ feature: 'test-feat', status: 'completed' });
    tmpDir = createTempBossDir('test-feat', execData);

    expect(hook.run(JSON.stringify({ cwd: tmpDir }))).toBe('');
  });

  it('loads previous session state if available', () => {
    const execData = createExecData({ feature: 'test-feat', status: 'running' });
    tmpDir = createTempBossDir('test-feat', execData);

    fs.writeFileSync(
      path.join(tmpDir, '.boss', '.session-state.json'),
      JSON.stringify({ feature: 'test-feat', pipelineStatus: 'running' }),
      'utf8'
    );

    const parsed = JSON.parse(hook.run(JSON.stringify({ cwd: tmpDir }))) as {
      hookSpecificOutput: {
        previousSessionState?: { feature: string };
      };
    };

    expect(parsed.hookSpecificOutput.previousSessionState).toBeTruthy();
    expect(parsed.hookSpecificOutput.previousSessionState?.feature).toBe('test-feat');
  });
});
