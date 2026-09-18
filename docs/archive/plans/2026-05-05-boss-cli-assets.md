# Boss CLI Assets Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Move the Boss built-in harness assets into `packages/boss-cli/assets/`, remove the root `harness/` directory, and make `.boss/` the only project-local extension surface.

**Architecture:** Add a focused runtime asset resolver in `packages/boss-cli/src/runtime/assets.ts`. Pack, plugin, and pipeline runtime modules must ask this resolver for built-in assets and project overrides instead of hard-coding root `harness/` paths. Public commands stay under `boss ...`; harness remains a Boss runtime pattern, not a directory or CLI namespace.

**Tech Stack:** TypeScript ESM, Node.js built-in `fs/path/url`, Vitest, existing Boss CLI runtime modules.

---

## File Map

- Create: `packages/boss-cli/src/runtime/assets.ts`
  - Owns path resolution for built-in CLI assets and project `.boss/` override assets.
  - Exposes small functions rather than raw constants: `resolveBuiltInAssetPath`, `resolveArtifactDagPath`, `listPipelinePackManifestPaths`, `listPluginManifestPaths`, `resolvePluginSchemaPath`.

- Move: `harness/artifact-dag.json` -> `packages/boss-cli/assets/artifact-dag.json`
- Move: `harness/plugin-schema.json` -> `packages/boss-cli/assets/plugin-schema.json`
- Move: `harness/pipeline-packs/**` -> `packages/boss-cli/assets/pipeline-packs/**`
- Move: `harness/plugins/security-audit/**` -> `packages/boss-cli/assets/plugins/security-audit/**`

- Modify: `packages/boss-cli/src/runtime/cli/lib/pack-runtime.ts`
  - Read pack manifests through the asset resolver.
  - Merge `.boss/pipeline-packs/*` over built-in packs by pack name.

- Modify: `packages/boss-cli/src/runtime/cli/lib/plugin-runtime.ts`
  - Discover plugin manifests through the asset resolver.
  - Merge `.boss/plugins/*` over built-in plugins by plugin name.

- Modify: `packages/boss-cli/src/runtime/cli/lib/pipeline-runtime.ts`
  - Resolve default and pack-specific DAG paths through the asset resolver.
  - Resolve built-in plugin gate paths through the asset resolver.

- Modify: `packages/boss-cli/src/commands/packs.ts`
  - Continue delegating to `detectPipelinePacks`; no new command namespace.

- Modify: `package.json`
  - Include `packages/boss-cli/assets/`.
  - Remove root `harness/`.

- Modify docs and skill assets:
  - `README.md`
  - `CONTRIBUTING.md`
  - `DESIGN.md`
  - `skill/SKILL.md`
  - `skill/references/bmad-methodology.md`
  - `skill/references/quality-gate.md`

- Tests:
  - Modify `test/runtime/no-first-party-shell.test.ts`
  - Modify `test/runtime/docs-contract.test.ts`
  - Modify `test/bin/boss-skill.test.ts`
  - Modify `test/harness/detect-pack.test.ts`
  - Modify `test/harness/artifact-dag.test.ts`
  - Modify `test/runtime/plugin-runtime.test.ts`
  - Modify `test/runtime/evaluate-gates.test.ts`
  - Add `test/runtime/assets-runtime.test.ts`

---

### Task 1: Lock The New Asset Boundary With Failing Tests

**Files:**
- Modify: `test/runtime/no-first-party-shell.test.ts`
- Modify: `test/runtime/docs-contract.test.ts`
- Modify: `test/bin/boss-skill.test.ts`
- Add: `test/runtime/assets-runtime.test.ts`

- [ ] **Step 1: Extend the architecture boundary test**

Add these assertions to `test/runtime/no-first-party-shell.test.ts` inside the existing `TypeScript CLI architecture` describe block:

```ts
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

    for (const file of runtimeFiles) {
      const source = fs.readFileSync(file, 'utf8');
      expect(source, path.relative(REPO_ROOT, file)).not.toContain("REPO_ROOT, 'harness'");
      expect(source, path.relative(REPO_ROOT, file)).not.toContain('"harness",');
    }
  });
```

- [ ] **Step 2: Add package publish assertions**

