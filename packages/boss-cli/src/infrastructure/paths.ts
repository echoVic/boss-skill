import * as path from 'node:path';
import { fileURLToPath } from 'node:url';

export function dirnameFromImportMeta(importMetaUrl: string): string {
  return path.dirname(fileURLToPath(importMetaUrl));
}

export function packageRootFromImportMeta(importMetaUrl: string, ancestorLevels: number): string {
  if (!Number.isInteger(ancestorLevels) || ancestorLevels < 0) {
    throw new Error(`Invalid package root depth: ${ancestorLevels}`);
  }
  return path.resolve(dirnameFromImportMeta(importMetaUrl), ...Array.from({ length: ancestorLevels }, () => '..'));
}

export function resolvePackagePath(importMetaUrl: string, ancestorLevels: number, ...segments: string[]): string {
  return path.join(packageRootFromImportMeta(importMetaUrl, ancestorLevels), ...segments);
}

export function resolveInside(baseDir: string, inputPath: string): string {
  return path.isAbsolute(inputPath) ? inputPath : path.resolve(baseDir, inputPath);
}
