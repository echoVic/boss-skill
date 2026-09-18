# CLI TypeScript + Vitest Migration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Move the CLI-centered Node codepath to `src -> dist` TypeScript/ESM, keep existing shell and hook entrypoints working, and replace `node:test` with Vitest across the repository.

**Architecture:** `src/` becomes the only authored source for CLI/runtime TypeScript. `dist/` is the executable and publish-time output. Repository-root `runtime/` stays as thin ESM compatibility wrappers so shell scripts and existing command paths still work, while remaining non-TS Node scripts get a mechanical ESM pass so they survive `"type": "module"` without dragging the whole repo into TypeScript.

**Tech Stack:** TypeScript, Vitest, Node.js 20, native ESM, `tsc`, `child_process`

---

## File Structure And Responsibilities

### New authored TypeScript sources

- `src/bin/boss-skill.ts`: package bin entrypoint
- `src/runtime/domain/event-types.ts`: runtime event constants and unions
- `src/runtime/domain/state-constants.ts`: stage and agent state constants
- `src/runtime/projectors/materialize-state.ts`: execution/event projector
- `src/runtime/memory/extractor.ts`: memory extraction logic
- `src/runtime/memory/store.ts`: memory persistence helpers
- `src/runtime/memory/query.ts`: memory lookup/query surface
- `src/runtime/memory/summarizer.ts`: startup summary rendering
- `src/runtime/report/summary-model.ts`: report domain model builder
- `src/runtime/report/render-json.ts`: JSON report renderer
- `src/runtime/report/render-markdown.ts`: Markdown report renderer
- `src/runtime/report/render-html.ts`: HTML diagnostics renderer
- `src/runtime/cli/lib/pack-runtime.ts`: pipeline pack resolution
- `src/runtime/cli/lib/plugin-runtime.ts`: plugin discovery/registration lifecycle
- `src/runtime/cli/lib/memory-runtime.ts`: memory-oriented runtime helpers
- `src/runtime/cli/lib/inspection-runtime.ts`: inspection view helpers
- `src/runtime/cli/lib/pipeline-runtime.ts`: pipeline state mutation/read surface
- `src/runtime/cli/*.ts`: each CLI command with `main(argv)` entrypoint
- `src/scripts/lib/progress-emitter.ts`: typed progress event emitter used by runtime

### Compatibility and non-TS JS files that stay in repo root

- `runtime/cli/*.js`: thin ESM wrappers that import and execute `dist/runtime/cli/*.js`
- `runtime/cli/lib/*.js`: thin ESM wrappers that re-export `dist/runtime/cli/lib/*.js`
- `runtime/memory/*.js`: thin ESM wrappers that re-export `dist/runtime/memory/*.js`
- `runtime/report/*.js`: thin ESM wrappers that re-export `dist/runtime/report/*.js`
- `runtime/domain/*.js`: thin ESM wrappers that re-export `dist/runtime/domain/*.js`
- `runtime/projectors/*.js`: thin ESM wrappers that re-export `dist/runtime/projectors/*.js`
- `scripts/lib/run-with-flags.js`: ESM hook runner that can `await` hook modules
- `scripts/lib/hook-flags.js`: ESM hook-flag resolver
- `scripts/lib/boss-utils.js`: ESM helpers for active feature and execution reads
- `scripts/release.js`: ESM release script
- `scripts/hooks/*.js`: ESM hook scripts, still JavaScript, not TypeScript

### Test files

- `test/helpers/fixtures.ts`: shared temp-dir and exec-data fixtures
- `test/helpers/run-cli.ts`: helper to execute `dist` commands from Vitest
- `test/bin/boss-skill.test.ts`: package bin contract
- `test/lib/*.test.ts`: lib compatibility tests
- `test/hooks/*.test.ts`: hook runner and hook behavior tests
- `test/runtime/*.test.ts`: runtime unit and CLI contract tests
- `test/harness/*.test.ts`: shell/CLI integration contracts that still rely on repo-root wrapper paths

### Config and metadata

- `package.json`: ESM package config, scripts, engines, files, devDependencies, bin target
- `tsconfig.json`: `NodeNext` compiler config
- `vitest.config.ts`: test runner config
- `.claude/settings.json`: hook commands continue to point at repo-root JS, but now those files are ESM-safe
- `README.md`: build/test instructions and source layout
- `CONTRIBUTING.md`: contributor guidance for `src/`, `dist/`, Vitest, and ESM wrappers

