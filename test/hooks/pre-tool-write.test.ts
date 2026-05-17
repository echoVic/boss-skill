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

  it('denies Codex apply_patch edits to execution.json', () => {
    const parsed = JSON.parse(
      hook.run(
        JSON.stringify({
          tool_name: 'apply_patch',
          tool_input: {
            patch: `*** Begin Patch
*** Update File: /tmp/project/.boss/feat/.meta/execution.json
@@
-old
+new
*** End Patch`
          },
          cwd: '/tmp/project'
        })
      )
    ) as {
      hookSpecificOutput: { permissionDecision: string };
    };

    expect(parsed.hookSpecificOutput.permissionDecision).toBe('deny');
  });

  it('denies Codex apply_patch deletes to execution.json', () => {
    const parsed = JSON.parse(
      hook.run(
        JSON.stringify({
          tool_name: 'apply_patch',
          tool_input: {
            patch: `*** Begin Patch
*** Delete File: /tmp/project/.boss/feat/.meta/execution.json
*** End Patch`
          },
          cwd: '/tmp/project'
        })
      )
    ) as {
      hookSpecificOutput: { permissionDecision: string };
    };

    expect(parsed.hookSpecificOutput.permissionDecision).toBe('deny');
  });

  it('asks when Codex apply_patch file extraction fails', () => {
    const parsed = JSON.parse(
      hook.run(
        JSON.stringify({
          tool_name: 'apply_patch',
          tool_input: {
            patch: `*** Begin Patch
broken patch references /tmp/project/.boss/feat/prd.md but has no file header
*** End Patch`
          },
          cwd: '/tmp/project'
        })
      )
    ) as {
      hookSpecificOutput: { permissionDecision: string; permissionDecisionReason: string };
    };

    expect(parsed.hookSpecificOutput.permissionDecision).toBe('ask');
    expect(parsed.hookSpecificOutput.permissionDecisionReason).toContain('apply_patch');
  });

  it('allows unparsed Codex apply_patch payloads when they do not mention .boss paths', () => {
    expect(
      hook.run(
        JSON.stringify({
          tool_name: 'apply_patch',
          tool_input: {
            patch: `*** Begin Patch
broken patch references /tmp/project/src/app.ts but has no file header
*** End Patch`
          },
          cwd: '/tmp/project'
        })
      )
    ).toBe('');
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
