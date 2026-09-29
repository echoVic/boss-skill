import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

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
    const bossSource = fs.readFileSync(
      path.join(REPO_ROOT, 'skill', 'cli', 'bin', 'boss.mts'),
      'utf8',
    );
    const dispatcherSource = fs.readFileSync(
      path.join(REPO_ROOT, 'skill', 'cli', 'cli', 'dispatcher.mts'),
      'utf8',
    );

    expect(bossSource).not.toContain('runBashScript');
    expect(bossSource).not.toContain('.sh');
    expect(dispatcherSource).toContain("import('../commands/project/index.mts')");
    expect(dispatcherSource).toContain("import('../commands/artifact/index.mts')");
    expect(dispatcherSource).toContain("import('../commands/packs/index.mts')");
  });

  it('keeps harness as a runtime pattern and bundles runtime assets inside the skill', () => {
    expect(fs.existsSync(path.join(REPO_ROOT, 'harness'))).toBe(false);
    expect(fs.existsSync(path.join(REPO_ROOT, 'skill', 'assets', 'artifact-dag.json'))).toBe(true);

    // npm 不再是分发通道：仓库不发包，产物随 skill 走市场。
    const packageJson = JSON.parse(
      fs.readFileSync(path.join(REPO_ROOT, 'package.json'), 'utf8'),
    ) as {
      private?: boolean;
      bin?: unknown;
      files?: unknown;
    };
    expect(packageJson.private).toBe(true);
    expect(packageJson.bin).toBeUndefined();
    expect(packageJson.files).toBeUndefined();
  });

  it('does not hard-code root harness asset paths in runtime source', () => {
    const runtimeFiles = walkFiles(path.join(REPO_ROOT, 'skill', 'cli', 'runtime')).filter((file) =>
      file.endsWith('.mts'),
    );
    const forbiddenRootHarnessPatterns = [
      /\bREPO_ROOT\b[^\n;]*['"]harness['"]/,
      /\brepoRoot\b[^\n;]*['"]harness['"]/,
      /\bPROJECT_ROOT\b[^\n;]*['"]harness['"]/,
      /['"](?:\.\.\/)+harness\//,
    ];

    for (const file of runtimeFiles) {
      const source = fs.readFileSync(file, 'utf8');
      for (const pattern of forbiddenRootHarnessPatterns) {
        expect(source, `${path.relative(REPO_ROOT, file)} matched ${pattern}`).not.toMatch(pattern);
      }
    }
  });

  it('matches the intended package source tree shape', () => {
    const srcRoot = path.join(REPO_ROOT, 'skill', 'cli');
    const expectedFiles = [
      'bin/boss.mts',
      'cli/contract.mts',
      'cli/dispatcher.mts',
      'cli/registry.mts',
      'cli/help.mts',
      'commands/project/index.mts',
      'commands/artifact/index.mts',
      'commands/packs/index.mts',
      'commands/install/index.mts',
      'commands/runtime/init-pipeline.mts',
      'runtime/application/pipeline.mts',
      'runtime/application/plugins.mts',
      'runtime/application/memory.mts',
      'runtime/application/inspection.mts',
      'runtime/application/gates.mts',
      'runtime/application/state.mts',
      'runtime/domain/event-types.mts',
      'runtime/projectors/materialize-state.mts',
      'runtime/report/render-markdown.mts',
      'runtime/assets.mts',
      'infrastructure/paths.mts',
      'infrastructure/process.mts',
      'infrastructure/fs.mts',
    ];

    for (const relativePath of expectedFiles) {
      expect(fs.existsSync(path.join(srcRoot, relativePath)), relativePath).toBe(true);
    }

    const forbiddenFiles = [
      'cli/group-router.mts',
      'cli/root-help.mts',
      'cli/root-descriptions.mts',
      'cli/root-command-registry.mts',
      'cli/runtime-command-registry.mts',
      'cli/runtime-loader.mts',
      'commands/project.mts',
      'commands/artifact.mts',
      'commands/packs.mts',
      'commands/install.mts',
      'runtime/cli',
      'runtime/application/pipeline-runtime.mts',
      'runtime/application/plugin-runtime.mts',
      'runtime/application/memory-runtime.mts',
      'runtime/application/inspection-runtime.mts',
      'runtime/application/pack-runtime.mts',
      'scripts',
    ];

    for (const relativePath of forbiddenFiles) {
      expect(fs.existsSync(path.join(srcRoot, relativePath)), relativePath).toBe(false);
    }
  });

  it('ships CLI source directly with no build output and no packages workspace', () => {
    expect(fs.existsSync(path.join(REPO_ROOT, 'packages'))).toBe(false);
    expect(fs.existsSync(path.join(REPO_ROOT, 'skill', 'cli', 'dist'))).toBe(false);

    const cliRoot = path.join(REPO_ROOT, 'skill', 'cli');
    const forbiddenPaths = [
      'cli/group-router.mts',
      'cli/root-help.mts',
      'cli/command-registry.mts',
      'cli/root-command-registry.mts',
      'cli/runtime-command-registry.mts',
      'cli/runtime-loader.mts',
      'commands/project.mts',
      'commands/artifact.mts',
      'commands/packs.mts',
      'commands/install.mts',
      'runtime/cli',
      'runtime/application/pipeline-runtime.mts',
      'runtime/application/plugin-runtime.mts',
      'runtime/application/memory-runtime.mts',
      'runtime/application/inspection-runtime.mts',
      'runtime/application/pack-runtime.mts',
      'scripts',
    ];

    for (const relativePath of forbiddenPaths) {
      expect(fs.existsSync(path.join(cliRoot, relativePath)), relativePath).toBe(false);
    }
  });

  it('keeps root CLI entrypoint thin and moves routing metadata into cli modules', () => {
    const bossSourcePath = path.join(REPO_ROOT, 'skill', 'cli', 'bin', 'boss.mts');
    const bossSource = fs.readFileSync(bossSourcePath, 'utf8');
    const lineCount = bossSource.trimEnd().split('\n').length;

    expect(lineCount).toBeLessThanOrEqual(220);
    expect(bossSource).not.toContain('const runtimeCommands');
    expect(bossSource).not.toContain('const ROOT_USAGE');

    for (const file of ['help.mts', 'dispatcher.mts', 'registry.mts']) {
      expect(fs.existsSync(path.join(REPO_ROOT, 'skill', 'cli', 'cli', file))).toBe(true);
    }
  });

  it('keeps gate execution in the gates application module instead of pipeline', () => {
    const appRoot = path.join(REPO_ROOT, 'skill', 'cli', 'runtime', 'application');
    const pipelineSource = fs.readFileSync(path.join(appRoot, 'pipeline.mts'), 'utf8');
    const gatesSource = fs.readFileSync(path.join(appRoot, 'gates.mts'), 'utf8');
    const stateSource = fs.readFileSync(path.join(appRoot, 'state.mts'), 'utf8');
    const evaluateCommand = fs.readFileSync(
      path.join(REPO_ROOT, 'skill', 'cli', 'commands', 'runtime', 'evaluate-gates.mts'),
      'utf8',
    );

    expect(gatesSource).toContain('export function evaluateGates');
    expect(gatesSource).toContain('function runGate0');
    expect(gatesSource).not.toMatch(
      /^export\s+\{[^}]*evaluateGates[^}]*\}\s+from\s+['"]\.\/pipeline\.js['"]/m,
    );
    expect(pipelineSource).not.toContain('export function evaluateGates');
    expect(pipelineSource).not.toContain('function runGate0');
    expect(pipelineSource).not.toContain('function resolveGateScript');
    expect(pipelineSource).not.toContain('export function appendRuntimeEvent');
    expect(gatesSource).toContain("from './state.mts'");
    expect(gatesSource).not.toMatch(/from\s+['"]\.\/pipeline\.js['"]/);
    expect(stateSource).toContain('export function appendRuntimeEvent');
    expect(stateSource).toContain('export function readExecutionView');
    expect(evaluateCommand).toContain("from '../../runtime/application/gates.mts'");
  });

  it('uses infrastructure helpers for package paths and file operations instead of placeholder modules', () => {
    const srcRoot = path.join(REPO_ROOT, 'skill', 'cli');
    const pathSource = fs.readFileSync(path.join(srcRoot, 'infrastructure', 'paths.mts'), 'utf8');
    const fsSource = fs.readFileSync(path.join(srcRoot, 'infrastructure', 'fs.mts'), 'utf8');
    const filesWithPackageRoots = [
      'bin/boss.mts',
      'cli/dispatcher.mts',
      'commands/project/index.mts',
      'commands/artifact/index.mts',
      'commands/install/index.mts',
      'runtime/assets.mts',
      'runtime/application/plugins.mts',
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