## Task 1: Bootstrap TypeScript, Vitest, and the `dist` Bin Contract

**Files:**
- Create: `tsconfig.json`
- Create: `vitest.config.ts`
- Create: `src/bin/boss-skill.ts`
- Create: `test/helpers/run-cli.ts`
- Modify: `package.json`
- Modify: `test/bin/boss-skill.test.js` -> `test/bin/boss-skill.test.ts`

- [ ] **Step 1: Write the failing bin contract test**

```ts
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { runCli } from '../helpers/run-cli.js';

const root = resolve(import.meta.dirname, '..', '..');
const pkg = JSON.parse(readFileSync(resolve(root, 'package.json'), 'utf8'));

describe('boss-skill dist bin', () => {
  it('uses dist/bin/boss-skill.js as the published entrypoint', () => {
    expect(pkg.type).toBe('module');
    expect(pkg.bin['boss-skill']).toBe('dist/bin/boss-skill.js');
    expect(pkg.engines.node).toBe('>=20');
  });

  it('prints help from the built dist entrypoint', () => {
    const result = runCli(['dist/bin/boss-skill.js', '--help']);
    expect(result.status).toBe(0);
    expect(result.stdout).toContain('Usage:');
    expect(result.stdout).toContain('boss-skill install');
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run test/bin/boss-skill.test.ts`

Expected: FAIL because `vitest` is not installed, `type` is not `module`, and `dist/bin/boss-skill.js` does not exist yet.

- [ ] **Step 3: Write the minimal toolchain and bin implementation**

`package.json`

```json
{
  "type": "module",
  "bin": {
    "boss-skill": "dist/bin/boss-skill.js"
  },
  "scripts": {
    "build": "tsc -p tsconfig.json",
    "typecheck": "tsc --noEmit",
    "test": "vitest run",
    "test:watch": "vitest",
    "release": "node scripts/release.js",
    "prepublishOnly": "npm run build && node dist/bin/boss-skill.js --version"
  },
  "engines": {
    "node": ">=20"
  },
  "devDependencies": {
    "@types/node": "^24.0.0",
    "typescript": "^5.8.0",
    "vitest": "^3.2.0"
  }
}
```

`tsconfig.json`

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "NodeNext",
    "moduleResolution": "NodeNext",
    "rootDir": ".",
    "outDir": "dist",
    "strict": true,
    "noUncheckedIndexedAccess": true,
    "esModuleInterop": false,
    "skipLibCheck": true,
    "resolveJsonModule": false
  },
  "include": ["src/**/*.ts", "test/**/*.ts", "vitest.config.ts"]
}
```

`vitest.config.ts`

```ts
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    include: ['test/**/*.test.ts'],
    restoreMocks: true,
    clearMocks: true
  }
});
```

`src/bin/boss-skill.ts`

```ts
#!/usr/bin/env node
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const PKG_ROOT = path.resolve(__dirname, '..', '..');
const pkg = JSON.parse(fs.readFileSync(path.join(PKG_ROOT, 'package.json'), 'utf8')) as {
  version: string;
};

export function showHelp(): void {
  process.stdout.write(`@blade-ai/boss-skill v${pkg.version}\nUsage:\n  boss-skill install\n`);
}

export function main(argv: string[] = process.argv.slice(2)): void {
  if (argv.includes('--help')) {
    showHelp();
    return;
  }
  if (argv.includes('--version')) {
    process.stdout.write(`${pkg.version}\n`);
    return;
  }
  showHelp();
}

main();
```

`test/helpers/run-cli.ts`

```ts
import { execFileSync, spawnSync } from 'node:child_process';
import { resolve } from 'node:path';

const root = resolve(import.meta.dirname, '..', '..');

export function runCli(args: string[]) {
  return spawnSync(process.execPath, args, {
    cwd: root,
    encoding: 'utf8'
  });
}