In `test/bin/boss-skill.test.ts`, extend `uses the workspace boss CLI as the published entrypoint`:

```ts
    expect(pkg.files).toContain('packages/boss-cli/assets/');
    expect(pkg.files).not.toContain('harness/');
```

- [ ] **Step 3: Add docs contract assertions**

In `test/runtime/docs-contract.test.ts`, add a test:

```ts
  it('documents Boss CLI assets instead of a root harness directory', () => {
    expect(readme).toContain('packages/boss-cli/assets/');
    expect(readme).not.toContain('├── harness/');
    expect(contributing).toContain('packages/boss-cli/assets/');
    expect(skill).not.toContain('harness/plugins/');
  });
```

- [ ] **Step 4: Add asset resolver test skeleton**

Create `test/runtime/assets-runtime.test.ts`:

```ts
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import {
  listPipelinePackManifestPaths,
  listPluginManifestPaths,
  resolveArtifactDagPath,
  resolveBuiltInAssetPath,
  resolvePluginSchemaPath
} from '../../packages/boss-cli/src/runtime/assets.js';

const REPO_ROOT = path.resolve(import.meta.dirname, '..', '..');

describe('runtime asset resolver', () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'boss-assets-'));
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it('resolves built-in assets under packages/boss-cli/assets', () => {
    const dagPath = path.join(REPO_ROOT, 'packages', 'boss-cli', 'assets', 'artifact-dag.json');
    const schemaPath = path.join(REPO_ROOT, 'packages', 'boss-cli', 'assets', 'plugin-schema.json');

    expect(resolveBuiltInAssetPath('artifact-dag.json')).toBe(dagPath);
    expect(resolvePluginSchemaPath()).toBe(schemaPath);
    expect(fs.existsSync(dagPath)).toBe(true);
    expect(fs.existsSync(schemaPath)).toBe(true);
  });

  it('prefers project .boss artifact DAG over the built-in DAG', () => {
    fs.mkdirSync(path.join(tmpDir, '.boss'), { recursive: true });
    fs.writeFileSync(path.join(tmpDir, '.boss', 'artifact-dag.json'), '{"artifacts":{}}\n', 'utf8');

    expect(resolveArtifactDagPath({ cwd: tmpDir })).toBe(path.join(tmpDir, '.boss', 'artifact-dag.json'));
  });

  it('merges project pipeline packs over built-in packs by name', () => {
    const packDir = path.join(tmpDir, '.boss', 'pipeline-packs', 'api-only');
    fs.mkdirSync(packDir, { recursive: true });
    fs.writeFileSync(
      path.join(packDir, 'pipeline.json'),
      '{"name":"api-only","version":"9.9.9","type":"pipeline-pack","config":{}}\n',
      'utf8'
    );

    const paths = listPipelinePackManifestPaths({ cwd: tmpDir });
    const apiOnly = paths.find((item) => item.name === 'api-only');
    expect(apiOnly?.path).toBe(path.join(packDir, 'pipeline.json'));
  });

  it('merges project plugins over built-in plugins by name', () => {
    const pluginDir = path.join(tmpDir, '.boss', 'plugins', 'security-audit');
    fs.mkdirSync(pluginDir, { recursive: true });
    fs.writeFileSync(
      path.join(pluginDir, 'plugin.json'),
      '{"name":"security-audit","version":"9.9.9","type":"gate","hooks":{"gate":"gate.js"}}\n',
      'utf8'
    );
    fs.writeFileSync(path.join(pluginDir, 'gate.js'), '#!/usr/bin/env node\nprocess.exit(0)\n', 'utf8');

    const paths = listPluginManifestPaths({ cwd: tmpDir });
    const securityAudit = paths.find((item) => item.name === 'security-audit');
    expect(securityAudit?.path).toBe(path.join(pluginDir, 'plugin.json'));
  });
});
```

- [ ] **Step 5: Run tests to verify red**

Run:

```bash
npm test -- test/runtime/no-first-party-shell.test.ts test/bin/boss-skill.test.ts test/runtime/docs-contract.test.ts test/runtime/assets-runtime.test.ts
```

Expected:

