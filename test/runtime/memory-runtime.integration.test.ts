import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

describe('memory runtime integration', () => {
  let tmpDir: string;
  let cwd: string;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'boss-memory-runtime-'));
    cwd = process.cwd();
    process.chdir(tmpDir);
  });

  afterEach(() => {
    vi.doUnmock('node:child_process');
    vi.resetModules();
    process.chdir(cwd);
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  async function loadModules() {
    const memoryRuntime = await import('../../runtime/cli/lib/memory-runtime.js');
    const runtime = await import('../../runtime/cli/lib/pipeline-runtime.js');
    return { memoryRuntime, runtime };
  }

  it('refreshes feature memory after runtime state transitions', async () => {
    const { memoryRuntime, runtime } = await loadModules();

    runtime.initPipeline('test-feat', { cwd: tmpDir });
    runtime.updateStage('test-feat', 3, 'running', { cwd: tmpDir });
    runtime.updateAgent('test-feat', 3, 'boss-backend', 'failed', { cwd: tmpDir, reason: 'timeout' });

    const payload = memoryRuntime.readFeatureMemory('test-feat', { cwd: tmpDir });
    expect(payload.records.some((record) => record.category === 'agent_failure_pattern')).toBe(true);
  });

  it('continues runtime execution when memory rebuild throws', async () => {
    vi.resetModules();
    vi.doMock('node:child_process', async () => {
      const actual = await vi.importActual<typeof import('node:child_process')>('node:child_process');
      return {
        ...actual,
        spawnSync: vi.fn((command, args, options) => {
          if (command === process.execPath && Array.isArray(args) && args[0] === '--input-type=module') {
            return {
              pid: 0,
              output: ['', '', 'boom'],
              stdout: '',
              stderr: 'boom',
              status: 1,
              signal: null,
              error: undefined
            };
          }
          return actual.spawnSync(command, args as string[], options as Parameters<typeof actual.spawnSync>[2]);
        })
      };
    });

    const runtime = await import('../../runtime/cli/lib/pipeline-runtime.js');

    runtime.initPipeline('test-feat', { cwd: tmpDir });
    expect(() => runtime.updateStage('test-feat', 1, 'running', { cwd: tmpDir })).not.toThrow();
  });

  it('promotes repeated feature patterns into global memory', async () => {
    const { memoryRuntime } = await loadModules();

    memoryRuntime.writeFeatureMemory('feat-a', [{
      id: 'a1',
      scope: 'feature',
      kind: 'execution',
      category: 'gate_failure_pattern',
      feature: 'feat-a',
      stage: 3,
      agent: null,
      summary: 'Gate 1 failed',
      source: { type: 'events' },
      evidence: [{ type: 'event', ref: '2' }],
      tags: ['gate1'],
      confidence: 0.8,
      createdAt: '2026-04-17T00:00:00Z',
      lastSeenAt: '2026-04-17T00:00:00Z',
      expiresAt: null,
      decayScore: 10,
      influence: 'preference'
    }], { cwd: tmpDir });
    memoryRuntime.writeFeatureMemory('feat-b', [{
      id: 'b1',
      scope: 'feature',
      kind: 'execution',
      category: 'gate_failure_pattern',
      feature: 'feat-b',
      stage: 3,
      agent: null,
      summary: 'Gate 1 failed again',
      source: { type: 'events' },
      evidence: [{ type: 'event', ref: '7' }],
      tags: ['gate1'],
      confidence: 0.85,
      createdAt: '2026-04-18T00:00:00Z',
      lastSeenAt: '2026-04-18T00:00:00Z',
      expiresAt: null,
      decayScore: 11,
      influence: 'preference'
    }], { cwd: tmpDir });

    memoryRuntime.rebuildGlobalMemory({ cwd: tmpDir });
    const payload = memoryRuntime.readGlobalMemory({ cwd: tmpDir });
    expect(payload.records.some((record) => record.scope === 'global' && record.category === 'gate_failure_pattern')).toBe(true);
  });
});
