import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { cleanupTempDir, createExecData, createTempBossDir } from '../helpers/fixtures.js';

describe('pre-tool-write hook', () => {
  let hook: typeof import('../../scripts/hooks/pre-tool-write.js');
  let tmpDir: string | null = null;

  beforeEach(async () => {
    vi.resetModules();
    hook = await import('../../scripts/hooks/pre-tool-write.js');
  });

  afterEach(() => {
    if (tmpDir) {
      cleanupTempDir(tmpDir);
      tmpDir = null;
    }
  });

  it('returns empty string for non-.boss paths', () => {
    expect(
      hook.run(
        JSON.stringify({
          tool_input: { file_path: '/some/other/file.js' },
          cwd: '/tmp'
        })
      )
    ).toBe('');
  });

  it('denies direct edits to execution.json', () => {
    const parsed = JSON.parse(
      hook.run(
        JSON.stringify({
          tool_input: { file_path: '.boss/feat/.meta/execution.json' },
          cwd: '/tmp'
        })
      )
    ) as {
      hookSpecificOutput: { permissionDecision: string };
    };

    expect(parsed.hookSpecificOutput.permissionDecision).toBe('deny');
  });

  it('allows writes when stage is running', () => {
    const execData = createExecData({
      feature: 'feat',
      stages: {
        '1': { name: 'Planning', status: 'running', artifacts: [] },
        '2': { name: 'Review', status: 'pending', artifacts: [] },
        '3': { name: 'Development', status: 'pending', artifacts: [] },
        '4': { name: 'Deployment', status: 'pending', artifacts: [] }
      }
    });
    tmpDir = createTempBossDir('feat', execData);

    expect(
      hook.run(
        JSON.stringify({
          tool_input: { file_path: `${tmpDir}/.boss/feat/prd.md` },
          cwd: tmpDir
        })
      )
    ).toBe('');
  });

  it('asks when writing to non-running stage', () => {
    const execData = createExecData({
      feature: 'feat',
      stages: {
        '1': { name: 'Planning', status: 'completed', artifacts: [] },
        '2': { name: 'Review', status: 'pending', artifacts: [] },
        '3': { name: 'Development', status: 'pending', artifacts: [] },
        '4': { name: 'Deployment', status: 'pending', artifacts: [] }
      }
    });
    tmpDir = createTempBossDir('feat', execData);

    const parsed = JSON.parse(
      hook.run(
        JSON.stringify({
          tool_input: { file_path: `${tmpDir}/.boss/feat/prd.md` },
          cwd: tmpDir
        })
      )
    ) as {
      hookSpecificOutput: { permissionDecision: string };
    };

    expect(parsed.hookSpecificOutput.permissionDecision).toBe('ask');
  });
});