```text
FAIL test/runtime/assets-runtime.test.ts
Cannot find module '../../packages/boss-cli/src/runtime/assets.js'
```

Also expect boundary failures while root `harness/` still exists and `package.json.files` still includes `harness/`.

- [ ] **Step 6: Commit red tests**

```bash
git add test/runtime/no-first-party-shell.test.ts test/bin/boss-skill.test.ts test/runtime/docs-contract.test.ts test/runtime/assets-runtime.test.ts
git commit -m "test: lock boss cli asset boundary"
```

---

### Task 2: Add The Runtime Asset Resolver

**Files:**
- Create: `packages/boss-cli/src/runtime/assets.ts`
- Test: `test/runtime/assets-runtime.test.ts`

- [ ] **Step 1: Create asset resolver implementation**

Create `packages/boss-cli/src/runtime/assets.ts`:

```ts
import * as fs from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const PKG_ROOT = path.resolve(__dirname, '..', '..', '..');
const ASSETS_ROOT = path.join(PKG_ROOT, 'assets');

export interface AssetOptions {
  cwd?: string;
}

export interface NamedAssetPath {
  name: string;
  path: string;
  source: 'project' | 'builtin';
}

function readJsonObject(filePath: string): Record<string, unknown> | null {
  try {
    const parsed = JSON.parse(fs.readFileSync(filePath, 'utf8')) as unknown;
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed)
      ? parsed as Record<string, unknown>
      : null;
  } catch {
    return null;
  }
}

function requireExistingPath(filePath: string, label: string): string {
  if (!fs.existsSync(filePath)) {
    throw new Error(`Missing Boss CLI built-in asset: ${label} (${filePath})`);
  }
  return filePath;
}

function listManifestPaths(
  root: string,
  fileName: string,
  source: NamedAssetPath['source'],
  required = false
): NamedAssetPath[] {
  if (!fs.existsSync(root) || !fs.statSync(root).isDirectory()) {
    if (required) {
      throw new Error(`Missing Boss CLI built-in asset directory: ${root}`);
    }
    return [];
  }
  return fs
    .readdirSync(root, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => {
      const manifestPath = path.join(root, entry.name, fileName);
      const manifest = fs.existsSync(manifestPath) ? readJsonObject(manifestPath) : null;
      return {
        name: typeof manifest?.name === 'string' && manifest.name.length > 0 ? manifest.name : entry.name,
        path: manifestPath,
        source
      };
    })
    .filter((item) => fs.existsSync(item.path))
    .sort((left, right) => left.name.localeCompare(right.name));
}

function mergeByName(builtin: NamedAssetPath[], project: NamedAssetPath[]): NamedAssetPath[] {
  const byName = new Map<string, NamedAssetPath>();
  for (const item of builtin) byName.set(item.name, item);
  for (const item of project) byName.set(item.name, item);
  return [...byName.values()].sort((left, right) => left.name.localeCompare(right.name));
}

export function resolveBuiltInAssetPath(...segments: string[]): string {
  return path.join(ASSETS_ROOT, ...segments);
}

export function resolveProjectBossPath({ cwd = process.cwd() }: AssetOptions = {}, ...segments: string[]): string {
  return path.join(cwd, '.boss', ...segments);
}

export function resolvePluginSchemaPath(): string {
  return requireExistingPath(resolveBuiltInAssetPath('plugin-schema.json'), 'plugin-schema.json');
}

export function resolveArtifactDagPath(
  { cwd = process.cwd(), packDagPath }: AssetOptions & { packDagPath?: string } = {}
): string {
  const projectDag = resolveProjectBossPath({ cwd }, 'artifact-dag.json');
  if (fs.existsSync(projectDag)) return projectDag;
  if (packDagPath) {
    const resolvedPackDag = path.isAbsolute(packDagPath) ? packDagPath : path.resolve(cwd, packDagPath);
    if (fs.existsSync(resolvedPackDag)) return resolvedPackDag;
  }
  return requireExistingPath(resolveBuiltInAssetPath('artifact-dag.json'), 'artifact-dag.json');
}

export function listPipelinePackManifestPaths({ cwd = process.cwd() }: AssetOptions = {}): NamedAssetPath[] {
  const builtin = listManifestPaths(resolveBuiltInAssetPath('pipeline-packs'), 'pipeline.json', 'builtin', true);
  const project = listManifestPaths(resolveProjectBossPath({ cwd }, 'pipeline-packs'), 'pipeline.json', 'project');
  return mergeByName(builtin, project);
}

export function listPluginManifestPaths({ cwd = process.cwd() }: AssetOptions = {}): NamedAssetPath[] {
  const builtin = listManifestPaths(resolveBuiltInAssetPath('plugins'), 'plugin.json', 'builtin', true);
  const project = listManifestPaths(resolveProjectBossPath({ cwd }, 'plugins'), 'plugin.json', 'project');
  return mergeByName(builtin, project);
}
```

