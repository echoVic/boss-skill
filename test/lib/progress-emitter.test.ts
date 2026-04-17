import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { emitProgress } from '../../src/scripts/lib/progress-emitter.js';

describe('progress emitter runtime', () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'boss-progress-'));
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it('emits progress events to progress.jsonl with feature and timestamp fields', () => {
    emitProgress(tmpDir, 'test-feat', {
      type: 'stage-start',
      data: { stage: 1 }
    });

    const progressFile = path.join(tmpDir, '.boss', 'test-feat', '.meta', 'progress.jsonl');
    const lines = fs.readFileSync(progressFile, 'utf8').trim().split('\n');
    const event = JSON.parse(lines[0] ?? '{}') as {
      type: string;
      feature: string;
      timestamp: string;
      data: { stage: number };
    };

    expect(fs.existsSync(progressFile)).toBe(true);
    expect(lines).toHaveLength(1);
    expect(event.type).toBe('stage-start');
    expect(event.feature).toBe('test-feat');
    expect(event.data.stage).toBe(1);
    expect(event.timestamp).toMatch(/Z$/);
  });

  it('appends multiple events and defaults missing data to an empty object', () => {
    emitProgress(tmpDir, 'test-feat', { type: 'agent-start', data: { agent: 'boss-pm' } });
    emitProgress(tmpDir, 'test-feat', { type: 'custom-event' });

    const progressFile = path.join(tmpDir, '.boss', 'test-feat', '.meta', 'progress.jsonl');
    const lines = fs.readFileSync(progressFile, 'utf8').trim().split('\n');

    expect(lines).toHaveLength(2);
    expect(JSON.parse(lines[0] ?? '{}')).toMatchObject({ type: 'agent-start' });
    expect(JSON.parse(lines[1] ?? '{}')).toMatchObject({
      type: 'custom-event',
      data: {}
    });
  });

  it('creates the meta directory when it does not exist yet', () => {
    emitProgress(path.join(tmpDir, 'nested'), 'new-feat', {
      type: 'stage-start',
      data: {}
    });

    expect(
      fs.existsSync(path.join(tmpDir, 'nested', '.boss', 'new-feat', '.meta', 'progress.jsonl'))
    ).toBe(true);
  });
});