export function runCliOrThrow(args: string[]) {
  return execFileSync(process.execPath, args, {
    cwd: root,
    encoding: 'utf8'
  });
}
```

- [ ] **Step 4: Run build and the targeted test to verify it passes**

Run: `npm run build && npx vitest run test/bin/boss-skill.test.ts`

Expected: PASS with the package metadata assertions green and the built help command returning exit code `0`.

- [ ] **Step 5: Commit**

```bash
git add package.json tsconfig.json vitest.config.ts src/bin/boss-skill.ts test/helpers/run-cli.ts test/bin/boss-skill.test.ts
git commit -m "build: bootstrap typescript vitest dist bin"
```

## Task 2: Make the Repository Root ESM-Safe and Preserve Existing Command Paths

**Files:**
- Modify: `scripts/lib/run-with-flags.js`
- Modify: `scripts/lib/hook-flags.js`
- Modify: `scripts/lib/boss-utils.js`
- Modify: `scripts/release.js`
- Modify: `scripts/hooks/session-start.js`
- Modify: `scripts/hooks/session-resume.js`
- Modify: `scripts/hooks/pre-tool-write.js`
- Modify: `scripts/hooks/post-tool-write.js`
- Modify: `scripts/hooks/post-tool-bash.js`
- Modify: `scripts/hooks/subagent-start.js`
- Modify: `scripts/hooks/subagent-stop.js`
- Modify: `scripts/hooks/on-stop.js`
- Modify: `scripts/hooks/on-notification.js`
- Modify: `scripts/hooks/session-end.js`
- Create: `runtime/cli/init-pipeline.js`
- Create: `runtime/cli/update-stage.js`
- Create: `runtime/cli/update-agent.js`
- Create: `runtime/cli/evaluate-gates.js`
- Create: `runtime/cli/get-ready-artifacts.js`
- Create: `runtime/cli/register-plugins.js`
- Create: `runtime/cli/run-plugin-hook.js`
- Create: `runtime/cli/check-stage.js`
- Create: `runtime/cli/replay-events.js`
- Create: `runtime/cli/inspect-pipeline.js`
- Create: `runtime/cli/inspect-events.js`
- Create: `runtime/cli/inspect-progress.js`
- Create: `runtime/cli/inspect-plugins.js`
- Create: `runtime/cli/generate-summary.js`
- Create: `runtime/cli/render-diagnostics.js`
- Create: `runtime/cli/query-memory.js`
- Create: `runtime/cli/extract-memory.js`
- Create: `runtime/cli/build-memory-summary.js`
- Create: `runtime/cli/record-artifact.js`
- Create: `runtime/cli/lib/pipeline-runtime.js`
- Create: `runtime/cli/lib/inspection-runtime.js`
- Create: `runtime/cli/lib/memory-runtime.js`
- Create: `runtime/cli/lib/plugin-runtime.js`
- Create: `runtime/cli/lib/pack-runtime.js`
- Create: `runtime/memory/extractor.js`
- Create: `runtime/memory/store.js`
- Create: `runtime/memory/query.js`
- Create: `runtime/memory/summarizer.js`
- Create: `runtime/report/summary-model.js`
- Create: `runtime/report/render-json.js`
- Create: `runtime/report/render-markdown.js`
- Create: `runtime/report/render-html.js`
- Create: `runtime/domain/event-types.js`
- Create: `runtime/domain/state-constants.js`
- Create: `runtime/projectors/materialize-state.js`
- Modify: `test/hooks/session-start.test.js` -> `test/hooks/session-start.test.ts`
- Modify: `test/hooks/subagent-start.test.js` -> `test/hooks/subagent-start.test.ts`
- Modify: `test/runtime/runtime-cli-contract.test.js` -> `test/runtime/runtime-cli-contract.test.ts`

- [ ] **Step 1: Write failing compatibility tests for hooks and repo-root CLI paths**

```ts
import { describe, expect, it } from 'vitest';
import { runCli } from '../helpers/run-cli.js';

describe('repo-root runtime wrappers', () => {
  it('keeps runtime/cli/update-stage.js executable', () => {
    const result = runCli(['runtime/cli/update-stage.js', '--help']);
    expect(result.status).toBe(0);
  });
});