- [ ] **Step 2: Run asset resolver tests**

Run:

```bash
npm test -- test/runtime/assets-runtime.test.ts
```

Expected:

```text
FAIL
Missing Boss CLI built-in asset
```

The resolver exists but built-in assets have not moved yet, so the required built-in asset checks should remain red until Task 3.

- [ ] **Step 3: Commit resolver skeleton**

```bash
git add packages/boss-cli/src/runtime/assets.ts
git commit -m "feat: add boss cli asset resolver"
```

---

### Task 3: Move Built-In Assets Into Boss CLI

**Files:**
- Move: `harness/artifact-dag.json` -> `packages/boss-cli/assets/artifact-dag.json`
- Move: `harness/plugin-schema.json` -> `packages/boss-cli/assets/plugin-schema.json`
- Move: `harness/pipeline-packs/` -> `packages/boss-cli/assets/pipeline-packs/`
- Move: `harness/plugins/` -> `packages/boss-cli/assets/plugins/`

- [ ] **Step 1: Move assets**

Use normal filesystem moves:

```bash
mkdir -p packages/boss-cli/assets
mv harness/artifact-dag.json packages/boss-cli/assets/artifact-dag.json
mv harness/plugin-schema.json packages/boss-cli/assets/plugin-schema.json
mv harness/pipeline-packs packages/boss-cli/assets/pipeline-packs
mv harness/plugins packages/boss-cli/assets/plugins
rmdir harness
```

- [ ] **Step 2: Verify moved paths**

Run:

```bash
find packages/boss-cli/assets -maxdepth 4 -type f | sort
test ! -e harness
```

Expected includes:

```text
packages/boss-cli/assets/artifact-dag.json
packages/boss-cli/assets/pipeline-packs/default/pipeline.json
packages/boss-cli/assets/plugins/security-audit/plugin.json
packages/boss-cli/assets/plugin-schema.json
```

- [ ] **Step 3: Run asset resolver tests**

Run:

```bash
npm test -- test/runtime/assets-runtime.test.ts
```

Expected:

```text
PASS test/runtime/assets-runtime.test.ts
```

- [ ] **Step 4: Commit moved assets**

```bash
git add -A harness packages/boss-cli/assets test/runtime/assets-runtime.test.ts
git commit -m "refactor: move built-in harness assets into boss cli"
```

---

### Task 4: Wire Pipeline Pack Runtime To Asset Resolver

**Files:**
- Modify: `packages/boss-cli/src/runtime/cli/lib/pack-runtime.ts`
- Modify: `test/harness/detect-pack.test.ts`

- [ ] **Step 1: Write failing project pack override test**

Add to `test/harness/detect-pack.test.ts`:

```ts
  it('uses .boss pipeline pack overrides before built-in packs', () => {
    fs.writeFileSync(path.join(tmpDir, 'package.json'), '{"name":"test"}', 'utf8');
    const packDir = path.join(tmpDir, '.boss', 'pipeline-packs', 'api-only');
    fs.mkdirSync(packDir, { recursive: true });
    fs.writeFileSync(
      path.join(packDir, 'pipeline.json'),
      JSON.stringify({
        name: 'api-only',
        version: '9.9.9',
        type: 'pipeline-pack',
        when: { fileExists: ['custom-api.marker'] },
        priority: 99,
        config: { stages: [1], agents: ['boss-pm'], gates: [] },
        enabled: true
      }),
      'utf8'
    );
    fs.writeFileSync(path.join(tmpDir, 'custom-api.marker'), '', 'utf8');

    expect(run(tmpDir)).toBe('api-only');
  });
```

