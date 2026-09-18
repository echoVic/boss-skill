import { spawn } from 'node:child_process';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { pathToFileURL } from 'node:url';

import { afterEach, describe, expect, it } from 'vitest';

import {
  appendLineSync,
  readJsonlTolerant,
} from '../../packages/boss-cli/src/infrastructure/fs.js';
import { ensureBuilt } from '../helpers/run-cli.js';

const REPO_ROOT = path.resolve(import.meta.dirname, '..', '..');
const DIST_FS = path.join(REPO_ROOT, 'packages', 'boss-cli', 'dist', 'infrastructure', 'fs.js');

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

function ids(file: string): number[] {
  return readJsonlTolerant<{ id: number }>(file).records.map((r) => r.id);
}

/**
 * 崩溃残留：进程在追加中途被杀，文件末尾留下一条没有结尾换行的半行。
 *
 * 契约：appendLineSync 绝不删除任何字节（并行写入者不能互相截掉已提交的记录，
 * Windows 上 O_APPEND 句柄也不允许 ftruncate），而是先补一个换行把残留隔离成
 * 独立的一行，再追加新记录；readJsonlTolerant 跳过残留行，事件流始终可读。
 */
describe('appendLineSync after a crash-truncated tail', () => {
  it('isolates the residue on its own line instead of gluing the new record onto it', () => {
    const file = tmpFile();
    fs.writeFileSync(file, '{"id":1}\n{"id":2}\n{"id":3'); // 崩溃残留：无结尾换行的半行
    appendLineSync(file, JSON.stringify({ id: 3 }));
    expect(fs.readFileSync(file, 'utf8')).toBe('{"id":1}\n{"id":2}\n{"id":3\n{"id":3}\n');
  });

  it('makes the event appended after residue independently readable', () => {
    const file = tmpFile();
    fs.writeFileSync(file, '{"id":1}\n{"id":2}\n{"id":3');
    appendLineSync(file, JSON.stringify({ id: 3 }));
    const result = readJsonlTolerant<{ id: number }>(file);
    expect(result.records.map((r) => r.id)).toEqual([1, 2, 3]);
    expect(result.corruptLines).toEqual([{ line: 3, text: '{"id":3' }]);
  });

  it('keeps the file readable after two appends following residue', () => {
    const file = tmpFile();
    fs.writeFileSync(file, '{"id":1}\n{"id":2}\n{"id":3');
    appendLineSync(file, JSON.stringify({ id: 3 }));
    appendLineSync(file, JSON.stringify({ id: 4 }));
    expect(() => readJsonlTolerant(file)).not.toThrow();
    expect(ids(file)).toEqual([1, 2, 3, 4]);
  });

  it('never deletes a complete last line that merely lacks its newline', () => {
    // 完整 JSON 但缺换行（编辑器保存、掉电前只差一个字节）：读取端把它算作记录，
    // 写入端也必须保留它，否则 id 会跳号后重复。
    const file = tmpFile();
    fs.writeFileSync(file, '{"id":1}\n{"id":2}');
    appendLineSync(file, JSON.stringify({ id: 3 }));
    expect(fs.readFileSync(file, 'utf8')).toBe('{"id":1}\n{"id":2}\n{"id":3}\n');
    expect(ids(file)).toEqual([1, 2, 3]);
  });

  it('handles a whole-file residue with no newline anywhere', () => {
    const file = tmpFile();
    fs.writeFileSync(file, '{"id":1');
    appendLineSync(file, JSON.stringify({ id: 1 }));
    expect(fs.readFileSync(file, 'utf8')).toBe('{"id":1\n{"id":1}\n');
    expect(ids(file)).toEqual([1]);
  });

  it('handles residue cut inside a multi-byte UTF-8 character', () => {
    const file = tmpFile();
    const full = Buffer.from('{"id":1,"n":"中"}\n', 'utf8');
    const partial = Buffer.from('{"id":2,"n":"中', 'utf8').subarray(0, -1); // 停在多字节字符中途
    fs.writeFileSync(file, Buffer.concat([full, partial]));
    appendLineSync(file, JSON.stringify({ id: 2, n: '中' }));
    const result = readJsonlTolerant<{ id: number; n: string }>(file);
    expect(result.records).toEqual([
      { id: 1, n: '中' },
      { id: 2, n: '中' },
    ]);
    expect(result.corruptLines).toHaveLength(1);
  });

  it('does not add a leading newline to an empty or new file', () => {
    const file = tmpFile();
    appendLineSync(file, JSON.stringify({ id: 1 }));
    expect(fs.readFileSync(file, 'utf8')).toBe('{"id":1}\n');
    fs.writeFileSync(file, '');
    appendLineSync(file, JSON.stringify({ id: 1 }));
    expect(fs.readFileSync(file, 'utf8')).toBe('{"id":1}\n');
  });

  it('loses no record when several processes append concurrently after residue', async () => {
    // 并行子 Agent 各自跑 `boss runtime report-agent-status`，即多个进程同时追加同一份
    // events.jsonl。「先截断残留再追加」的实现会让慢的一方截掉快的一方已提交的记录。
    ensureBuilt('packages/boss-cli/dist/bin/boss.js');
    const file = tmpFile();
    fs.writeFileSync(file, '{"id":1}\n{"id":2}\n{"id":3');
    const writers = 8;
    await Promise.all(
      Array.from({ length: writers }, (_, index) => {
        const script = `import(${JSON.stringify(pathToFileURL(DIST_FS).href)}).then((m) => m.appendLineSync(${JSON.stringify(file)}, JSON.stringify({ id: ${100 + index} })))`;
        return new Promise<void>((resolve, reject) => {
          const child = spawn(process.execPath, ['-e', script], {
            stdio: ['ignore', 'ignore', 'pipe'],
          });
          let stderr = '';
          child.stderr.on('data', (chunk) => {
            stderr += String(chunk);
          });
          child.on('error', reject);
          child.on('exit', (code) =>
            code === 0 ? resolve() : reject(new Error(`writer ${index} exited ${code}: ${stderr}`)),
          );
        });
      }),
    );
    const got = ids(file).sort((a, b) => a - b);
    expect(got).toEqual([1, 2, ...Array.from({ length: writers }, (_, i) => 100 + i)]);
  });
});
