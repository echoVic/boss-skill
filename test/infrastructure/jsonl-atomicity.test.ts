import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';

import { afterEach, describe, expect, it } from 'vitest';

import {
  appendLineSync,
  readJsonlTolerant,
} from '../../packages/boss-cli/src/infrastructure/fs.js';

let tmpDir: string | null = null;

function tmpFile(name = 'events.jsonl'): string {
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'boss-jsonl-'));
  return path.join(tmpDir, name);
}

afterEach(() => {
  if (tmpDir) {
    fs.rmSync(tmpDir, { recursive: true, force: true });
    tmpDir = null;
  }
});

describe('appendLineSync', () => {
  it('creates the file and appends a trailing newline', () => {
    const file = tmpFile();
    appendLineSync(file, '{"id":1}');
    expect(fs.readFileSync(file, 'utf8')).toBe('{"id":1}\n');
  });

  it('does not double the newline when one is already present', () => {
    const file = tmpFile();
    appendLineSync(file, '{"id":1}\n');
    appendLineSync(file, '{"id":2}');
    expect(fs.readFileSync(file, 'utf8')).toBe('{"id":1}\n{"id":2}\n');
  });

  it('appends in order across many calls', () => {
    const file = tmpFile();
    for (let i = 1; i <= 50; i += 1) appendLineSync(file, JSON.stringify({ id: i }));
    const ids = fs
      .readFileSync(file, 'utf8')
      .trim()
      .split('\n')
      .map((l) => (JSON.parse(l) as { id: number }).id);
    expect(ids).toEqual(Array.from({ length: 50 }, (_, i) => i + 1));
  });
});

describe('readJsonlTolerant', () => {
  it('parses well-formed JSONL', () => {
    const file = tmpFile();
    fs.writeFileSync(file, '{"id":1}\n{"id":2}\n');
    const { records, corruptTail } = readJsonlTolerant<{ id: number }>(file);
    expect(records.map((r) => r.id)).toEqual([1, 2]);
    expect(corruptTail).toBeUndefined();
  });

  it('returns empty for an empty file', () => {
    const file = tmpFile();
    fs.writeFileSync(file, '');
    expect(readJsonlTolerant(file)).toEqual({ records: [] });
  });

  it('tolerates a corrupt trailing line (crash mid-write) and reports it', () => {
    // 模拟原子追加中途崩溃：最后一行是半条 JSON
    const file = tmpFile();
    fs.writeFileSync(file, '{"id":1}\n{"id":2}\n{"id":3'); // 末行截断
    const { records, corruptTail } = readJsonlTolerant<{ id: number }>(file);
    expect(records.map((r) => r.id)).toEqual([1, 2]);
    expect(corruptTail).toBe('{"id":3');
  });

  it('throws when a NON-tail line is corrupt (tampering, not a crash)', () => {
    const file = tmpFile();
    fs.writeFileSync(file, '{"id":1}\n{bad}\n{"id":3}\n');
    expect(() => readJsonlTolerant(file)).toThrow(/非末行/);
  });

  it('append-then-read round-trips and a truncated tail is recoverable', () => {
    // 写 3 条，然后手工截断末行模拟崩溃，读取应恢复前 2 条
    const file = tmpFile();
    appendLineSync(file, JSON.stringify({ id: 1 }));
    appendLineSync(file, JSON.stringify({ id: 2 }));
    appendLineSync(file, JSON.stringify({ id: 3 }));
    const raw = fs.readFileSync(file, 'utf8');
    fs.writeFileSync(file, raw.slice(0, raw.length - 6)); // 砍掉末行尾部
    const { records } = readJsonlTolerant<{ id: number }>(file);
    expect(records.map((r) => r.id)).toEqual([1, 2]);
  });
});