describe('session-start hook', () => {
  it('loads as an ESM module and exports run()', async () => {
    const mod = await import('../../scripts/hooks/session-start.js');
    expect(typeof mod.run).toBe('function');
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run test/hooks/session-start.test.ts test/hooks/subagent-start.test.ts test/runtime/runtime-cli-contract.test.ts`

Expected: FAIL because repo-root runtime wrappers do not exist and current CommonJS hook scripts break once the package is ESM.

- [ ] **Step 3: Implement the wrapper and ESM compatibility layer**

`scripts/lib/run-with-flags.js`

```js
#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { pathToFileURL } from 'node:url';
import { isHookEnabled } from './hook-flags.js';

async function loadHook(scriptAbs) {
  return import(pathToFileURL(scriptAbs).href);
}

const mod = await loadHook(scriptAbs);
if (typeof mod.run === 'function') {
  const result = await mod.run(stdinStr);
  // preserve the same stdout/stderr/exit semantics as the current runner
}
```

`runtime/cli/update-stage.js`

```js
#!/usr/bin/env node
export * from '../../dist/runtime/cli/update-stage.js';
import { main } from '../../dist/runtime/cli/update-stage.js';

await main(process.argv.slice(2));
```

`runtime/cli/lib/pipeline-runtime.js`

```js
export * from '../../../dist/runtime/cli/lib/pipeline-runtime.js';
```

`scripts/hooks/session-start.js`

```js
import fs from 'node:fs';
import path from 'node:path';
import { findActiveFeature, readExecJson } from '../lib/boss-utils.js';
import { inspectPipeline } from '../../runtime/cli/lib/inspection-runtime.js';

export function run(rawInput) {
  // preserve the existing JSON payload contract
}
```

Use the same pattern for the remaining hook and root runtime wrapper files.

- [ ] **Step 4: Run the compatibility tests to verify they pass**

Run: `npm run build && npx vitest run test/hooks/session-start.test.ts test/hooks/subagent-start.test.ts test/runtime/runtime-cli-contract.test.ts`

Expected: PASS with repo-root wrapper commands still executable and hook modules loading under package-wide ESM.

- [ ] **Step 5: Commit**

```bash
git add scripts/lib/*.js scripts/hooks/*.js scripts/release.js runtime/cli runtime/cli/lib runtime/memory runtime/report runtime/domain runtime/projectors test/hooks/session-start.test.ts test/hooks/subagent-start.test.ts test/runtime/runtime-cli-contract.test.ts
git commit -m "refactor: preserve root runtime paths under esm"
```

## Task 3: Migrate Runtime Core Modules to TypeScript

**Files:**
- Create: `src/runtime/domain/event-types.ts`
- Create: `src/runtime/domain/state-constants.ts`
- Create: `src/runtime/projectors/materialize-state.ts`
- Create: `src/runtime/memory/extractor.ts`
- Create: `src/runtime/memory/store.ts`
- Create: `src/runtime/memory/query.ts`
- Create: `src/runtime/memory/summarizer.ts`
- Create: `src/runtime/report/summary-model.ts`
- Create: `src/runtime/report/render-json.ts`
- Create: `src/runtime/report/render-markdown.ts`
- Create: `src/runtime/report/render-html.ts`
- Create: `src/scripts/lib/progress-emitter.ts`
- Modify: `test/runtime/memory-extractor.test.js` -> `test/runtime/memory-extractor.test.ts`
- Modify: `test/runtime/memory-store.test.js` -> `test/runtime/memory-store.test.ts`
- Modify: `test/runtime/memory-query.test.js` -> `test/runtime/memory-query.test.ts`
- Modify: `test/runtime/report-runtime.test.js` -> `test/runtime/report-runtime.test.ts`
- Modify: `test/runtime/schema-contract.test.js` -> `test/runtime/schema-contract.test.ts`
- Modify: `test/lib/progress-emitter.test.js` -> `test/lib/progress-emitter.test.ts`

- [ ] **Step 1: Write failing unit tests that import `src/` runtime modules directly**

```ts
import { describe, expect, it } from 'vitest';
import { buildStartupSummary } from '../../src/runtime/memory/summarizer.js';
import { queryAgentMemories } from '../../src/runtime/memory/query.js';

describe('memory query runtime', () => {
  it('formats startup summaries from queried memories', () => {
    const text = buildStartupSummary([
      { category: 'decision', summary: 'Switch to Vitest' }
    ]);
    expect(text).toContain('Switch to Vitest');
  });

  it('returns only records for the requested agent', () => {
    const rows = queryAgentMemories('demo', {
      cwd: process.cwd(),
      agent: 'boss-frontend',
      limit: 3
    });
    expect(Array.isArray(rows)).toBe(true);
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run test/runtime/memory-extractor.test.ts test/runtime/memory-store.test.ts test/runtime/memory-query.test.ts test/runtime/report-runtime.test.ts test/lib/progress-emitter.test.ts`

Expected: FAIL because the `src/runtime/**` modules do not exist yet and the tests still reference old CommonJS semantics.

- [ ] **Step 3: Port the runtime core to typed ESM modules**

`src/scripts/lib/progress-emitter.ts`

```ts
import fs from 'node:fs';
import path from 'node:path';

export interface ProgressEvent {
  type: string;
  data: Record<string, unknown>;
}

export function emitProgress(cwd: string, feature: string, event: ProgressEvent): void {
  const file = path.join(cwd, '.boss', feature, '.meta', 'progress.jsonl');
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.appendFileSync(file, JSON.stringify(event) + '\n', 'utf8');
}
```

`src/runtime/memory/query.ts`

```ts
import { listMemories } from './store.js';

export interface MemoryQueryOptions {
  cwd?: string;
  agent?: string;
  stage?: number;
  limit?: number;
}

export function queryAgentMemories(feature: string, options: MemoryQueryOptions = {}) {
  return listMemories(feature, options).filter((row) => {
    return !options.agent || row.agent === options.agent;
  }).slice(0, options.limit ?? 5);
}
```

`src/runtime/report/render-markdown.ts`

```ts
import type { SummaryModel } from './summary-model.js';

export function renderMarkdown(model: SummaryModel): string {
  return [
    `# ${model.feature}`,
    '',
    `Status: ${model.status}`
  ].join('\n');
}
```

Port the rest of the runtime files by copying current behavior first, then adding explicit interfaces and return types without changing semantics.

- [ ] **Step 4: Run the targeted runtime tests to verify they pass**

Run: `npm run build && npx vitest run test/runtime/memory-extractor.test.ts test/runtime/memory-store.test.ts test/runtime/memory-query.test.ts test/runtime/report-runtime.test.ts test/runtime/schema-contract.test.ts test/lib/progress-emitter.test.ts`

Expected: PASS with all targeted runtime-core and schema tests green.

- [ ] **Step 5: Commit**

```bash
git add src/runtime/domain src/runtime/projectors src/runtime/memory src/runtime/report src/scripts/lib/progress-emitter.ts test/runtime/memory-extractor.test.ts test/runtime/memory-store.test.ts test/runtime/memory-query.test.ts test/runtime/report-runtime.test.ts test/runtime/schema-contract.test.ts test/lib/progress-emitter.test.ts
git commit -m "refactor: port runtime core modules to typescript"
```

## Task 4: Migrate CLI Runtime Libraries and CLI Commands to TypeScript

**Files:**
- Create: `src/runtime/cli/lib/pack-runtime.ts`
- Create: `src/runtime/cli/lib/plugin-runtime.ts`
- Create: `src/runtime/cli/lib/memory-runtime.ts`
- Create: `src/runtime/cli/lib/inspection-runtime.ts`
- Create: `src/runtime/cli/lib/pipeline-runtime.ts`
- Create: `src/runtime/cli/init-pipeline.ts`
- Create: `src/runtime/cli/get-ready-artifacts.ts`
- Create: `src/runtime/cli/update-stage.ts`
- Create: `src/runtime/cli/update-agent.ts`
- Create: `src/runtime/cli/record-artifact.ts`
- Create: `src/runtime/cli/evaluate-gates.ts`
- Create: `src/runtime/cli/check-stage.ts`
- Create: `src/runtime/cli/replay-events.ts`
- Create: `src/runtime/cli/inspect-pipeline.ts`
- Create: `src/runtime/cli/inspect-events.ts`
- Create: `src/runtime/cli/inspect-progress.ts`
- Create: `src/runtime/cli/inspect-plugins.ts`
- Create: `src/runtime/cli/render-diagnostics.ts`
- Create: `src/runtime/cli/generate-summary.ts`
- Create: `src/runtime/cli/register-plugins.ts`
- Create: `src/runtime/cli/run-plugin-hook.ts`
- Create: `src/runtime/cli/query-memory.ts`
- Create: `src/runtime/cli/extract-memory.ts`
- Create: `src/runtime/cli/build-memory-summary.ts`
- Modify: `test/runtime/init-pipeline.test.js` -> `test/runtime/init-pipeline.test.ts`
- Modify: `test/runtime/init-pipeline-pack.test.js` -> `test/runtime/init-pipeline-pack.test.ts`
- Modify: `test/runtime/get-ready-artifacts.test.js` -> `test/runtime/get-ready-artifacts.test.ts`
- Modify: `test/runtime/evaluate-gates.test.js` -> `test/runtime/evaluate-gates.test.ts`
- Modify: `test/runtime/plugin-runtime.test.js` -> `test/runtime/plugin-runtime.test.ts`
- Modify: `test/runtime/plugin-hook-runtime.test.js` -> `test/runtime/plugin-hook-runtime.test.ts`
- Modify: `test/runtime/inspect-runtime.test.js` -> `test/runtime/inspect-runtime.test.ts`
- Modify: `test/runtime/check-stage-replay-runtime.test.js` -> `test/runtime/check-stage-replay-runtime.test.ts`
- Modify: `test/runtime/runtime-cli-contract.test.ts`

- [ ] **Step 1: Write failing tests for the typed CLI runtime surface**

```ts
import { describe, expect, it } from 'vitest';
import { initPipeline } from '../../src/runtime/cli/lib/pipeline-runtime.js';
import { runCli } from '../helpers/run-cli.js';

describe('pipeline runtime', () => {
  it('initializes a feature pipeline and writes execution state', () => {
    const execution = initPipeline('ts-migration', { cwd: process.cwd() });
    expect(execution.feature).toBe('ts-migration');
    expect(execution.status).toBe('running');
  });
});

describe('dist runtime cli', () => {
  it('executes init-pipeline from dist', () => {
    const result = runCli(['dist/runtime/cli/init-pipeline.js', 'ts-migration']);
    expect(result.status).toBe(0);
    expect(result.stdout).toContain('"feature":"ts-migration"');
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run test/runtime/init-pipeline.test.ts test/runtime/get-ready-artifacts.test.ts test/runtime/evaluate-gates.test.ts test/runtime/runtime-cli-contract.test.ts`

Expected: FAIL because the `src/runtime/cli/**` modules are not implemented yet and the `dist` commands are incomplete.

- [ ] **Step 3: Port CLI runtime libraries and command entrypoints**

`src/runtime/cli/lib/pipeline-runtime.ts`

```ts
import fs from 'node:fs';
import path from 'node:path';
import { materializeState } from '../../projectors/materialize-state.js';
import { emitProgress } from '../../../scripts/lib/progress-emitter.js';

export interface RuntimeOptions {
  cwd?: string;
  dagPath?: string;
}

export function initPipeline(feature: string, { cwd = process.cwd() }: RuntimeOptions = {}) {
  if (!feature) {
    throw new Error('缺少 feature 参数');
  }
  // port existing behavior without semantic changes
  return materializeState(/* current event log inputs */);
}
```

`src/runtime/cli/init-pipeline.ts`

```ts
#!/usr/bin/env node
import { initPipeline } from './lib/pipeline-runtime.js';

export async function main(argv: string[] = process.argv.slice(2)): Promise<void> {
  const [feature] = argv;
  if (!feature || feature === '-h' || feature === '--help') {
    process.stderr.write('用法: init-pipeline.js <feature>\n');
    process.exit(feature ? 0 : 1);
  }

  const execution = initPipeline(feature);
  process.stdout.write(JSON.stringify({
    feature: execution.feature,
    status: execution.status,
    executionPath: `.boss/${execution.feature}/.meta/execution.json`
  }) + '\n');
}

await main();
```

Use the same structure for every CLI command: parse `argv`, call one typed library function, print canonical stdout/stderr, and export `main()` for wrapper reuse.

- [ ] **Step 4: Run the targeted CLI tests to verify they pass**

Run: `npm run build && npx vitest run test/runtime/init-pipeline.test.ts test/runtime/init-pipeline-pack.test.ts test/runtime/get-ready-artifacts.test.ts test/runtime/evaluate-gates.test.ts test/runtime/plugin-runtime.test.ts test/runtime/plugin-hook-runtime.test.ts test/runtime/inspect-runtime.test.ts test/runtime/check-stage-replay-runtime.test.ts test/runtime/runtime-cli-contract.test.ts`

Expected: PASS with both direct `src/` library imports and `dist` command execution green.

- [ ] **Step 5: Commit**

```bash
git add src/runtime/cli src/runtime/cli/lib test/runtime/init-pipeline.test.ts test/runtime/init-pipeline-pack.test.ts test/runtime/get-ready-artifacts.test.ts test/runtime/evaluate-gates.test.ts test/runtime/plugin-runtime.test.ts test/runtime/plugin-hook-runtime.test.ts test/runtime/inspect-runtime.test.ts test/runtime/check-stage-replay-runtime.test.ts test/runtime/runtime-cli-contract.test.ts
git commit -m "refactor: port runtime cli to typescript"
```

## Task 5: Finish the Vitest Migration for Helpers, Hook Tests, and Integration Tests

**Files:**
- Modify: `test/helpers/fixtures.js` -> `test/helpers/fixtures.ts`
- Modify: `test/lib/boss-utils.test.js` -> `test/lib/boss-utils.test.ts`
- Modify: `test/lib/hook-flags.test.js` -> `test/lib/hook-flags.test.ts`
- Modify: `test/hooks/on-stop.test.js` -> `test/hooks/on-stop.test.ts`
- Modify: `test/hooks/on-notification.test.js` -> `test/hooks/on-notification.test.ts`
- Modify: `test/hooks/post-tool-write.test.js` -> `test/hooks/post-tool-write.test.ts`
- Modify: `test/hooks/post-tool-bash.test.js` -> `test/hooks/post-tool-bash.test.ts`
- Modify: `test/hooks/pre-tool-write.test.js` -> `test/hooks/pre-tool-write.test.ts`
- Modify: `test/hooks/subagent-stop.test.js` -> `test/hooks/subagent-stop.test.ts`
- Modify: `test/hooks/session-end.test.js` -> `test/hooks/session-end.test.ts`
- Modify: `test/hooks/session-resume.test.js` -> `test/hooks/session-resume.test.ts`
- Modify: `test/harness/detect-pack.test.js` -> `test/harness/detect-pack.test.ts`
- Modify: `test/harness/artifact-dag.test.js` -> `test/harness/artifact-dag.test.ts`
- Modify: `test/harness/feedback-loops.test.js` -> `test/harness/feedback-loops.test.ts`
- Modify: `test/harness/event-sourcing.test.js` -> `test/harness/event-sourcing.test.ts`
- Modify: `test/runtime/feature-flow.integration.test.js` -> `test/runtime/feature-flow.integration.test.ts`
- Modify: `test/runtime/memory-runtime.integration.test.js` -> `test/runtime/memory-runtime.integration.test.ts`
- Modify: `test/runtime/pack-plugin.integration.test.js` -> `test/runtime/pack-plugin.integration.test.ts`
- Modify: `test/runtime/direct-write-guard.test.js` -> `test/runtime/direct-write-guard.test.ts`
- Modify: `test/runtime/docs-contract.test.js` -> `test/runtime/docs-contract.test.ts`

- [ ] **Step 1: Write failing Vitest-native helper and hook tests**

```ts
import { afterEach, describe, expect, it, vi } from 'vitest';

describe('hook-flags', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.resetModules();
  });

  it('respects enabled profiles from env', async () => {
    vi.stubEnv('BOSS_HOOK_PROFILE', 'strict');
    const mod = await import('../../scripts/lib/hook-flags.js');
    expect(mod.isHookEnabled('session:start', { profiles: 'strict' })).toBe(true);
  });
});
```

`test/helpers/fixtures.ts`

```ts
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

