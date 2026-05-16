import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import {
  initPipeline,
  getArtifactStatus,
  listArtifactStatuses,
  skipUpTo,
  getReadyArtifacts
} from '../../packages/boss-cli/src/runtime/application/pipeline.js';

describe('DAG edge cases', () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'boss-dag-'));
    initPipeline('dag-feature', { cwd: tmpDir });
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true, maxRetries: 5, retryDelay: 200 });
  });

  function writeDag(dag: Record<string, unknown>): string {
    const dagPath = path.join(tmpDir, 'custom-dag.json');
    fs.writeFileSync(dagPath, JSON.stringify(dag), 'utf8');
    return dagPath;
  }

  it('throws for artifact not defined in DAG', () => {
    const dagPath = writeDag({
      artifacts: {
        'prd.md': { inputs: [], agent: 'boss-pm', stage: 1 }
      }
    });

    expect(() =>
      getArtifactStatus('dag-feature', 'nonexistent.md', { cwd: tmpDir, dagPath })
    ).toThrow(/DAG 中未定义产物.*nonexistent\.md/);
  });

  it('throws for missing DAG file', () => {
    expect(() =>
      getArtifactStatus('dag-feature', 'prd.md', { cwd: tmpDir, dagPath: '/nonexistent/dag.json' })
    ).toThrow(/未找到 DAG 文件/);
  });

  it('reports blocked status when inputs are not satisfied', () => {
    const dagPath = writeDag({
      artifacts: {
        'prd.md': { inputs: [], agent: 'boss-pm', stage: 1 },
        'architecture.md': { inputs: ['prd.md'], agent: 'boss-architect', stage: 2 }
      }
    });

    const status = getArtifactStatus('dag-feature', 'architecture.md', { cwd: tmpDir, dagPath });
    expect(status.status).toBe('blocked');
    expect(status.missing).toContain('prd.md');
  });

  it('reports ready status when all inputs are satisfied (optional inputs)', () => {
    const dagPath = writeDag({
      artifacts: {
        'notes.md': { inputs: [], agent: 'boss-pm', stage: 1, optional: true },
        'prd.md': { inputs: ['notes.md'], agent: 'boss-pm', stage: 1 }
      }
    });

    const status = getArtifactStatus('dag-feature', 'prd.md', { cwd: tmpDir, dagPath });
    expect(status.status).toBe('ready');
  });

  it('skipUpTo skips the target and all transitive inputs', () => {
    const dagPath = writeDag({
      artifacts: {
        'prd.md': { inputs: [], agent: 'boss-pm', stage: 1 },
        'tasks.md': { inputs: ['prd.md'], agent: 'boss-architect', stage: 2 },
        'code': { inputs: ['tasks.md'], agent: 'boss-dev', stage: 3 }
      }
    });

    const skipped = skipUpTo('dag-feature', 'code', { cwd: tmpDir, dagPath });
    expect(skipped).toContain('prd.md');
    expect(skipped).toContain('tasks.md');
    expect(skipped).toContain('code');
  });

  it('skipUpTo throws for undefined artifact', () => {
    const dagPath = writeDag({
      artifacts: {
        'prd.md': { inputs: [], agent: 'boss-pm', stage: 1 }
      }
    });

    expect(() =>
      skipUpTo('dag-feature', 'ghost.md', { cwd: tmpDir, dagPath })
    ).toThrow(/DAG 中未定义产物.*ghost\.md/);
  });

  it('listArtifactStatuses returns status for all DAG artifacts', () => {
    const dagPath = writeDag({
      artifacts: {
        'prd.md': { inputs: [], agent: 'boss-pm', stage: 1 },
        'architecture.md': { inputs: ['prd.md'], agent: 'boss-arch', stage: 2 }
      }
    });

    const statuses = listArtifactStatuses('dag-feature', { cwd: tmpDir, dagPath });
    expect(statuses).toHaveLength(2);
    const names = statuses.map(s => s.artifact);
    expect(names).toContain('prd.md');
    expect(names).toContain('architecture.md');
  });

  it('getReadyArtifacts returns only artifacts whose inputs are all satisfied', () => {
    const dagPath = writeDag({
      artifacts: {
        'prd.md': { inputs: [], agent: 'boss-pm', stage: 1 },
        'tasks.md': { inputs: ['prd.md'], agent: 'boss-arch', stage: 2 },
        'code': { inputs: ['tasks.md'], agent: 'boss-dev', stage: 3 }
      }
    });

    const ready = getReadyArtifacts('dag-feature', { cwd: tmpDir, dagPath });
    // Only prd.md has no unsatisfied inputs initially
    expect(ready.map(r => r.artifact)).toEqual(['prd.md']);
  });
});
