import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { cleanupTempDir, createExecData, createTempBossDir } from '../helpers/fixtures.js';

describe('boss-utils', () => {
  let bossUtils: typeof import('../../scripts/lib/boss-utils.js');
  let tmpDir: string | null = null;

  beforeEach(async () => {
    vi.resetModules();
    bossUtils = await import('../../scripts/lib/boss-utils.js');
  });

  afterEach(() => {
    if (tmpDir) {
      cleanupTempDir(tmpDir);
      tmpDir = null;
    }
  });

  describe('STAGE_MAP', () => {
    it('maps prd.md to stage 1', () => {
      expect(bossUtils.STAGE_MAP['prd.md']).toBe(1);
    });

    it('maps architecture.md to stage 1', () => {
      expect(bossUtils.STAGE_MAP['architecture.md']).toBe(1);
    });

    it('maps tasks.md to stage 2', () => {
      expect(bossUtils.STAGE_MAP['tasks.md']).toBe(2);
    });

    it('maps qa-report.md to stage 3', () => {
      expect(bossUtils.STAGE_MAP['qa-report.md']).toBe(3);
    });

    it('maps deploy-report.md to stage 4', () => {
      expect(bossUtils.STAGE_MAP['deploy-report.md']).toBe(4);
    });

    it('returns undefined for unknown artifacts', () => {
      expect(bossUtils.STAGE_MAP['unknown.md']).toBeUndefined();
    });
  });

  describe('readExecJson', () => {
    it('reads and parses execution.json', () => {
      const execData = createExecData({ feature: 'my-feature' });
      tmpDir = createTempBossDir('my-feature', execData);
      const result = bossUtils.readExecJson(tmpDir, 'my-feature');

      expect(result?.feature).toBe('my-feature');
      expect(result?.status).toBe('running');
    });

    it('returns null for missing file', () => {
      tmpDir = createTempBossDir('missing', null);
      const result = bossUtils.readExecJson(tmpDir, 'missing');

      expect(result).toBeNull();
    });

    it('returns null for corrupt JSON', () => {
      tmpDir = createTempBossDir('corrupt', null);
      const metaDir = path.join(tmpDir, '.boss', 'corrupt', '.meta');
      fs.writeFileSync(path.join(metaDir, 'execution.json'), 'not-json', 'utf8');
      const result = bossUtils.readExecJson(tmpDir, 'corrupt');

      expect(result).toBeNull();
    });
  });

  describe('findActiveFeature', () => {
    it('finds running feature', () => {
      const execData = createExecData({ feature: 'active-feat', status: 'running' });
      tmpDir = createTempBossDir('active-feat', execData);
      const result = bossUtils.findActiveFeature(tmpDir);

      expect(result).toBeTruthy();
      expect(result?.feature).toBe('active-feat');
      expect(result?.status).toBe('running');
    });

    it('finds initialized feature', () => {
      const execData = createExecData({ feature: 'init-feat', status: 'initialized' });
      tmpDir = createTempBossDir('init-feat', execData);
      const result = bossUtils.findActiveFeature(tmpDir);

      expect(result).toBeTruthy();
      expect(result?.feature).toBe('init-feat');
    });

    it('returns null when no .boss dir', () => {
      tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'boss-test-'));
      const result = bossUtils.findActiveFeature(tmpDir);

      expect(result).toBeNull();
    });

    it('skips completed features', () => {
      const execData = createExecData({ feature: 'done-feat', status: 'completed' });
      tmpDir = createTempBossDir('done-feat', execData);
      const result = bossUtils.findActiveFeature(tmpDir);

      expect(result).toBeNull();
    });
  });

  describe('writeJson', () => {
    it('writes JSON atomically', () => {
      tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'boss-test-'));
      const filePath = path.join(tmpDir, 'test.json');
      const data = { hello: 'world' };

      bossUtils.writeJson(filePath, data);

      expect(JSON.parse(fs.readFileSync(filePath, 'utf8'))).toEqual(data);
    });

    it('creates parent directories if needed', () => {
      tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'boss-test-'));
      const filePath = path.join(tmpDir, 'a', 'b', 'test.json');

      bossUtils.writeJson(filePath, { nested: true });

      expect(fs.existsSync(filePath)).toBe(true);
    });
  });

  describe('loadArtifactDag', () => {
    it('loads and parses DAG file', () => {
      const dagPath = path.join(import.meta.dirname, '..', '..', 'harness', 'artifact-dag.json');
      const dag = bossUtils.loadArtifactDag(dagPath);

      expect(dag).toBeTruthy();
      expect(dag?.artifacts).toBeTruthy();
      expect(dag?.artifacts['prd.md']).toBeTruthy();
    });

    it('returns null for missing file', () => {
      expect(bossUtils.loadArtifactDag('/nonexistent/dag.json')).toBeNull();
    });
  });

  describe('getReadyArtifacts', () => {
    it('returns prd.md when no artifacts completed (design-brief optional)', () => {
      const dagPath = path.join(import.meta.dirname, '..', '..', 'harness', 'artifact-dag.json');
      const dag = bossUtils.loadArtifactDag(dagPath);
      const execData = {
        stages: {
          '1': { artifacts: [] },
          '2': { artifacts: [] },
          '3': { artifacts: [] },
          '4': { artifacts: [] }
        }
      };

      const ready = bossUtils.getReadyArtifacts(dag, execData, {});
      const names = ready.map((item) => item.artifact);

      expect(names).toContain('prd.md');
      expect(names).not.toContain('architecture.md');
    });

    it('returns architecture.md and ui-spec.md after prd.md completed', () => {
      const dagPath = path.join(import.meta.dirname, '..', '..', 'harness', 'artifact-dag.json');
      const dag = bossUtils.loadArtifactDag(dagPath);
      const execData = {
        stages: {
          '1': { artifacts: ['prd.md'] },
          '2': { artifacts: [] },
          '3': { artifacts: [] },
          '4': { artifacts: [] }
        }
      };

      const ready = bossUtils.getReadyArtifacts(dag, execData, {});
      const names = ready.map((item) => item.artifact);

      expect(names).toContain('architecture.md');
      expect(names).toContain('ui-spec.md');
      expect(names).not.toContain('prd.md');
    });

    it('skips ui-spec.md when skipUI is true', () => {
      const dagPath = path.join(import.meta.dirname, '..', '..', 'harness', 'artifact-dag.json');
      const dag = bossUtils.loadArtifactDag(dagPath);
      const execData = {
        stages: {
          '1': { artifacts: ['prd.md'] },
          '2': { artifacts: [] },
          '3': { artifacts: [] },
          '4': { artifacts: [] }
        }
      };

      const ready = bossUtils.getReadyArtifacts(dag, execData, { skipUI: true });
      const names = ready.map((item) => item.artifact);

      expect(names).not.toContain('ui-spec.md');
      expect(names).toContain('architecture.md');
    });

    it('collects artifacts from stages beyond 4', () => {
      const dagPath = path.join(import.meta.dirname, '..', '..', 'harness', 'artifact-dag.json');
      const dag = bossUtils.loadArtifactDag(dagPath);
      const execData = {
        stages: {
          '1': { artifacts: ['prd.md'] },
          '2': { artifacts: [] },
          '3': { artifacts: [] },
          '4': { artifacts: [] },
          '5': { artifacts: ['architecture.md'] }
        }
      };

      const ready = bossUtils.getReadyArtifacts(dag, execData, {});
      const names = ready.map((item) => item.artifact);

      // architecture.md is in stage 5's artifacts, so it should be considered completed
      expect(names).not.toContain('architecture.md');
      // its downstream (tech-review.md) should now be ready since architecture.md is done
      // and ui-spec.md is optional
      expect(names).toContain('tech-review.md');
    });

    it('does not mark qa-report.md as ready when prd.md is missing', () => {
      const dagPath = path.join(import.meta.dirname, '..', '..', 'harness', 'artifact-dag.json');
      const dag = bossUtils.loadArtifactDag(dagPath);
      const execData = {
        stages: {
          '1': { artifacts: [] },
          '2': { artifacts: [] },
          '3': { artifacts: ['code'] },
          '4': { artifacts: [] }
        }
      };

      const ready = bossUtils.getReadyArtifacts(dag, execData, {});
      const names = ready.map((item) => item.artifact);

      expect(names).not.toContain('qa-report.md');
    });
  });
});
