import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

const REPO_ROOT = path.resolve(import.meta.dirname, '..', '..');

function walkFiles(dir: string): string[] {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  const files: string[] = [];
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      files.push(...walkFiles(fullPath));
    } else if (entry.isFile()) {
      files.push(fullPath);
    }
  }
  return files;
}

describe('agent CLI safety source contract', () => {
  it('does not use console table, colors, or progress UI in boss cli source', () => {
    const sourceFiles = walkFiles(path.join(REPO_ROOT, 'packages', 'boss-cli', 'src')).filter((file) =>
      file.endsWith('.ts')
    );

    for (const file of sourceFiles) {
      const source = fs.readFileSync(file, 'utf8');
      expect(source, path.relative(REPO_ROOT, file)).not.toContain('console.table');
      expect(source, path.relative(REPO_ROOT, file)).not.toMatch(/\x1b\[/);
      expect(source, path.relative(REPO_ROOT, file)).not.toContain('ora(');
    }
  });

  it('routes command entrypoint errors through cli contract helpers', () => {
    const cliFiles = [
      path.join(REPO_ROOT, 'packages', 'boss-cli', 'src', 'bin', 'boss.ts'),
      ...walkFiles(path.join(REPO_ROOT, 'packages', 'boss-cli', 'src', 'commands'))
    ].filter(
      (file) =>
        file.endsWith('.ts') &&
        !file.includes(`${path.sep}lib${path.sep}`) &&
        path.basename(file) !== 'agent-command-utils.ts'
    );

    for (const file of cliFiles) {
      const source = fs.readFileSync(file, 'utf8');
      expect(source, path.relative(REPO_ROOT, file)).toContain('createCliContext');
      if (source.includes('process.argv[1]')) {
        expect(source, path.relative(REPO_ROOT, file)).toContain('runMain(');
      }
      expect(source, path.relative(REPO_ROOT, file)).not.toMatch(
        /process\.stderr\.write\(`?\$\{\(err as Error\)\.message/
      );
    }
  });
});
