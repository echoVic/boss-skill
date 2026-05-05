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
