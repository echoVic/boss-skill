import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';

import { afterEach, describe, expect, it } from 'vitest';

import {
  appendLineSync,
  readJsonlTolerant
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

  it('truncates a crash-residue partial tail (no trailing newline) before appending', () => {
    // 模拟崩溃残留：文件末行是无结尾换行的半条 JSON。下一次 append 必须先截断该半行，
    // 否则它会变成中间损坏行，令后续读取整表不可读。
    const file = tmpFile();
    fs.writeFileSync(file, '{"id":1}\n{"id":2}\n{"id":3'); // 截断末行，无换行
    appendLineSync(file, JSON.stringify({ id: 3 }));
    expect(fs.readFileSync(file, 'utf8')).toBe('{"id":1}\n{"id":2}\n{"id":3}\n');
  });

  it('does not prepend or truncate on an empty (freshly created) file', () => {
    const file = tmpFile();
    appendLineSync(file, JSON.stringify({ id: 1 }));
    expect(fs.readFileSync(file, 'utf8')).toBe('{"id":1}\n');
  });

  it('truncates a whole-file crash residue with no newline anywhere', () => {
    // 尾态：整个文件就是一条无换行的崩溃半行（offsetAfterLastNewline 必须返回 0）。
    const file = tmpFile();
    fs.writeFileSync(file, '{"id":1'); // 全文件无换行
    appendLineSync(file, JSON.stringify({ id: 1 }));
    expect(fs.readFileSync(file, 'utf8')).toBe('{"id":1}\n');
    expect(readJsonlTolerant<{ id: number }>(file).records.map((r) => r.id)).toEqual([1]);
  });

  it('truncates a tail cut mid multi-byte UTF-8 char without corrupting prior lines', () => {
    // 尾态：崩溃发生在多字节 UTF-8 字符中途，末字节是 continuation byte（绝不为 0x0a）。
    // 截断必须落在最后一个换行符处，不得破坏前面完整的多字节行。
    const file = tmpFile();
    const full = Buffer.from('{"id":1,"n":"中"}\n', 'utf8');
    const partial = Buffer.from('{"id":2,"n":"中', 'utf8'); // 末尾停在多字节字符中途
    fs.writeFileSync(file, Buffer.concat([full, partial]));
    appendLineSync(file, JSON.stringify({ id: 2, n: '中' }));
    const result = readJsonlTolerant<{ id: number; n: string }>(file);
    expect(result.records).toEqual([{ id: 1, n: '中' }, { id: 2, n: '中' }]);
    expect(result.corruptTail).toBeUndefined();
  });

  it('truncates a complete-JSON tail lacking a trailing newline (un-fsynced residue)', () => {
    // 尾态：末行是完整 JSON 但缺结尾换行——本函数保证已提交行必以 '\n' 结尾，
    // 故无换行的末行一律视为崩溃残留并截断，避免与后续写入粘连成损坏中间行。
    const file = tmpFile();
    fs.writeFileSync(file, '{"id":1}\n{"id":2}'); // 完整 JSON 但无结尾换行
    appendLineSync(file, JSON.stringify({ id: 3 }));
    expect(fs.readFileSync(file, 'utf8')).toBe('{"id":1}\n{"id":3}\n');
    expect(() => readJsonlTolerant(file)).not.toThrow();
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

  it('stays readable after crash residue is appended over twice (regression)', () => {
    // 复现原缺陷：崩溃残留无换行半行 → 追加一条 → 再追加一条。
    // 旧实现会把第一次追加粘到半行上，第二次追加后该损坏行变成中间行、
    // readJsonlTolerant 判「非末行损坏」抛错，整个事件流永久不可读。
    // 修复后：首次追加会截断崩溃半行，两条新记录接在完整行之后，整表始终可读。
    const file = tmpFile();
    fs.writeFileSync(file, '{"id":1}\n{"id":2}\n{"id":3'); // 崩溃残留：截断末行

    // 恢复运行：跳过损坏尾行后继续追加（模拟 state.appendEvent 的行为）
    appendLineSync(file, JSON.stringify({ id: 3 }));
    appendLineSync(file, JSON.stringify({ id: 4 }));

    // 关键断言：整表仍可读，不因中间损坏行抛错；崩溃半行已被截断替换
    expect(() => readJsonlTolerant<{ id: number }>(file)).not.toThrow();
    const { records } = readJsonlTolerant<{ id: number }>(file);
    expect(records.map((r) => r.id)).toEqual([1, 2, 3, 4]);
  });
});
