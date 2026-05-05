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
    const dispatcherSource = fs.readFileSync(
      path.join(REPO_ROOT, 'packages', 'boss-cli', 'src', 'cli', 'dispatcher.ts'),
      'utf8'
    );

    expect(bossSource).not.toContain('runBashScript');
    expect(bossSource).not.toContain('.sh');
    expect(dispatcherSource).toContain("import('../commands/project/index.js')");
    expect(dispatcherSource).toContain("import('../commands/artifact/index.js')");
    expect(dispatcherSource).toContain("import('../commands/packs/index.js')");
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

  it('matches the intended package source tree shape', () => {
    const srcRoot = path.join(REPO_ROOT, 'packages', 'boss-cli', 'src');
    const expectedFiles = [
      'bin/boss.ts',
      'cli/contract.ts',
      'cli/dispatcher.ts',
      'cli/registry.ts',
      'cli/help.ts',
      'commands/project/index.ts',
      'commands/artifact/index.ts',
      'commands/packs/index.ts',
      'commands/install/index.ts',
      'commands/runtime/init-pipeline.ts',
      'runtime/application/pipeline.ts',
      'runtime/application/plugins.ts',
      'runtime/application/memory.ts',
      'runtime/application/inspection.ts',
      'runtime/application/gates.ts',
      'runtime/application/state.ts',
      'runtime/domain/event-types.ts',
      'runtime/projectors/materialize-state.ts',
      'runtime/report/render-markdown.ts',
      'runtime/assets.ts',
      'infrastructure/paths.ts',
      'infrastructure/process.ts',
      'infrastructure/fs.ts'
    ];

    for (const relativePath of expectedFiles) {
      expect(fs.existsSync(path.join(srcRoot, relativePath)), relativePath).toBe(true);
    }

    const forbiddenFiles = [
      'cli/group-router.ts',
      'cli/root-help.ts',
      'cli/root-descriptions.ts',
      'cli/root-command-registry.ts',
      'cli/runtime-command-registry.ts',
      'cli/runtime-loader.ts',
      'commands/project.ts',
      'commands/artifact.ts',
      'commands/packs.ts',
      'commands/install.ts',
      'runtime/cli',
      'runtime/application/pipeline-runtime.ts',
      'runtime/application/plugin-runtime.ts',
      'runtime/application/memory-runtime.ts',
      'runtime/application/inspection-runtime.ts',
      'runtime/application/pack-runtime.ts',
      'scripts'
    ];

    for (const relativePath of forbiddenFiles) {
      expect(fs.existsSync(path.join(srcRoot, relativePath)), relativePath).toBe(false);
    }
  });

  it('build output does not keep stale pre-refactor entrypoints', () => {
    const distRoot = path.join(REPO_ROOT, 'packages', 'boss-cli', 'dist');
    const forbiddenPaths = [
      'cli/group-router.js',
      'cli/root-help.js',
      'cli/command-registry.js',
      'cli/root-command-registry.js',
      'cli/runtime-command-registry.js',
      'cli/runtime-loader.js',
      'commands/project.js',
      'commands/artifact.js',
      'commands/packs.js',
      'commands/install.js',
      'runtime/cli',
      'runtime/application/pipeline-runtime.js',
      'runtime/application/plugin-runtime.js',
      'runtime/application/memory-runtime.js',
      'runtime/application/inspection-runtime.js',
      'runtime/application/pack-runtime.js',
      'scripts'
    ];

    for (const relativePath of forbiddenPaths) {
      expect(fs.existsSync(path.join(distRoot, relativePath)), relativePath).toBe(false);
    }
  });

  it('keeps root CLI entrypoint thin and moves routing metadata into cli modules', () => {
    const bossSourcePath = path.join(REPO_ROOT, 'packages', 'boss-cli', 'src', 'bin', 'boss.ts');
    const bossSource = fs.readFileSync(bossSourcePath, 'utf8');
    const lineCount = bossSource.trimEnd().split('\n').length;

    expect(lineCount).toBeLessThanOrEqual(220);
    expect(bossSource).not.toContain('const runtimeCommands');
    expect(bossSource).not.toContain('const ROOT_USAGE');

    for (const file of ['help.ts', 'dispatcher.ts', 'registry.ts']) {
      expect(fs.existsSync(path.join(REPO_ROOT, 'packages', 'boss-cli', 'src', 'cli', file))).toBe(true);
    }
  });

  it('keeps gate execution in the gates application module instead of pipeline', () => {
    const appRoot = path.join(REPO_ROOT, 'packages', 'boss-cli', 'src', 'runtime', 'application');
    const pipelineSource = fs.readFileSync(path.join(appRoot, 'pipeline.ts'), 'utf8');
    const gatesSource = fs.readFileSync(path.join(appRoot, 'gates.ts'), 'utf8');
    const stateSource = fs.readFileSync(path.join(appRoot, 'state.ts'), 'utf8');
    const evaluateCommand = fs.readFileSync(
      path.join(REPO_ROOT, 'packages', 'boss-cli', 'src', 'commands', 'runtime', 'evaluate-gates.ts'),
      'utf8'
    );

    expect(gatesSource).toContain('export function evaluateGates');
    expect(gatesSource).toContain('function runGate0');
    expect(gatesSource).not.toMatch(/^export\s+\{[^}]*evaluateGates[^}]*\}\s+from\s+['"]\.\/pipeline\.js['"]/m);
    expect(pipelineSource).not.toContain('export function evaluateGates');
    expect(pipelineSource).not.toContain('function runGate0');
    expect(pipelineSource).not.toContain('function resolveGateScript');
    expect(pipelineSource).not.toContain('export function appendRuntimeEvent');
    expect(gatesSource).toContain("from './state.js'");
    expect(gatesSource).not.toMatch(/from\s+['"]\.\/pipeline\.js['"]/);
    expect(stateSource).toContain('export function appendRuntimeEvent');
    expect(stateSource).toContain('export function readExecutionView');
    expect(evaluateCommand).toContain("from '../../runtime/application/gates.js'");
  });

  it('uses infrastructure helpers for package paths and file operations instead of placeholder modules', () => {
    const srcRoot = path.join(REPO_ROOT, 'packages', 'boss-cli', 'src');
    const pathSource = fs.readFileSync(path.join(srcRoot, 'infrastructure', 'paths.ts'), 'utf8');
    const fsSource = fs.readFileSync(path.join(srcRoot, 'infrastructure', 'fs.ts'), 'utf8');
    const filesWithPackageRoots = [
      'bin/boss.ts',
      'cli/dispatcher.ts',
      'commands/project/index.ts',
      'commands/artifact/index.ts',
      'commands/install/index.ts',
      'runtime/assets.ts',
      'runtime/application/plugins.ts'
    ];

    expect(pathSource).toContain('export function packageRootFromImportMeta');
    expect(pathSource).toContain('export function resolvePackagePath');
    expect(fsSource).toContain('export function readJsonFile');
    expect(fsSource).toContain('export function ensureDir');
    expect(fsSource).not.toMatch(/^export\s+\{\s*fs\s*\};?\s*$/m);
    expect(pathSource).not.toMatch(/^export\s+\{\s*path\s*\};?\s*$/m);

    for (const relativePath of filesWithPackageRoots) {
      const source = fs.readFileSync(path.join(srcRoot, relativePath), 'utf8');
      expect(source, relativePath).not.toMatch(/path\.resolve\(__dirname,\s*['"]\.\./);
    }
  });
});
