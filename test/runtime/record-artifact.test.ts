import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import * as runtime from '../../runtime/cli/lib/pipeline-runtime.js';

describe('recordArtifact', () => {
  let tmpDir: string;
  let cwd: string;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'boss-record-'));
    cwd = process.cwd();
    process.chdir(tmpDir);
    runtime.initPipeline('test-feat', { cwd: tmpDir });
  });

  afterEach(() => {
    process.chdir(cwd);
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it('appends ArtifactRecorded and materializes the artifact list', () => {
    const execution = runtime.recordArtifact('test-feat', 'prd.md', 1, { cwd: tmpDir });

    expect(execution.stages['1']?.artifacts.includes('prd.md')).toBe(true);

    const eventsPath = path.join(tmpDir, '.boss', 'test-feat', '.meta', 'events.jsonl');
    const events = fs.readFileSync(eventsPath, 'utf8').trim().split('\n');
    expect(JSON.parse(events.at(-1) ?? '{}').type).toBe('ArtifactRecorded');
  });

  it('rejects non-integer stages', () => {
    expect(() => {
      runtime.recordArtifact('test-feat', 'prd.md', 1.5, { cwd: tmpDir });
    }).toThrow(/stage 必须是整数/);
  });

  it('rejects out-of-range stages', () => {
    expect(() => {
      runtime.recordArtifact('test-feat', 'prd.md', 0, { cwd: tmpDir });
    }).toThrow(/stage 必须是 1-4/);
  });
});