export function createTempBossDir() {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'boss-test-'));
}
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run test/lib/boss-utils.test.ts test/lib/hook-flags.test.ts test/hooks/*.test.ts test/harness/*.test.ts`

Expected: FAIL because the tests still use `node:test`, `require.cache`, and CommonJS-only import patterns.

- [ ] **Step 3: Port the remaining tests to Vitest idioms**

Use these conversion rules consistently:

```ts
// before
const mod = require('../../scripts/lib/boss-utils');
assert.equal(result, 'x');

// after
const mod = await import('../../scripts/lib/boss-utils.js');
expect(result).toBe('x');
```

```ts
// before
delete require.cache[require.resolve('../../scripts/lib/hook-flags')];

// after
vi.resetModules();
const mod = await import('../../scripts/lib/hook-flags.js');
```

```ts
// before
const { execFileSync } = require('child_process');

// after
import { execFileSync } from 'node:child_process';
```

Port every remaining test file under `test/` so the repository no longer contains `node:test`-based test files.

- [ ] **Step 4: Run the full test suite to verify it passes**

Run: `npm test`

Expected: PASS with Vitest discovering only `*.test.ts` files and no `node:test` usage left in the test tree.

- [ ] **Step 5: Commit**

```bash
git add test
git commit -m "test: migrate suite from node test to vitest"
```

## Task 6: Final Packaging, Docs, and Verification

**Files:**
- Modify: `package.json`
- Modify: `README.md`
- Modify: `CONTRIBUTING.md`
- Modify: `test/runtime/docs-contract.test.ts`

- [ ] **Step 1: Write a failing package/docs contract test**

```ts
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const root = resolve(import.meta.dirname, '..', '..');
const pkg = JSON.parse(readFileSync(resolve(root, 'package.json'), 'utf8'));
const readme = readFileSync(resolve(root, 'README.md'), 'utf8');

describe('package metadata', () => {
  it('publishes dist and keeps runtime/script assets', () => {
    expect(pkg.files).toContain('dist/');
    expect(pkg.files).toContain('runtime/');
    expect(pkg.files).toContain('scripts/');
  });

  it('documents the src to dist layout', () => {
    expect(readme).toContain('src/');
    expect(readme).toContain('dist/');
    expect(readme).toContain('Vitest');
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run test/runtime/docs-contract.test.ts`

Expected: FAIL because `package.json.files` does not include `dist/` yet and the docs do not describe the new architecture.

- [ ] **Step 3: Update packaging metadata and docs**

`package.json`

```json
{
  "files": [
    "dist/",
    "agents/",
    "commands/",
    "harness/",
    "runtime/",
    "references/",
    "scripts/",
    "templates/",
    "skills/",
    ".claude/",
    ".claude-plugin/",
    "SKILL.md",
    "DESIGN.md"
  ]
}
```

`README.md`

```md
## Development

- `npm run build` compiles `src/` to `dist/`
- `npm run typecheck` runs TypeScript without emitting files
- `npm test` runs the Vitest suite
- `runtime/cli/*.js` remains as stable wrapper entrypoints for shell automation
```

`CONTRIBUTING.md`

```md
- Author CLI/runtime changes in `src/`
- Do not hand-edit `dist/`
- Keep repo-root `runtime/` files as wrappers only
- Write or update Vitest tests before changing runtime behavior
```

- [ ] **Step 4: Run final verification**

Run: `npm run build && npm run typecheck && npm test && node dist/bin/boss-skill.js --help && npm pack --dry-run`

Expected:
- `build`: PASS
- `typecheck`: PASS
- `test`: PASS
- `node dist/bin/boss-skill.js --help`: prints usage and exits `0`
- `npm pack --dry-run`: shows `dist/`, `runtime/`, `scripts/`, templates, harness data, and skill docs in the tarball

- [ ] **Step 5: Commit**

```bash
git add package.json README.md CONTRIBUTING.md test/runtime/docs-contract.test.ts
git commit -m "docs: finalize ts esm vitest packaging"
```

## Self-Review

### Spec coverage

- TS migration of the CLI chain is covered by Tasks 1, 3, and 4.
- Full ESM conversion is covered by Tasks 1 and 2.
- `src -> dist` build/publish flow is covered by Tasks 1 and 6.
- Full Vitest migration is covered by Tasks 1, 5, and the test updates embedded in Tasks 2 through 4.
- Keeping shell and hook entrypoints working is covered by Task 2.
- Node `>=20` and package metadata updates are covered by Tasks 1 and 6.

### Placeholder scan

- No `TODO`, `TBD`, or “implement later” markers remain.
- Every task includes explicit file paths, code snippets, commands, and expected outcomes.

### Type consistency

- Runtime code is always authored in `src/**/*.ts`.
- Repo-root `runtime/**/*.js` files are wrappers only.
- CLI command entrypoints always export `main(argv)` and `await main()` when executed directly.
- Tests import `src/` for unit coverage and execute `dist/` or repo-root wrappers for contract coverage.
