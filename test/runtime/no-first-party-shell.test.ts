import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

const REPO_ROOT = path.resolve(import.meta.dirname, '..', '..');

function walkFiles(dir: string, result: string[] = []): string[] {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (entry.name === '.git' || entry.name === 'node_modules') continue;
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      walkFiles(fullPath, result);
    } else {
      result.push(fullPath);
    }
  }
  return result;
}

describe('TypeScript CLI architecture', () => {
  it('does not keep first-party shell scripts as implementation surface', () => {
    const shellScripts = walkFiles(REPO_ROOT)
      .filter((file) => file.endsWith('.sh'))
      .map((file) => path.relative(REPO_ROOT, file))
      .filter((file) => !file.startsWith('docs/'))
      .filter((file) => !file.startsWith('test/'))
      .filter((file) => !file.startsWith('harness/plugins/'));

    expect(shellScripts).toEqual([]);
  });

  it('routes project, artifact, and pack commands through TypeScript modules', () => {
    const bossSource = fs.readFileSync(path.join(REPO_ROOT, 'packages', 'boss-cli', 'src', 'bin', 'boss.ts'), 'utf8');

    expect(bossSource).not.toContain('runBashScript');
    expect(bossSource).not.toContain('.sh');
    expect(bossSource).toContain("import('../commands/project.js')");
    expect(bossSource).toContain("import('../commands/artifact.js')");
    expect(bossSource).toContain("import('../commands/packs.js')");
  });
});
