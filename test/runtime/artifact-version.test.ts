import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {
  initPipeline,
  recordArtifact,
  getArtifactVersion,
  collectCompletedArtifactsVersioned
} from '../../src/runtime/cli/lib/pipeline-runtime.js';

describe('artifact version control', () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'boss-ver-'));
    initPipeline('test-feat', { cwd: tmpDir });
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it('first record of artifact is version 1', () => {
    recordArtifact('test-feat', 'prd.md', 1, { cwd: tmpDir });
    const version = getArtifactVersion('test-feat', 'prd.md', { cwd: tmpDir });
    expect(version).toBe(1);
  });

  it('second record of same artifact is version 2', () => {
    recordArtifact('test-feat', 'prd.md', 1, { cwd: tmpDir });
    recordArtifact('test-feat', 'prd.md', 1, { cwd: tmpDir });
    const version = getArtifactVersion('test-feat', 'prd.md', { cwd: tmpDir });
    expect(version).toBe(2);
  });

  it('version is included in ArtifactRecorded event data', () => {
    recordArtifact('test-feat', 'prd.md', 1, { cwd: tmpDir });
    recordArtifact('test-feat', 'prd.md', 1, { cwd: tmpDir });

    const eventsPath = path.join(tmpDir, '.boss', 'test-feat', '.meta', 'events.jsonl');
    const events = fs.readFileSync(eventsPath, 'utf8').trim().split('\n')
      .map(line => JSON.parse(line))
      .filter(e => e.type === 'ArtifactRecorded');

    expect(events[0].data.version).toBe(1);
    expect(events[1].data.version).toBe(2);
  });

  it('getArtifactVersion returns 0 for unrecorded artifact', () => {
    const version = getArtifactVersion('test-feat', 'architecture.md', { cwd: tmpDir });
    expect(version).toBe(0);
  });

  it('second record backs up previous version to .versions/', () => {
    // Simulate real workflow: write file, record, then overwrite, record again
    const artifactPath = path.join(tmpDir, '.boss', 'test-feat', 'prd.md');
    fs.writeFileSync(artifactPath, '# PRD v1\n', 'utf8');
    recordArtifact('test-feat', 'prd.md', 1, { cwd: tmpDir });

    // When second record is called, the file on disk is backed up
    // In real usage, agent has already written new content before calling recordArtifact
    // But backup captures whatever is on disk at that moment
    recordArtifact('test-feat', 'prd.md', 1, { cwd: tmpDir });

    const backupPath = path.join(tmpDir, '.boss', 'test-feat', '.versions', 'prd.md.v1');
    expect(fs.existsSync(backupPath)).toBe(true);
    // Backup captured the content that was on disk at time of 2nd record
    expect(fs.readFileSync(backupPath, 'utf8')).toBe('# PRD v1\n');
  });

  it('collectCompletedArtifactsVersioned returns Map<string, number>', () => {
    recordArtifact('test-feat', 'prd.md', 1, { cwd: tmpDir });
    recordArtifact('test-feat', 'prd.md', 1, { cwd: tmpDir });
    recordArtifact('test-feat', 'architecture.md', 1, { cwd: tmpDir });

    const map = collectCompletedArtifactsVersioned('test-feat', { cwd: tmpDir });
    expect(map.get('prd.md')).toBe(2);
    expect(map.get('architecture.md')).toBe(1);
    expect(map.has('tasks.md')).toBe(false);
  });
});
