import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

import { cleanupTempDir, createExecData, createTempBossDir } from '../helpers/fixtures.js';

describe('post-tool-write hook', () => {
  let hook: typeof import('../../scripts/hooks/post-tool-write.js');
  let tmpDir: string | null = null;

  beforeEach(async () => {
    vi.resetModules();
    hook = await import('../../scripts/hooks/post-tool-write.js');
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
          tool_input: { file_path: '/some/other/file.ts' },
          cwd: '/tmp'
        })
      )
    ).toBe('');
  });

  it('returns empty string for execution.json writes', () => {
    expect(
      hook.run(
        JSON.stringify({
          tool_input: { file_path: '/proj/.boss/feat/.meta/execution.json' },
          cwd: '/proj'
        })
      )
    ).toBe('');
  });

  it('records artifact to execution.json for known stage files', () => {
    const execData = createExecData({ feature: 'test-feat' });
    tmpDir = createTempBossDir('test-feat', execData);

    const result = hook.run(
      JSON.stringify({
        tool_input: { file_path: path.join(tmpDir, '.boss', 'test-feat', 'prd.md') },
        cwd: tmpDir
      })
    );

    expect(result.length).toBeGreaterThan(0);
    const parsed = JSON.parse(result) as {
      hookSpecificOutput: { additionalContext: string };
    };
    expect(parsed.hookSpecificOutput.additionalContext).toContain('prd.md');

    const execPath = path.join(tmpDir, '.boss', 'test-feat', '.meta', 'execution.json');
    const updated = JSON.parse(fs.readFileSync(execPath, 'utf8')) as {
      stages: { '1': { artifacts: string[] } };
    };
    expect(updated.stages['1'].artifacts).toContain('prd.md');
  });

  it('skips unknown artifact names', () => {
    const execData = createExecData({ feature: 'test-feat' });
    tmpDir = createTempBossDir('test-feat', execData);

    expect(
      hook.run(
        JSON.stringify({
          tool_input: { file_path: path.join(tmpDir, '.boss', 'test-feat', 'random-file.txt') },
          cwd: tmpDir
        })
      )
    ).toBe('');
  });

  it('does not duplicate existing artifacts', () => {
    const execData = createExecData({
      feature: 'test-feat',
      stages: {
        '1': { name: 'Planning', status: 'running', artifacts: ['prd.md'] },
        '2': { name: 'Review', status: 'pending', artifacts: [] },
        '3': { name: 'Development', status: 'pending', artifacts: [] },
        '4': { name: 'Deployment', status: 'pending', artifacts: [] }
      }
    });
    tmpDir = createTempBossDir('test-feat', execData);

    expect(
      hook.run(
        JSON.stringify({
          tool_input: { file_path: path.join(tmpDir, '.boss', 'test-feat', 'prd.md') },
          cwd: tmpDir
        })
      )
    ).toBe('');
  });

  it('records an artifact event even when execution.json drifted ahead of events', () => {
    const execData = createExecData({
      feature: 'test-feat',
      stages: {
        '1': { name: 'Planning', status: 'running', artifacts: ['prd.md'] },
        '2': { name: 'Review', status: 'pending', artifacts: [] },
        '3': { name: 'Development', status: 'pending', artifacts: [] },
        '4': { name: 'Deployment', status: 'pending', artifacts: [] }
      }
    });
    tmpDir = createTempBossDir('test-feat', execData);

    const metaDir = path.join(tmpDir, '.boss', 'test-feat', '.meta');
    fs.writeFileSync(
      path.join(metaDir, 'events.jsonl'),
      `${JSON.stringify({
        id: 1,
        type: 'PipelineInitialized',
        timestamp: '2024-01-01T00:00:00Z',
        data: {
          initialState: createExecData({
            feature: 'test-feat',
            stages: {
              '1': { name: 'Planning', status: 'running', artifacts: [] },
              '2': { name: 'Review', status: 'pending', artifacts: [] },
              '3': { name: 'Development', status: 'pending', artifacts: [] },
              '4': { name: 'Deployment', status: 'pending', artifacts: [] }
            }
          })
        }
      })}\n`,
      'utf8'
    );

    const result = hook.run(
      JSON.stringify({
        tool_input: { file_path: path.join(tmpDir, '.boss', 'test-feat', 'prd.md') },
        cwd: tmpDir
      })
    );

    expect(result.length).toBeGreaterThan(0);

    const eventsPath = path.join(metaDir, 'events.jsonl');
    const events = fs
      .readFileSync(eventsPath, 'utf8')
      .trim()
      .split('\n')
      .map((line) => JSON.parse(line) as { type: string; data: { artifact?: string } });

    expect(events).toHaveLength(2);
    expect(events[1]?.type).toBe('ArtifactRecorded');
    expect(events[1]?.data.artifact).toBe('prd.md');
  });
});
