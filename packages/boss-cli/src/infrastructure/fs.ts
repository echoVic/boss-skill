import * as fs from 'node:fs';
import * as path from 'node:path';

export function pathExists(filePath: string): boolean {
  return fs.existsSync(filePath);
}

export function readTextFile(filePath: string): string {
  return fs.readFileSync(filePath, 'utf8');
}

export function readJsonFile<T>(filePath: string): T {
  return JSON.parse(readTextFile(filePath)) as T;
}

export function writeJsonFile(filePath: string, data: unknown): void {
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2) + '\n', 'utf8');
}

export function ensureDir(dirPath: string): void {
  fs.mkdirSync(dirPath, { recursive: true });
}

export function copyDirectory(src: string, dest: string, exclude: string[] = []): void {
  ensureDir(dest);
  for (const entry of fs.readdirSync(src, { withFileTypes: true })) {
    if (exclude.includes(entry.name)) continue;
    const sourcePath = path.join(src, entry.name);
    const destinationPath = path.join(dest, entry.name);
    if (entry.isDirectory()) {
      copyDirectory(sourcePath, destinationPath, exclude);
    } else {
      fs.copyFileSync(sourcePath, destinationPath);
    }
  }
}

/**
 * 原子追加一行到 append-only 日志（如 events.jsonl）。
 *
 * 用 O_APPEND 打开：内核保证每次 write 定位到当前文件末尾，多个写入者不会互相
 * 覆盖。写完 fsync 落盘再关闭，使「事件已记录」在崩溃后仍成立——这是事件溯源
 * 真相源的最低要求。line 不含结尾换行时自动补上。
 */
export function appendLineSync(filePath: string, line: string): void {
  const payload = line.endsWith('\n') ? line : `${line}\n`;
  // 用 'a+'（O_APPEND | O_RDWR）而非 'a'：写入仍由内核定位到末尾，同时允许读取与
  // ftruncate，以便在追加前清理崩溃残留的半行。
  const fd = fs.openSync(filePath, 'a+');
  try {
    // 每条已提交记录都以 '\n' 结尾（本函数保证），故文件末字节非 '\n' 唯一地标识
    // 崩溃残留的半行——一条未写完的事件，readJsonlTolerant 本就视其「从未写入」。
    // 若不清理直接 append，这半行会变成中间损坏行，下次读取即按「非末行损坏」抛错，
    // 整个事件流永久不可读。故追加前把该半行截断掉，保证新记录接在完整行之后。
    const { size } = fs.fstatSync(fd);
    if (size > 0 && readLastByte(fd, size) !== 0x0a) {
      fs.ftruncateSync(fd, offsetAfterLastNewline(fd, size));
    }
    fs.writeSync(fd, payload);
    fs.fsyncSync(fd);
  } finally {
    fs.closeSync(fd);
  }
}

/** 读取文件最后一个字节。 */
function readLastByte(fd: number, size: number): number {
  const tail = Buffer.alloc(1);
  fs.readSync(fd, tail, 0, 1, size - 1);
  return tail[0]!;
}

/**
 * 返回「最后一个换行符之后」的字节偏移——即需要保留的完整内容长度。
 * 全文件无换行（整体就是一条崩溃半行）时返回 0。从末尾按块反向扫描，
 * 避免为定位换行而整文件读入。
 */
function offsetAfterLastNewline(fd: number, size: number): number {
  const CHUNK = 65536;
  const buffer = Buffer.alloc(Math.min(CHUNK, size));
  let end = size;
  while (end > 0) {
    const readLength = Math.min(CHUNK, end);
    const start = end - readLength;
    fs.readSync(fd, buffer, 0, readLength, start);
    const newlineIndex = buffer.subarray(0, readLength).lastIndexOf(0x0a);
    if (newlineIndex !== -1) {
      return start + newlineIndex + 1;
    }
    end = start;
  }
  return 0;
}

export interface JsonlReadResult<T> {
  records: T[];
  /** 被跳过的损坏尾行原文（正常为 undefined）。用于告警，不影响已解析记录。 */
  corruptTail?: string;
}

/**
 * 读取 JSONL 文件，容忍**尾行**损坏。
 *
 * 进程在原子追加中途被杀，最多只会留下一条不完整的**末行**；中间行不可能损坏。
 * 因此：末行解析失败时跳过并记入 corruptTail（可恢复，视作该事件从未写入）；
 * 任何**非末行**解析失败则抛错——那不是崩溃残留，而是真正的篡改/损坏，不应静默放过。
 */
export function readJsonlTolerant<T = unknown>(filePath: string): JsonlReadResult<T> {
  const raw = fs.readFileSync(filePath, 'utf8');
  const lines = raw.split('\n').filter((line) => line.length > 0);
  if (lines.length === 0) return { records: [] };

  const records: T[] = [];
  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index]!;
    try {
      records.push(JSON.parse(line) as T);
    } catch (err) {
      const isLastLine = index === lines.length - 1;
      if (isLastLine) {
        return { records, corruptTail: line };
      }
      throw new Error(`第 ${index + 1} 行不是合法 JSON（非末行，疑似损坏或篡改）: ${(err as Error).message}`);
    }
  }
  return { records };
}
