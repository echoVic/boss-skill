import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import {
  initPipeline,
  recordArtifact,
  updateStage
} from '../../packages/boss-cli/src/runtime/application/pipeline.js';

describe('concurrent append to events.jsonl', () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'boss-concurrent-'));
    initPipeline('conc-feature', { cwd: tmpDir });
    updateStage('conc-feature', 1, 'running', { cwd: tmpDir });
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true, maxRetries: 5, retryDelay: 200 });
  });

  function eventsFile(): string {
    return path.join(tmpDir, '.boss', 'conc-feature', '.meta', 'events.jsonl');
  }

  function countEvents(): number {
    const raw = fs.readFileSync(eventsFile(), 'utf8').trim();
    return raw.split('\n').filter(Boolean).length;
  }

  function validateAllEventsAreValidJson(): boolean {
    const raw = fs.readFileSync(eventsFile(), 'utf8').trim();
    for (const line of raw.split('\n').filter(Boolean)) {
      try {
        JSON.parse(line);
      } catch {
        return false;
      }
    }
    return true;
  }

  it('sequential rapid writes produce valid JSONL with no corruption', () => {
    const baseCount = countEvents();
    const N = 20;

    for (let i = 0; i < N; i++) {
      // Create the artifact file so recordArtifact can find it
      const artifactName = `artifact-${i}.md`;
      const artifactPath = path.join(tmpDir, '.boss', 'conc-feature', artifactName);
      fs.writeFileSync(artifactPath, `# Artifact ${i}\n`, 'utf8');
      recordArtifact('conc-feature', artifactName, 1, { cwd: tmpDir });
    }

    // All N artifact events should be appended
    const finalCount = countEvents();
    expect(finalCount).toBe(baseCount + N);

    // Every line should be valid JSON
    expect(validateAllEventsAreValidJson()).toBe(true);
  });

  it('concurrent Promise.all writes do not corrupt the events file', async () => {
    const baseCount = countEvents();
    const N = 10;

    // Pre-create artifact files
    for (let i = 0; i < N; i++) {
      const artifactName = `par-${i}.md`;
      const artifactPath = path.join(tmpDir, '.boss', 'conc-feature', artifactName);
      fs.writeFileSync(artifactPath, `# Par ${i}\n`, 'utf8');
    }

    // Run writes concurrently via Promise.all
    // Since recordArtifact uses sync fs, these are interleaved at the event loop level
    const promises = Array.from({ length: N }, (_, i) =>
      Promise.resolve().then(() =>
        recordArtifact('conc-feature', `par-${i}.md`, 1, { cwd: tmpDir })
      )
    );

    await Promise.all(promises);

    const finalCount = countEvents();
    expect(finalCount).toBe(baseCount + N);
    expect(validateAllEventsAreValidJson()).toBe(true);
  });

  it('event ids remain monotonically increasing after rapid writes', () => {
    const N = 5;
    for (let i = 0; i < N; i++) {
      const artifactName = `seq-${i}.md`;
      fs.writeFileSync(
        path.join(tmpDir, '.boss', 'conc-feature', artifactName),
        `# ${i}\n`,
        'utf8'
      );
      recordArtifact('conc-feature', artifactName, 1, { cwd: tmpDir });
    }

    const raw = fs.readFileSync(eventsFile(), 'utf8').trim();
    const ids = raw.split('\n').filter(Boolean).map(line => (JSON.parse(line) as { id: number }).id);

    for (let i = 1; i < ids.length; i++) {
      expect(ids[i]).toBeGreaterThan(ids[i - 1]);
    }
  });
});
