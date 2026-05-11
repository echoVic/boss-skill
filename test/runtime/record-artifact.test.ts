import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import * as runtime from '../../packages/boss-cli/src/runtime/application/pipeline.js';

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

  it('recordArtifacts does not append partial events when an artifact backup fails', () => {
    const eventsPath = path.join(tmpDir, '.boss', 'test-feat', '.meta', 'events.jsonl');
    const featureDir = path.join(tmpDir, '.boss', 'test-feat');
    fs.writeFileSync(path.join(featureDir, 'prd.html'), '<!doctype html>\n', 'utf8');
    runtime.recordArtifact('test-feat', 'prd.html', 1, { cwd: tmpDir });
    const eventsBefore = fs.readFileSync(eventsPath, 'utf8');
    fs.mkdirSync(path.join(featureDir, '.versions', 'prd.html.v1'), { recursive: true });

    expect(() => {
      runtime.recordArtifacts('test-feat', ['prd.md', 'prd.html'], 1, { cwd: tmpDir });
    }).toThrow();

    expect(fs.readFileSync(eventsPath, 'utf8')).toBe(eventsBefore);
  });

  it('recordArtifacts does not run beforeAppend side effects when artifact backup fails', () => {
    const featureDir = path.join(tmpDir, '.boss', 'test-feat');
    const htmlPath = path.join(tmpDir, '.boss', 'test-feat', 'prd.html');
    fs.writeFileSync(htmlPath, 'old html\n', 'utf8');
    runtime.recordArtifact('test-feat', 'prd.html', 1, { cwd: tmpDir });
    fs.mkdirSync(path.join(featureDir, '.versions', 'prd.html.v1'), { recursive: true });
    let beforeAppendRan = false;

    expect(() => {
      runtime.recordArtifacts('test-feat', ['prd.md', 'prd.html'], 1, {
        cwd: tmpDir,
        beforeAppend: () => {
          beforeAppendRan = true;
          fs.writeFileSync(htmlPath, 'new html\n', 'utf8');
        }
      });
    }).toThrow();

    expect(beforeAppendRan).toBe(false);
    expect(fs.readFileSync(htmlPath, 'utf8')).toBe('old html\n');
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
