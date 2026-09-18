import * as fs from 'node:fs';
import * as path from 'node:path';
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
          cwd: '/tmp',
        }),
      ),
    ).toBe('');
  });

  it('denies direct edits to execution.json', () => {
    const parsed = JSON.parse(
      hook.run(
        JSON.stringify({
          tool_input: { file_path: '.boss/feat/.meta/execution.json' },
          cwd: '/tmp',
        }),
      ),
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
*** End Patch`,
          },
          cwd: '/tmp/project',
        }),
      ),
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
*** End Patch`,
          },
          cwd: '/tmp/project',
        }),
      ),
    ) as {
      hookSpecificOutput: { permissionDecision: string };
    };

    expect(parsed.hookSpecificOutput.permissionDecision).toBe('deny');
  });

  it('denies when Codex apply_patch file extraction fails for .boss paths', () => {
    const parsed = JSON.parse(
      hook.run(
        JSON.stringify({
          tool_name: 'apply_patch',
          tool_input: {
            patch: `*** Begin Patch
broken patch references /tmp/project/.boss/feat/prd.md but has no file header
*** End Patch`,
          },
          cwd: '/tmp/project',
        }),
      ),
    ) as {
      hookSpecificOutput: { permissionDecision: string; permissionDecisionReason: string };
    };

    expect(parsed.hookSpecificOutput.permissionDecision).toBe('deny');
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
*** End Patch`,
          },
          cwd: '/tmp/project',
        }),
      ),
    ).toBe('');
  });

  it('allows writes when stage is running', () => {
    const execData = createExecData({
      feature: 'feat',
      stages: {
        '1': { name: 'Planning', status: 'running', artifacts: [] },
        '2': { name: 'Review', status: 'pending', artifacts: [] },
        '3': { name: 'Development', status: 'pending', artifacts: [] },
        '4': { name: 'Deployment', status: 'pending', artifacts: [] },
      },
    });
    tmpDir = createTempBossDir('feat', execData);

    expect(
      hook.run(
        JSON.stringify({
          tool_input: { file_path: `${tmpDir}/.boss/feat/prd.md` },
          cwd: tmpDir,
        }),
      ),
    ).toBe('');
  });

  it('denies rewriting an already-recorded artifact outside a running stage', () => {
    // 该产物已记录在已完成的 stage 中，DAG ready 逃生门不适用，必须拦截。
    const execData = createExecData({
      feature: 'feat',
      stages: {
        '1': { name: 'Planning', status: 'completed', artifacts: ['prd.md'] },
        '2': { name: 'Review', status: 'pending', artifacts: [] },
        '3': { name: 'Development', status: 'pending', artifacts: [] },
        '4': { name: 'Deployment', status: 'pending', artifacts: [] },
      },
    });
    tmpDir = createTempBossDir('feat', execData);

    const parsed = JSON.parse(
      hook.run(
        JSON.stringify({
          tool_input: { file_path: `${tmpDir}/.boss/feat/prd.md` },
          cwd: tmpDir,
        }),
      ),
    ) as {
      hookSpecificOutput: { permissionDecision: string };
    };

    expect(parsed.hookSpecificOutput.permissionDecision).toBe('deny');
  });

  it('denies Codex apply_patch command edits to execution.json', () => {
    const parsed = JSON.parse(
      hook.run(
        JSON.stringify({
          tool_name: 'apply_patch',
          tool_input: {
            command: `*** Begin Patch
*** Update File: /tmp/project/.boss/feat/.meta/execution.json
@@
-old
+new
*** End Patch`,
          },
          cwd: '/tmp/project',
        }),
      ),
    ) as {
      hookSpecificOutput: { permissionDecision: string };
    };

    expect(parsed.hookSpecificOutput.permissionDecision).toBe('deny');
  });

  describe('artifact DAG ready escape hatch', () => {
    it('resolves the built-in artifact DAG when no project override exists', async () => {
      // 回归防护：此处曾查 `harness/artifact-dag.json`，而该目录在迁移后已不存在，
      // 导致 DAG 永远加载失败、ready 逃生门永久失效，合法产物写入被误拦。
      const utils = await import('../../scripts/lib/boss-utils.js');
      const dagPath = utils.resolveArtifactDagPath('/tmp/no-such-project-xyz');

      expect(dagPath).toBeTruthy();
      expect(dagPath).toContain('artifact-dag.json');
      expect(dagPath).not.toContain('harness');

      const dag = utils.loadArtifactDag(dagPath!);
      expect(dag?.artifacts).toBeTruthy();
      expect(Object.keys(dag!.artifacts).length).toBeGreaterThan(0);
    });

    it('prefers a project-level DAG override', async () => {
      const execData = createExecData({ feature: 'dag-feat' });
      tmpDir = createTempBossDir('dag-feat', execData);
      const override = path.join(tmpDir, '.boss', 'artifact-dag.json');
      fs.writeFileSync(override, JSON.stringify({ artifacts: { 'custom.md': { inputs: [] } } }));

      const utils = await import('../../scripts/lib/boss-utils.js');
      expect(utils.resolveArtifactDagPath(tmpDir)).toBe(override);
    });

    it('allows writing an artifact whose DAG inputs are satisfied even when the stage is not running', () => {
      // stage 1 已完成但 prd.md 尚未产出：DAG inputs 已满足，应放行。
      // 旧实现因 DAG 加载失败而无条件 deny，会让流水线卡死在这里。
      const execData = createExecData({
        feature: 'ready-feat',
        stages: {
          '1': { name: 'Planning', status: 'completed', artifacts: [] },
          '2': { name: 'Review', status: 'pending', artifacts: [] },
          '3': { name: 'Development', status: 'pending', artifacts: [] },
          '4': { name: 'Deployment', status: 'pending', artifacts: [] },
        },
      });
      tmpDir = createTempBossDir('ready-feat', execData);

      const result = hook.run(
        JSON.stringify({
          tool_input: { file_path: path.join(tmpDir, '.boss', 'ready-feat', 'prd.md') },
          cwd: tmpDir,
        }),
      );

      expect(result).toBe('');
    });
  });
});
