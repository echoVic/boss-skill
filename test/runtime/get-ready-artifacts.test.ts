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
} from '../../src/runtime/cli/lib/pipeline-runtime.js';

const REPO_ROOT = path.resolve(import.meta.dirname, '..', '..');

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

  it('rejects --dag without a value in the dist CLI wrapper', () => {
    const cliPath = path.join(REPO_ROOT, 'dist', 'runtime', 'cli', 'get-ready-artifacts.js');
    const result = spawnSync(process.execPath, [cliPath, 'test-feat', '--ready', '--dag'], {
      cwd: tmpDir,
      encoding: 'utf8'
    });

    expect(result.status).not.toBe(0);
    expect(result.stderr).toMatch(/--dag 需要指定 path/);
  });
});
