import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import {
  getArtifactStatus,
  getReadyArtifacts,
  initPipeline,
  recordArtifact
} from '../../packages/boss-cli/src/runtime/cli/lib/pipeline-runtime.js';

const REPO_ROOT = path.resolve(import.meta.dirname, '..', '..');
const BOSS_BIN = path.join(REPO_ROOT, 'packages', 'boss-cli', 'dist', 'bin', 'boss.js');

describe('getReadyArtifacts', () => {
  let tmpDir: string;
  let cwd: string;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'boss-ready-'));
    cwd = process.cwd();
    process.chdir(tmpDir);
  });

  afterEach(() => {
    process.chdir(cwd);
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it('returns prd.md first for a freshly initialized pipeline', () => {
    initPipeline('test-feat', { cwd: tmpDir });
    const ready = getReadyArtifacts('test-feat', { cwd: tmpDir });
    expect(ready.map((item) => item.artifact)).toEqual(['prd.md']);
  });

  it('uses .boss artifact DAG override before built-in DAG', () => {
    initPipeline('test-feat', { cwd: tmpDir });
    const projectDagPath = path.join(tmpDir, '.boss', 'artifact-dag.json');
    fs.mkdirSync(path.dirname(projectDagPath), { recursive: true });
    fs.writeFileSync(
      projectDagPath,
      JSON.stringify({
        version: '1.0.0',
        artifacts: {
          'custom.md': {
            inputs: [],
            agent: 'boss-pm',
            stage: 1,
            optional: false,
            description: 'Custom project artifact'
          }
        }
      }),
      'utf8'
    );

    const ready = getReadyArtifacts('test-feat', { cwd: tmpDir });
    expect(ready.map((item) => item.artifact)).toEqual(['custom.md']);
  });

  it('returns ready artifacts in deterministic order', () => {
    initPipeline('test-feat', { cwd: tmpDir });
    recordArtifact('test-feat', 'prd.md', 1, { cwd: tmpDir });
    const ready = getReadyArtifacts('test-feat', { cwd: tmpDir });
    expect(ready.map((item) => item.artifact)).toEqual(['architecture.md', 'ui-spec.md']);
  });

  it('exposes artifact status through the public runtime API', () => {
    initPipeline('test-feat', { cwd: tmpDir });

    const blocked = getArtifactStatus('test-feat', 'architecture.md', { cwd: tmpDir });
    expect(blocked.status).toBe('blocked');
    expect(blocked.missing).toEqual(['prd.md']);

    recordArtifact('test-feat', 'prd.md', 1, { cwd: tmpDir });
    const ready = getArtifactStatus('test-feat', 'architecture.md', { cwd: tmpDir });
    expect(ready.status).toBe('ready');
  });

  it('skips tech-review.md and tasks.md when skipReview is true', () => {
    initPipeline('test-feat', { cwd: tmpDir });
    const execPath = path.join(tmpDir, '.boss', 'test-feat', '.meta', 'execution.json');
    const data = JSON.parse(fs.readFileSync(execPath, 'utf8'));
    data.parameters.skipReview = true;
    data.stages['1'].artifacts = ['prd.md', 'architecture.md'];
    fs.writeFileSync(execPath, JSON.stringify(data, null, 2), 'utf8');

    const ready = getReadyArtifacts('test-feat', { cwd: tmpDir });
    const names = ready.map((item) => item.artifact);
    expect(names).not.toContain('tech-review.md');
    expect(names).not.toContain('tasks.md');
    expect(names).toContain('code');
  });

  it('rejects --dag without a value in the boss runtime wrapper', () => {
    const result = spawnSync(process.execPath, [BOSS_BIN, 'runtime', 'get-ready-artifacts', 'test-feat', '--ready', '--dag'], {
      cwd: tmpDir,
      encoding: 'utf8'
    });

    expect(result.status).not.toBe(0);
    expect(result.stderr).toMatch(/--dag 需要指定 path/);
  });
});