- [ ] **Step 2: Run test to verify red**

Run:

```bash
npm test -- test/harness/detect-pack.test.ts
```

Expected:

```text
FAIL uses .boss pipeline pack overrides before built-in packs
```

The current runtime still reads built-in packs from the old location or only one pack root.

- [ ] **Step 3: Update `pack-runtime.ts` imports and listing**

In `packages/boss-cli/src/runtime/cli/lib/pack-runtime.ts`, replace local `PACKS_DIR` scanning with `listPipelinePackManifestPaths`.

Use this implementation pattern:

```ts
import { listPipelinePackManifestPaths } from '../../assets.js';
```

Replace `listPackDefinitions()` with:

```ts
function listPackDefinitions(projectDir = process.cwd()): PipelinePackDefinition[] {
  const packs: PipelinePackDefinition[] = [];

  for (const item of listPipelinePackManifestPaths({ cwd: projectDir })) {
    const pipeline = readJson<Record<string, unknown>>(item.path);
    if (pipeline.enabled === false) continue;

    packs.push({
      name: typeof pipeline.name === 'string' && pipeline.name.length > 0 ? pipeline.name : item.name,
      version: typeof pipeline.version === 'string' ? pipeline.version : '',
      type: typeof pipeline.type === 'string' ? pipeline.type : '',
      priority: Number.isFinite(Number(pipeline.priority)) ? Number(pipeline.priority) : 0,
      when: isObject(pipeline.when) ? (pipeline.when as PipelinePackWhen) : null,
      config: isObject(pipeline.config) ? (pipeline.config as PipelinePackConfig) : {}
    });
  }

  return packs;
}
```

Update callers:

```ts
export function detectPipelinePacks(projectDir = process.cwd()): PipelinePackDetectionResult {
  const packs = listPackDefinitions(projectDir);
  // keep existing selection logic
}
```

- [ ] **Step 4: Run pack tests**

Run:

```bash
npm test -- test/harness/detect-pack.test.ts test/runtime/init-pipeline-pack.test.ts
```

Expected:

```text
PASS
```

- [ ] **Step 5: Commit pack runtime wiring**

```bash
git add packages/boss-cli/src/runtime/cli/lib/pack-runtime.ts test/harness/detect-pack.test.ts
git commit -m "refactor: resolve pipeline packs from boss cli assets"
```

---

### Task 5: Wire Plugin Runtime To Asset Resolver

**Files:**
- Modify: `packages/boss-cli/src/runtime/cli/lib/plugin-runtime.ts`
- Modify: `packages/boss-cli/src/runtime/cli/lib/pipeline-runtime.ts`
- Modify: `test/runtime/plugin-runtime.test.ts`
- Modify: `test/runtime/evaluate-gates.test.ts`

- [ ] **Step 1: Add project plugin path test**

In `test/runtime/plugin-runtime.test.ts`, add:

```ts
  it('discovers project plugins from .boss/plugins and built-in plugins from CLI assets', () => {
    const projectPluginDir = path.join(tmpDir, '.boss', 'plugins', 'project-gate');
    fs.mkdirSync(projectPluginDir, { recursive: true });
    fs.writeFileSync(path.join(projectPluginDir, 'gate.js'), '#!/usr/bin/env node\nprocess.stdout.write("[]\\n")\n', 'utf8');
    fs.chmodSync(path.join(projectPluginDir, 'gate.js'), 0o755);
    fs.writeFileSync(
      path.join(projectPluginDir, 'plugin.json'),
      JSON.stringify({
        name: 'project-gate',
        version: '1.0.0',
        type: 'gate',
        hooks: { gate: 'gate.js' },
        enabled: true
      }),
      'utf8'
    );

    const result = discoverPlugins({ cwd: tmpDir });
    expect(result.plugins.some((plugin) => plugin.name === 'project-gate')).toBe(true);
    expect(result.plugins.some((plugin) => plugin.name === 'security-audit')).toBe(true);
  });
```

- [ ] **Step 2: Add no root harness fallback test**

