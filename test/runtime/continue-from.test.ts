import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {
  initPipeline,
  skipUpTo,
  getReadyArtifacts
} from '../../src/runtime/cli/lib/pipeline-runtime.js';

describe('skipUpTo (continue-from artifact)', () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'boss-continue-'));
    initPipeline('test-feat', { cwd: tmpDir });
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it('skipUpTo("prd.md") marks prd.md and design-brief as skipped', () => {
    const skipped = skipUpTo('test-feat', 'prd.md', { cwd: tmpDir });
    expect(skipped).toContain('prd.md');
    expect(skipped).toContain('design-brief');
  });

  it('after skipUpTo("prd.md"), architecture.md and ui-spec.md are ready', () => {
    skipUpTo('test-feat', 'prd.md', { cwd: tmpDir });
    const ready = getReadyArtifacts('test-feat', { cwd: tmpDir });
    const names = ready.map((r: any) => r.artifact);
    expect(names).toContain('architecture.md');
    expect(names).toContain('ui-spec.md');
    expect(names).not.toContain('prd.md');
  });

  it('skipUpTo("architecture.md") marks design-brief + prd.md + architecture.md', () => {
    const skipped = skipUpTo('test-feat', 'architecture.md', { cwd: tmpDir });
    expect(skipped).toContain('design-brief');
    expect(skipped).toContain('prd.md');
    expect(skipped).toContain('architecture.md');
  });

  it('skipUpTo("tasks.md") marks entire upstream chain', () => {
    const skipped = skipUpTo('test-feat', 'tasks.md', { cwd: tmpDir });
    expect(skipped).toContain('prd.md');
    expect(skipped).toContain('architecture.md');
    expect(skipped).toContain('ui-spec.md');
    expect(skipped).toContain('tech-review.md');
    expect(skipped).toContain('tasks.md');
  });

  it('throws for invalid artifact name', () => {
    expect(() => skipUpTo('test-feat', 'nonexistent.md', { cwd: tmpDir }))
      .toThrow(/DAG 中未定义产物/);
  });

  it('handles already-completed artifacts without duplicating events', () => {
    skipUpTo('test-feat', 'prd.md', { cwd: tmpDir });
    // Second skip should not error
    const skipped = skipUpTo('test-feat', 'prd.md', { cwd: tmpDir });
    expect(skipped).toContain('prd.md');

    // Check events: should only have 1 ArtifactRecorded for prd.md
    const eventsPath = path.join(tmpDir, '.boss', 'test-feat', '.meta', 'events.jsonl');
    const events = fs.readFileSync(eventsPath, 'utf8').trim().split('\n')
      .map(line => JSON.parse(line))
      .filter(e => e.type === 'ArtifactRecorded' && e.data.artifact === 'prd.md');
    expect(events).toHaveLength(1);
  });
});
