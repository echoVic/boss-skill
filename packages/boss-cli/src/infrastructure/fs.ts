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
  const fd = fs.openSync(filePath, 'a');
  try {
    fs.writeSync(fd, payload);
    fs.fsyncSync(fd);
  } finally {
    fs.closeSync(fd);
  }
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
      throw new Error(
        `第 ${index + 1} 行不是合法 JSON（非末行，疑似损坏或篡改）: ${(err as Error).message}`,
      );
    }
  }
  return { records };
}