In `test/runtime/plugin-runtime.test.ts`, add:

```ts
  it('does not discover root harness plugins', () => {
    const rootHarnessPlugin = path.join(tmpDir, 'harness', 'plugins', 'legacy-gate');
    fs.mkdirSync(rootHarnessPlugin, { recursive: true });
    fs.writeFileSync(path.join(rootHarnessPlugin, 'gate.js'), '#!/usr/bin/env node\nprocess.exit(0)\n', 'utf8');
    fs.writeFileSync(
      path.join(rootHarnessPlugin, 'plugin.json'),
      '{"name":"legacy-gate","version":"1.0.0","type":"gate","hooks":{"gate":"gate.js"}}\n',
      'utf8'
    );

    const result = discoverPlugins({ cwd: tmpDir });
    expect(result.plugins.some((plugin) => plugin.name === 'legacy-gate')).toBe(false);
  });
```

- [ ] **Step 3: Run tests to verify red**

Run:

```bash
npm test -- test/runtime/plugin-runtime.test.ts
```

Expected:

```text
FAIL discovers project plugins from .boss/plugins
```

- [ ] **Step 4: Update `plugin-runtime.ts` discovery**

Import the asset resolver:

```ts
import { listPluginManifestPaths, resolveBuiltInAssetPath } from '../../assets.js';
```

Replace `resolvePluginRoot`/`listManifestPaths` flow with direct manifest path listing:

```ts
function resolvePluginDirFromManifest(manifestPath: string): string {
  return path.dirname(manifestPath);
}

function resolvePluginRootForRelativeManifest(manifestPath: string): string {
  return path.dirname(path.dirname(manifestPath));
}
```

In `discoverPlugins`, iterate:

```ts
const manifestItems = listPluginManifestPaths({ cwd });
for (const item of manifestItems) {
  const manifestPath = item.path;
  const pluginDir = path.dirname(manifestPath);
  // keep existing parse, validation, normalization
  const normalized = normalizePlugin(manifest, pluginDir, path.dirname(pluginDir));
  candidates.push(normalized);
}
```

Keep validation and dependency sorting behavior unchanged.

- [ ] **Step 5: Update hook path resolution**

Ensure `resolveHookScriptPath` continues to resolve relative to each plugin directory:

```ts
function resolveHookScriptPath(pluginRoot: string, plugin: DiscoveredPlugin, hook: string): string {
  const hookPath = plugin.hooks[hook] ?? '';
  if (typeof hookPath !== 'string' || hookPath.length === 0) return '';
  return path.join(pluginRoot, path.dirname(plugin.manifestPath), hookPath);
}
```

If manifest paths are no longer relative to a single root, replace this with a `pluginDir` field on `DiscoveredPlugin`:

```ts
interface DiscoveredPlugin extends PluginSummary {
  pluginDir: string;
}

function resolveHookScriptPath(plugin: DiscoveredPlugin, hook: string): string {
  const hookPath = plugin.hooks[hook] ?? '';
  if (typeof hookPath !== 'string' || hookPath.length === 0) return '';
  return path.join(plugin.pluginDir, hookPath);
}
```

Use the `pluginDir` option if a single `pluginRoot` becomes awkward.

- [ ] **Step 6: Update `pipeline-runtime.ts` plugin gate fallback**

In `resolveGateScript`, remove root `harness/plugins` construction. Use project `.boss/plugins` and built-in assets:

```ts
const pluginDirs = [
  path.join(cwd, '.boss', 'plugins', gateName),
  resolveBuiltInAssetPath('plugins', gateName)
];
```

Then keep the existing `plugin.json` `hooks.gate` lookup over these candidate directories.

- [ ] **Step 7: Run plugin and gate tests**

Run:

```bash
npm test -- test/runtime/plugin-runtime.test.ts test/runtime/plugin-hook-runtime.test.ts test/runtime/evaluate-gates.test.ts test/runtime/pack-plugin.integration.test.ts
```

Expected:

```text
PASS
```

- [ ] **Step 8: Commit plugin runtime wiring**

