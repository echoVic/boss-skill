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
    const groupRouterSource = fs.readFileSync(
      path.join(REPO_ROOT, 'packages', 'boss-cli', 'src', 'cli', 'group-router.ts'),
      'utf8'
    );

    expect(bossSource).not.toContain('runBashScript');
    expect(bossSource).not.toContain('.sh');
    expect(groupRouterSource).toContain("import('../commands/project.js')");
    expect(groupRouterSource).toContain("import('../commands/artifact.js')");
    expect(groupRouterSource).toContain("import('../commands/packs.js')");
  });

  it('keeps harness as a runtime pattern instead of a root directory', () => {
    expect(fs.existsSync(path.join(REPO_ROOT, 'harness'))).toBe(false);

    const packageJson = JSON.parse(fs.readFileSync(path.join(REPO_ROOT, 'package.json'), 'utf8')) as {
      files?: string[];
    };
    expect(packageJson.files).toContain('packages/boss-cli/assets/');
    expect(packageJson.files).not.toContain('harness/');
  });

  it('does not hard-code root harness asset paths in runtime source', () => {
    const runtimeFiles = walkFiles(path.join(REPO_ROOT, 'packages', 'boss-cli', 'src', 'runtime'))
      .filter((file) => file.endsWith('.ts'));
    const forbiddenRootHarnessPatterns = [
      /\bREPO_ROOT\b[^\n;]*['"]harness['"]/,
      /\brepoRoot\b[^\n;]*['"]harness['"]/,
      /\bPROJECT_ROOT\b[^\n;]*['"]harness['"]/,
      /['"](?:\.\.\/)+harness\//
    ];

    for (const file of runtimeFiles) {
      const source = fs.readFileSync(file, 'utf8');
      for (const pattern of forbiddenRootHarnessPatterns) {
        expect(source, `${path.relative(REPO_ROOT, file)} matched ${pattern}`).not.toMatch(pattern);
      }
    }
  });

  it('keeps runtime application services outside CLI adapter directories', () => {
    const cliLibDir = path.join(REPO_ROOT, 'packages', 'boss-cli', 'src', 'runtime', 'cli', 'lib');
    const cliLibFiles = fs.existsSync(cliLibDir)
      ? fs.readdirSync(cliLibDir).filter((file) => file.endsWith('.ts')).sort()
      : [];

    expect(cliLibFiles).toEqual(['agent-command-utils.ts']);

    for (const file of [
      'inspection-runtime.ts',
      'memory-runtime.ts',
      'pack-runtime.ts',
      'pipeline-runtime.ts',
      'plugin-runtime.ts'
    ]) {
      expect(fs.existsSync(path.join(REPO_ROOT, 'packages', 'boss-cli', 'src', 'runtime', 'application', file))).toBe(true);
    }
  });

  it('keeps root CLI entrypoint thin and moves routing metadata into cli modules', () => {
    const bossSourcePath = path.join(REPO_ROOT, 'packages', 'boss-cli', 'src', 'bin', 'boss.ts');
    const bossSource = fs.readFileSync(bossSourcePath, 'utf8');
    const lineCount = bossSource.trimEnd().split('\n').length;

    expect(lineCount).toBeLessThanOrEqual(220);
    expect(bossSource).not.toContain('const runtimeCommands');
    expect(bossSource).not.toContain('const ROOT_USAGE');

    for (const file of ['root-help.ts', 'group-router.ts', 'runtime-loader.ts']) {
      expect(fs.existsSync(path.join(REPO_ROOT, 'packages', 'boss-cli', 'src', 'cli', file))).toBe(true);
    }
  });
});
