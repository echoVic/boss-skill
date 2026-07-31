import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';

import { afterEach, describe, expect, it } from 'vitest';

import {
  appendLineSync,
  readJsonlTolerant
} from '../../packages/boss-cli/src/infrastructure/fs.js';

let tmpDir: string | null = null;
function tmpFile(): string {
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'boss-append-crash-'));
  return path.join(tmpDir, 'events.jsonl');
}
afterEach(() => {
  if (tmpDir) {
    fs.rmSync(tmpDir, { recursive: true, force: true });
    tmpDir = null;
  }
});

/**
 * DEFECT PROOF — appendLineSync does not repair a missing trailing newline.
 *
 * The documented atomicity contract (infrastructure/fs.ts) states that a
 * process killed mid-append leaves "at most one incomplete trailing line"
 * which is "recoverable (treated as if the event was never written)". The
 * recovery path (state.ts#appendEvent) derives the next id from the parseable
 * records and appends the new event with appendLineSync.
 *
 * A real crash mid-append leaves the file WITHOUT a trailing newline. Because
 * appendLineSync only ensures the line it writes ends with '\n' (it never
 * checks whether the existing file content is newline-terminated), the new
 * event is glued onto the truncated tail, producing a single corrupt line.
 * The freshly-written event is then unreadable, and once one more event is
 * appended the corrupt line is no longer the tail — readJsonlTolerant THROWS,
 * making the entire events.jsonl (the event-sourcing source of truth)
 * permanently unreadable. This is the exact failure mode the design claims to
 * prevent.
 *
 * These tests are EXPECTED TO FAIL against the current implementation; they
 * pin the correct behavior a fix must satisfy (appendLineSync should ensure
 * the previous content is newline-terminated before appending).
 */
describe('appendLineSync recovery after a crash-truncated tail', () => {
  it('an event appended after a truncated tail must be independently readable', () => {
    const file = tmpFile();
    // Crash mid-append: incomplete JSON fragment, no trailing newline.
    fs.writeFileSync(file, '{"id":1}\n{"id":2}\n{"id":3');

    const { records } = readJsonlTolerant<{ id: number }>(file);
    appendLineSync(file, JSON.stringify({ id: records.length + 1 })); // id = 3

    const after = readJsonlTolerant<{ id: number }>(file);
    expect(after.records.map((r) => r.id)).toContain(3);
  });

  it('two recovery appends must NOT make events.jsonl unreadable', () => {
    const file = tmpFile();
    fs.writeFileSync(file, '{"id":1}\n{"id":2}\n{"id":3'); // crash-truncated tail

    appendLineSync(file, JSON.stringify({ id: 3 }));
    appendLineSync(file, JSON.stringify({ id: 4 }));

    // The corrupt glued line is no longer the tail; a tolerant read must not throw.
    expect(() => readJsonlTolerant(file)).not.toThrow();
  });
});