```bash
git add packages/boss-cli/src/runtime/cli/lib/plugin-runtime.ts packages/boss-cli/src/runtime/cli/lib/pipeline-runtime.ts test/runtime/plugin-runtime.test.ts test/runtime/evaluate-gates.test.ts
git commit -m "refactor: resolve plugins from boss cli assets"
```

---

### Task 6: Wire Artifact DAG Runtime To Asset Resolver

**Files:**
- Modify: `packages/boss-cli/src/runtime/cli/lib/pipeline-runtime.ts`
- Modify: `test/harness/artifact-dag.test.ts`
- Modify: `test/runtime/get-ready-artifacts.test.ts`

- [ ] **Step 1: Add project DAG override test**

In `test/runtime/get-ready-artifacts.test.ts`, add:

```ts
  it('uses .boss artifact DAG override before built-in DAG', () => {
    const projectDagPath = path.join(tmpDir, '.boss', 'artifact-dag.json');
    fs.mkdirSync(path.dirname(projectDagPath), { recursive: true });
    fs.writeFileSync(
      projectDagPath,
      JSON.stringify({
        version: '1.0.0',
        artifacts: {
          'custom.md': {
            inputs: [],
            agent: 'boss-pm',
            stage: 1,
            optional: false,
            description: 'Custom project artifact'
          }
        }
      }),
      'utf8'
    );

    const ready = getReadyArtifacts('test-feat', { cwd: tmpDir });
    expect(ready.map((item) => item.artifact)).toEqual(['custom.md']);
  });
```

- [ ] **Step 2: Run test to verify red**

Run:

```bash
npm test -- test/runtime/get-ready-artifacts.test.ts
```

Expected:

```text
FAIL uses .boss artifact DAG override before built-in DAG
```

- [ ] **Step 3: Update `pipeline-runtime.ts` DAG resolution**

Import:

```ts
import { resolveArtifactDagPath, resolveBuiltInAssetPath } from '../../assets.js';
```

Replace `DEFAULT_DAG_PATH`:

```ts
const DEFAULT_DAG_PATH = resolveBuiltInAssetPath('artifact-dag.json');
```

Update `resolveDagPath`:

```ts
function resolveDagPath(cwd: string, feature: string, dagPath?: string): string {
  if (dagPath) {
    return path.isAbsolute(dagPath) ? dagPath : path.resolve(cwd, dagPath);
  }

  let packDagPath = '';
  try {
    const execution = readExecutionView(cwd, feature);
    const configuredDag = (execution.parameters?.packConfig as Record<string, unknown> | undefined)?.artifactDag;
    if (typeof configuredDag === 'string' && configuredDag.length > 0) {
      packDagPath = configuredDag;
    }
  } catch {
    packDagPath = '';
  }

  return resolveArtifactDagPath({ cwd, packDagPath });
}
```

- [ ] **Step 4: Run DAG tests**

Run:

```bash
npm test -- test/runtime/get-ready-artifacts.test.ts test/harness/artifact-dag.test.ts
```

Expected:

```text
PASS
```

- [ ] **Step 5: Commit DAG resolver wiring**

```bash
git add packages/boss-cli/src/runtime/cli/lib/pipeline-runtime.ts test/runtime/get-ready-artifacts.test.ts
git commit -m "refactor: resolve artifact dag from boss cli assets"
```

---

### Task 7: Update Package Files, Docs, And Skill References

**Files:**
- Modify: `package.json`
- Modify: `README.md`
- Modify: `CONTRIBUTING.md`
- Modify: `DESIGN.md`
- Modify: `skill/SKILL.md`
- Modify: `skill/references/bmad-methodology.md`
- Modify: `skill/references/quality-gate.md`
- Modify: `test/runtime/docs-contract.test.ts`
- Modify: `test/bin/boss-skill.test.ts`

- [ ] **Step 1: Update package files**

In `package.json`, change:

```json
"files": [
  "packages/boss-cli/dist/",
  "packages/boss-cli/assets/",
  "packages/boss-cli/src/runtime/schema/",
  "skill/",
  "scripts/",
  ".claude/",
  ".claude-plugin/",
  "DESIGN.md"
]
```

- [ ] **Step 2: Update docs references**

Replace user-facing root harness directory mentions with:

```text
packages/boss-cli/assets/
.boss/plugins/
.boss/pipeline-packs/
.boss/artifact-dag.json
```

Concrete replacements:

```text
README.md: "通过 `harness/plugins/` 注册..." -> "通过 `.boss/plugins/` 注册..."
README.md file tree: remove root `harness/`; add `packages/boss-cli/assets/`
CONTRIBUTING.md: "`harness/` | 插件系统..." -> "`packages/boss-cli/assets/` | Boss CLI 内置 DAG、packs、plugin schema、内置插件"
skill/SKILL.md: "`harness/artifact-dag.json`" -> "`packages/boss-cli/assets/artifact-dag.json`（可由 `.boss/artifact-dag.json` 覆盖）"
skill/SKILL.md: "`harness/plugins/`" -> "`.boss/plugins/`"
```

- [ ] **Step 3: Update docs contract tests**

Add to `test/runtime/docs-contract.test.ts`:

```ts
  it('documents .boss project extensions and built-in CLI assets', () => {
    expect(readme).toContain('packages/boss-cli/assets/');
    expect(readme).toContain('.boss/plugins/');
    expect(skill).toContain('.boss/plugins/');
    expect(skill).not.toContain('harness/plugins/');
    expect(contributing).toContain('packages/boss-cli/assets/');
  });
```

- [ ] **Step 4: Update package metadata tests**

In `test/bin/boss-skill.test.ts`, ensure:

```ts
    expect(pkg.files).toContain('packages/boss-cli/assets/');
    expect(pkg.files).not.toContain('harness/');
```

- [ ] **Step 5: Run docs and metadata tests**

Run:

```bash
npm test -- test/runtime/docs-contract.test.ts test/bin/boss-skill.test.ts test/runtime/no-first-party-shell.test.ts
```

Expected:

```text
PASS
```

- [ ] **Step 6: Commit docs and package updates**

```bash
git add package.json README.md CONTRIBUTING.md DESIGN.md skill/SKILL.md skill/references/bmad-methodology.md skill/references/quality-gate.md test/runtime/docs-contract.test.ts test/bin/boss-skill.test.ts test/runtime/no-first-party-shell.test.ts
git commit -m "docs: describe boss cli asset boundary"
```

---

### Task 8: Full Verification And Package Dry Run

**Files:**
- No source edits expected unless verification exposes a bug.

- [ ] **Step 1: Run build**

Run:

```bash
npm run build
```

Expected:

```text
> @blade-ai/boss-skill@3.7.1 build
> tsc -p packages/boss-cli/tsconfig.json
```

Exit code must be 0.

- [ ] **Step 2: Run typecheck**

Run:

```bash
npm run typecheck
```

Expected:

```text
> @blade-ai/boss-skill@3.7.1 typecheck
```

Exit code must be 0.

- [ ] **Step 3: Run full test suite**

Run:

```bash
npm test
```

Expected:

```text
Test Files  ... passed
Tests       ... passed
```

No failed tests.

- [ ] **Step 4: Run package dry run**

Run:

```bash
npm pack --dry-run
```

Expected tarball contents include:

```text
packages/boss-cli/assets/artifact-dag.json
packages/boss-cli/assets/pipeline-packs/default/pipeline.json
packages/boss-cli/assets/plugins/security-audit/plugin.json
```

Expected tarball contents do not include:

```text
harness/artifact-dag.json
harness/pipeline-packs/default/pipeline.json
harness/plugins/security-audit/plugin.json
```

- [ ] **Step 5: Run root directory check**

Run:

```bash
test ! -e harness
rg -n "harness/plugins/|harness/artifact-dag|harness/pipeline-packs|REPO_ROOT, 'harness'" README.md CONTRIBUTING.md DESIGN.md skill packages/boss-cli/src test
```

Expected:

```text
test ! -e harness
```

returns 0, and `rg` finds no matches except historical design specs under `docs/superpowers/` if included by accident. Do not include `docs/superpowers/` in this command.

- [ ] **Step 6: Commit final verification fixes if needed**

If verification required code or doc fixes:

```bash
git add <changed-files>
git commit -m "fix: complete boss cli asset migration"
```

If no fixes were needed, do not create an empty commit.
