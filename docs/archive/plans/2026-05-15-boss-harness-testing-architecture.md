# Boss Harness Testing Architecture Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a deterministic Boss harness test layer that verifies workflow scenarios, event trace invariants, fault handling foundations, and install/skill contracts before adding slow real-agent evals.

**Architecture:** Add a scenario runner under `test/harness/` that creates isolated workspaces, runs local Boss CLI commands, reads `.boss/<feature>/.meta/events.jsonl`, replays materialized state, and applies shared trace/artifact assertions. Keep fast deterministic tests in Vitest; reserve real Codex/Claude transcript tests for later phases.

**Tech Stack:** TypeScript, Vitest, Node.js `fs/os/path/child_process`, existing Boss CLI dist entrypoint, existing `materialize-state.ts` projector and runtime event types.

---

## File Structure

- Create: `test/harness/scenario-runner.ts`
  - Loads scenario manifests, creates temp workspaces, copies fixtures, runs CLI commands, reads state/events, and returns structured results.
- Create: `test/harness/trace-invariants.ts`
  - Validates event schema basics, timestamp parseability, pipeline-before-stage ordering, stage lifecycle ordering, retry references, and replay consistency.
- Create: `test/harness/artifact-assertions.ts`
  - Helpers for checking required artifact paths, forbidden side effects, state paths, and expected event types.
- Create: `test/harness/scenarios/project-init-default/scenario.json`
  - Minimal deterministic scenario for `boss project init`.
- Create: `test/harness/scenarios/api-only-pack-detection/fixture/package.json`
  - API-only package fixture.
- Create: `test/harness/scenarios/api-only-pack-detection/scenario.json`
  - Scenario for pack detection evidence.
- Create: `test/harness/scenarios/plugin-gate-failure/fixture/.boss/plugins/fail-once/plugin.json`
  - Fake gate plugin manifest.
- Create: `test/harness/scenarios/plugin-gate-failure/fixture/.boss/plugins/fail-once/gate.js`
  - Fake gate implementation that fails, then passes after marker file exists.
- Create: `test/harness/scenarios/plugin-gate-failure/scenario.json`
  - Scenario that verifies failed gate is captured, then passes after marker.
- Create: `test/harness/scenario-runner.test.ts`
  - Vitest coverage for all Phase 1 scenarios.
- Modify: `package.json`
  - Add `test:harness` script.

## Task 1: Add Scenario Runner Types and Workspace Execution

**Files:**
- Create: `test/harness/scenario-runner.ts`
- Test: `test/harness/scenario-runner.test.ts`

- [ ] **Step 1: Write failing test for scenario manifest loading**

Add `test/harness/scenario-runner.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import path from 'node:path';
import { loadScenario } from './scenario-runner.js';

const SCENARIOS = path.resolve(import.meta.dirname, 'scenarios');

describe('Boss harness scenario runner', () => {
  it('loads a scenario manifest with commands and expectations', () => {
    const scenario = loadScenario(path.join(SCENARIOS, 'project-init-default', 'scenario.json'));

    expect(scenario.name).toBe('project-init-default');
    expect(scenario.feature).toBe('harness-init');
    expect(scenario.commands.length).toBeGreaterThan(0);
    expect(scenario.expect.artifacts).toContain('.boss/harness-init/.meta/execution.json');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run:

```bash
npm test -- test/harness/scenario-runner.test.ts
```

Expected: FAIL because `test/harness/scenario-runner.ts` and scenario files do not exist.

- [ ] **Step 3: Implement minimal scenario loader**

Create `test/harness/scenario-runner.ts`:

```ts
import fs from 'node:fs';
import path from 'node:path';

export interface ScenarioCommand {
  run: string[];
  expectExit?: number;
}

export interface ScenarioManifest {
  name: string;
  description: string;
  feature: string;
  fixture?: string;
  commands: ScenarioCommand[];
  expect: {
    artifacts?: string[];
    forbidPaths?: string[];
    events?: string[];
    state?: Record<string, unknown>;
  };
}

export function loadScenario(manifestPath: string): ScenarioManifest {
  const raw = fs.readFileSync(manifestPath, 'utf8');
  const scenario = JSON.parse(raw) as ScenarioManifest;
  if (!scenario.name || !scenario.feature || !Array.isArray(scenario.commands)) {
    throw new Error(`Invalid scenario manifest: ${manifestPath}`);
  }
  return scenario;
}

export function scenarioRoot(manifestPath: string): string {
  return path.dirname(manifestPath);
}
```

Create `test/harness/scenarios/project-init-default/scenario.json`:

```json
{
  "name": "project-init-default",
  "description": "Initializes a Boss project and verifies metadata scaffold.",
  "feature": "harness-init",
  "commands": [
    { "run": ["boss", "project", "init", "harness-init", "--json"] }
  ],
  "expect": {
    "artifacts": [
      ".boss/harness-init/.meta/execution.json",
      ".boss/harness-init/.meta/events.jsonl",
      ".boss/harness-init/prd.md",
      ".boss/harness-init/architecture.md"
    ],
    "events": ["PipelineInitialized"],
    "state": {
      "feature": "harness-init"
    }
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run:

```bash
npm test -- test/harness/scenario-runner.test.ts
```

Expected: PASS.

## Task 2: Execute Scenario Commands in Isolated Workspaces

**Files:**
- Modify: `test/harness/scenario-runner.ts`
- Modify: `test/harness/scenario-runner.test.ts`

- [ ] **Step 1: Add failing test for running project-init scenario**

Append to `test/harness/scenario-runner.test.ts`:

```ts
import { runScenario } from './scenario-runner.js';

it('runs project-init-default in an isolated workspace', () => {
  const result = runScenario(path.join(SCENARIOS, 'project-init-default', 'scenario.json'));

  expect(result.commands.map((command) => command.exitCode)).toEqual([0]);
  expect(result.workspace).toContain('boss-harness-');
  expect(result.events.map((event) => event.type)).toContain('PipelineInitialized');
  expect(result.execution.feature).toBe('harness-init');
});
```

- [ ] **Step 2: Run test to verify it fails**

Run:

```bash
npm test -- test/harness/scenario-runner.test.ts
```

Expected: FAIL because `runScenario` does not exist.

- [ ] **Step 3: Implement command execution and state/event loading**

Extend `test/harness/scenario-runner.ts`:

```ts
import { spawnSync } from 'node:child_process';
import os from 'node:os';
import { projectState } from '../../packages/boss-cli/src/runtime/projectors/materialize-state.js';

const REPO_ROOT = path.resolve(import.meta.dirname, '..', '..');
const BOSS_BIN = path.join(REPO_ROOT, 'packages', 'boss-cli', 'dist', 'bin', 'boss.js');

export interface ScenarioCommandResult {
  command: string[];
  exitCode: number | null;
  stdout: string;
  stderr: string;
}

export interface ScenarioRunResult {
  scenario: ScenarioManifest;
  workspace: string;
  commands: ScenarioCommandResult[];
  events: Array<{ id: number; type: string; timestamp: string; data: Record<string, unknown> }>;
  execution: Record<string, unknown>;
}

function copyDirectory(src: string, dest: string): void {
  if (!fs.existsSync(src)) return;
  fs.mkdirSync(dest, { recursive: true });
  for (const entry of fs.readdirSync(src, { withFileTypes: true })) {
    const from = path.join(src, entry.name);
    const to = path.join(dest, entry.name);
    if (entry.isDirectory()) {
      copyDirectory(from, to);
    } else if (entry.isFile()) {
      fs.copyFileSync(from, to);
    }
  }
}

function resolveCommand(command: string[]): string[] {
  if (command[0] !== 'boss') return command;
  return [process.execPath, BOSS_BIN, ...command.slice(1)];
}

function readJsonl(filePath: string): Array<{ id: number; type: string; timestamp: string; data: Record<string, unknown> }> {
  if (!fs.existsSync(filePath)) return [];
  return fs
    .readFileSync(filePath, 'utf8')
    .trim()
    .split('\n')
    .filter(Boolean)
    .map((line) => JSON.parse(line));
}

export function runScenario(manifestPath: string): ScenarioRunResult {
  const scenario = loadScenario(manifestPath);
  const root = scenarioRoot(manifestPath);
  const workspace = fs.mkdtempSync(path.join(os.tmpdir(), 'boss-harness-'));
  if (scenario.fixture) {
    copyDirectory(path.join(root, scenario.fixture), workspace);
  }

  const commands = scenario.commands.map((command) => {
    const resolved = resolveCommand(command.run);
    const result = spawnSync(resolved[0], resolved.slice(1), {
      cwd: workspace,
      encoding: 'utf8'
    });
    return {
      command: command.run,
      exitCode: result.status,
      stdout: result.stdout,
      stderr: result.stderr
    };
  });

  const eventPath = path.join(workspace, '.boss', scenario.feature, '.meta', 'events.jsonl');
  const executionPath = path.join(workspace, '.boss', scenario.feature, '.meta', 'execution.json');
  const events = readJsonl(eventPath);
  const execution = fs.existsSync(executionPath)
    ? JSON.parse(fs.readFileSync(executionPath, 'utf8'))
    : projectState(events, scenario.feature);

  return { scenario, workspace, commands, events, execution };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run:

```bash
npm test -- test/harness/scenario-runner.test.ts
```

Expected: PASS.

## Task 3: Add Artifact and State Assertions

**Files:**
- Create: `test/harness/artifact-assertions.ts`
- Modify: `test/harness/scenario-runner.test.ts`

- [ ] **Step 1: Write failing test for scenario expectation assertions**

Append to `test/harness/scenario-runner.test.ts`:

```ts
import { assertScenarioExpectations } from './artifact-assertions.js';

it('asserts project-init-default artifacts and state paths', () => {
  const result = runScenario(path.join(SCENARIOS, 'project-init-default', 'scenario.json'));

  expect(() => assertScenarioExpectations(result)).not.toThrow();
});
```

- [ ] **Step 2: Run test to verify it fails**

Run:

```bash
npm test -- test/harness/scenario-runner.test.ts
```

Expected: FAIL because `artifact-assertions.ts` does not exist.

- [ ] **Step 3: Implement artifact/state assertions**

Create `test/harness/artifact-assertions.ts`:

```ts
import fs from 'node:fs';
import path from 'node:path';
import { expect } from 'vitest';
import type { ScenarioRunResult } from './scenario-runner.js';

function getPath(value: unknown, dottedPath: string): unknown {
  return dottedPath.split('.').reduce<unknown>((current, part) => {
    if (current && typeof current === 'object' && part in current) {
      return (current as Record<string, unknown>)[part];
    }
    return undefined;
  }, value);
}

export function assertScenarioExpectations(result: ScenarioRunResult): void {
  for (const command of result.commands) {
    const expected = result.scenario.commands.find((candidate) => candidate.run === command.command)?.expectExit ?? 0;
    expect(command.exitCode, `${command.command.join(' ')}\nstdout:\n${command.stdout}\nstderr:\n${command.stderr}`).toBe(expected);
  }

  for (const artifact of result.scenario.expect.artifacts ?? []) {
    expect(fs.existsSync(path.join(result.workspace, artifact)), `missing artifact ${artifact}`).toBe(true);
  }

  for (const forbidden of result.scenario.expect.forbidPaths ?? []) {
    expect(fs.existsSync(path.join(result.workspace, forbidden)), `forbidden path exists ${forbidden}`).toBe(false);
  }

  const eventTypes = result.events.map((event) => event.type);
  for (const eventType of result.scenario.expect.events ?? []) {
    expect(eventTypes, `missing event ${eventType}`).toContain(eventType);
  }

  for (const [statePath, expected] of Object.entries(result.scenario.expect.state ?? {})) {
    expect(getPath(result.execution, statePath), `state path ${statePath}`).toEqual(expected);
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run:

```bash
npm test -- test/harness/scenario-runner.test.ts
```

Expected: PASS.

## Task 4: Add Trace Invariant Checker

**Files:**
- Create: `test/harness/trace-invariants.ts`
- Modify: `test/harness/scenario-runner.test.ts`

- [ ] **Step 1: Write failing tests for trace invariants**

Append to `test/harness/scenario-runner.test.ts`:

```ts
import { assertTraceInvariants } from './trace-invariants.js';

it('validates event trace invariants for project-init-default', () => {
  const result = runScenario(path.join(SCENARIOS, 'project-init-default', 'scenario.json'));

  expect(() => assertTraceInvariants(result.events, result.execution)).not.toThrow();
});

it('rejects stage events before pipeline initialization', () => {
  expect(() =>
    assertTraceInvariants(
      [
        { id: 1, type: 'StageStarted', timestamp: new Date().toISOString(), data: { stage: 1 } }
      ],
      {}
    )
  ).toThrow(/PipelineInitialized/);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run:

```bash
npm test -- test/harness/scenario-runner.test.ts
```

Expected: FAIL because `trace-invariants.ts` does not exist.

- [ ] **Step 3: Implement minimal trace invariants**

Create `test/harness/trace-invariants.ts`:

```ts
import { expect } from 'vitest';
import { EVENT_TYPE_VALUES } from '../../packages/boss-cli/src/runtime/domain/event-types.js';
import { projectState } from '../../packages/boss-cli/src/runtime/projectors/materialize-state.js';

type HarnessEvent = { id: number; type: string; timestamp: string; data: Record<string, unknown> };

function assertValidTimestamp(event: HarnessEvent): void {
  expect(Number.isNaN(Date.parse(event.timestamp)), `invalid timestamp for ${event.type}`).toBe(false);
}

export function assertTraceInvariants(events: HarnessEvent[], execution: unknown): void {
  const knownTypes = new Set<string>(EVENT_TYPE_VALUES);
  let sawPipelineInitialized = false;
  const startedStages = new Set<unknown>();
  const failedStages = new Set<unknown>();
  const failedAgents = new Set<string>();

  for (const event of events) {
    expect(knownTypes.has(event.type), `unknown event type ${event.type}`).toBe(true);
    assertValidTimestamp(event);

    if (event.type === 'PipelineInitialized') {
      sawPipelineInitialized = true;
    }

    if (event.type !== 'PipelineInitialized') {
      expect(sawPipelineInitialized, `${event.type} occurred before PipelineInitialized`).toBe(true);
    }

    if (event.type === 'StageStarted') {
      startedStages.add(event.data.stage);
    }

    if (event.type === 'StageCompleted') {
      expect(startedStages.has(event.data.stage), `stage ${String(event.data.stage)} completed before start`).toBe(true);
    }

    if (event.type === 'StageFailed') {
      failedStages.add(event.data.stage);
    }

    if (event.type === 'StageRetrying') {
      expect(failedStages.has(event.data.stage), `stage ${String(event.data.stage)} retried before failure`).toBe(true);
    }

    if (event.type === 'AgentFailed') {
      failedAgents.add(`${String(event.data.stage)}:${String(event.data.agent)}`);
    }

    if (event.type === 'AgentRetryScheduled') {
      const key = `${String(event.data.stage)}:${String(event.data.agent)}`;
      expect(failedAgents.has(key), `agent ${key} retried before failure`).toBe(true);
    }
  }

  if (events.length > 0) {
    const feature = typeof (execution as { feature?: unknown }).feature === 'string'
      ? (execution as { feature: string }).feature
      : String(events[0]?.data?.feature ?? '');
    expect(JSON.stringify(projectState(events, feature))).toBe(JSON.stringify(execution));
    expect(JSON.stringify(projectState(events, feature))).toBe(JSON.stringify(projectState(events, feature)));
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run:

```bash
npm test -- test/harness/scenario-runner.test.ts
```

Expected: PASS.

## Task 5: Add API-Only Pack Detection Scenario

**Files:**
- Create: `test/harness/scenarios/api-only-pack-detection/fixture/package.json`
- Create: `test/harness/scenarios/api-only-pack-detection/scenario.json`
- Modify: `test/harness/scenario-runner.test.ts`

- [ ] **Step 1: Add failing test for API-only scenario**

Append to `test/harness/scenario-runner.test.ts`:

```ts
it('runs api-only-pack-detection scenario', () => {
  const result = runScenario(path.join(SCENARIOS, 'api-only-pack-detection', 'scenario.json'));

  assertScenarioExpectations(result);
  assertTraceInvariants(result.events, result.execution);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run:

```bash
npm test -- test/harness/scenario-runner.test.ts
```

Expected: FAIL because the scenario files do not exist.

- [ ] **Step 3: Create API-only fixture and scenario**

Create `test/harness/scenarios/api-only-pack-detection/fixture/package.json`:

```json
{
  "name": "harness-api-only",
  "version": "1.0.0",
  "type": "module",
  "scripts": {
    "test": "node --test"
  },
  "dependencies": {
    "express": "^4.18.0"
  }
}
```

Create `test/harness/scenarios/api-only-pack-detection/scenario.json`:

```json
{
  "name": "api-only-pack-detection",
  "description": "Detects the api-only pipeline pack in a small Node API fixture.",
  "feature": "api-only-harness",
  "fixture": "fixture",
  "commands": [
    { "run": ["boss", "project", "init", "api-only-harness", "--json"] },
    { "run": ["boss", "packs", "detect", ".", "--json"] }
  ],
  "expect": {
    "artifacts": [
      ".boss/api-only-harness/.meta/execution.json",
      ".boss/api-only-harness/.meta/events.jsonl"
    ],
    "events": ["PipelineInitialized"],
    "state": {
      "feature": "api-only-harness"
    },
    "forbidPaths": ["node_modules"]
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run:

```bash
npm test -- test/harness/scenario-runner.test.ts
```

Expected: PASS.

## Task 6: Add Plugin Gate Failure/Recovery Scenario

**Files:**
- Create: `test/harness/scenarios/plugin-gate-failure/fixture/.boss/plugins/fail-once/plugin.json`
- Create: `test/harness/scenarios/plugin-gate-failure/fixture/.boss/plugins/fail-once/gate.js`
- Create: `test/harness/scenarios/plugin-gate-failure/scenario.json`
- Modify: `test/harness/scenario-runner.test.ts`

- [ ] **Step 1: Add failing test for plugin gate scenario**

Append to `test/harness/scenario-runner.test.ts`:

```ts
it('runs plugin-gate-failure scenario and records both failure and recovery', () => {
  const result = runScenario(path.join(SCENARIOS, 'plugin-gate-failure', 'scenario.json'));

  assertScenarioExpectations(result);
  assertTraceInvariants(result.events, result.execution);
  expect(result.events.map((event) => event.type)).toContain('PluginHookFailed');
  expect(result.events.map((event) => event.type)).toContain('PluginHookExecuted');
});
```

- [ ] **Step 2: Run test to verify it fails**

Run:

```bash
npm test -- test/harness/scenario-runner.test.ts
```

Expected: FAIL because the scenario files do not exist.

- [ ] **Step 3: Create fake plugin and scenario**

Create `test/harness/scenarios/plugin-gate-failure/fixture/.boss/plugins/fail-once/plugin.json`:

```json
{
  "name": "fail-once",
  "version": "1.0.0",
  "type": "gate",
  "hooks": {
    "gate": "gate.js"
  }
}
```

Create `test/harness/scenarios/plugin-gate-failure/fixture/.boss/plugins/fail-once/gate.js`:

```js
const fs = require('node:fs');
const path = require('node:path');

const marker = path.join(process.cwd(), '.boss', 'plugin-gate-harness', '.meta', 'allow-gate');

if (!fs.existsSync(marker)) {
  console.error('fail-once gate blocked: marker missing');
  process.exit(1);
}

console.log('fail-once gate passed');
```

Create `test/harness/scenarios/plugin-gate-failure/scenario.json`:

```json
{
  "name": "plugin-gate-failure",
  "description": "Registers a plugin gate, records one failure, then records a recovery pass.",
  "feature": "plugin-gate-harness",
  "fixture": "fixture",
  "commands": [
    { "run": ["boss", "project", "init", "plugin-gate-harness", "--json"] },
    { "run": ["boss", "runtime", "register-plugins", "plugin-gate-harness", "--json"] },
    { "run": ["boss", "runtime", "run-plugin-hook", "plugin-gate-harness", "gate", "--plugin", "fail-once", "--json"], "expectExit": 1 },
    { "run": ["node", "-e", "require('node:fs').mkdirSync('.boss/plugin-gate-harness/.meta',{recursive:true}); require('node:fs').writeFileSync('.boss/plugin-gate-harness/.meta/allow-gate','ok')"] },
    { "run": ["boss", "runtime", "run-plugin-hook", "plugin-gate-harness", "gate", "--plugin", "fail-once", "--json"] }
  ],
  "expect": {
    "artifacts": [
      ".boss/plugin-gate-harness/.meta/execution.json",
      ".boss/plugin-gate-harness/.meta/events.jsonl",
      ".boss/plugin-gate-harness/.meta/allow-gate"
    ],
    "events": [
      "PipelineInitialized",
      "PluginDiscovered",
      "PluginActivated",
      "PluginHookFailed",
      "PluginHookExecuted"
    ],
    "state": {
      "feature": "plugin-gate-harness",
      "metrics.pluginFailureCount": 1
    }
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run:

```bash
npm test -- test/harness/scenario-runner.test.ts
```

Expected: PASS.

## Task 7: Add `test:harness` Script

**Files:**
- Modify: `package.json`

- [ ] **Step 1: Write failing script check**

Run:

```bash
npm run test:harness
```

Expected: FAIL because the script does not exist.

- [ ] **Step 2: Add script**

Modify `package.json` scripts:

```json
"test:harness": "vitest run test/harness"
```

- [ ] **Step 3: Run harness tests**

Run:

```bash
npm run test:harness
```

Expected: PASS.

## Task 8: Run Full Verification

**Files:**
- No source changes.

- [ ] **Step 1: Run typecheck**

Run:

```bash
npm run typecheck
```

Expected: PASS with TypeScript exit 0.

- [ ] **Step 2: Run full test suite**

Run:

```bash
npm test
```

Expected: PASS. The suite should include the new `test/harness/scenario-runner.test.ts` file.

- [ ] **Step 3: Review git diff**

Run:

```bash
git diff --stat
git status --short
```

Expected: only planned files are modified or added.

## Later Phases

After Phase 1 lands, use the design doc to create follow-up plans:

1. **Phase 2 Fault Injection**
   - Add `test/faults/` runner.
   - Cover malformed status, retry exhaustion, path traversal, stale state, unexpected diff.

2. **Phase 3 Install Matrix**
   - Expand platform copy-install tests for Codex, Hermes, OpenClaw, Antigravity.
   - Add npm tarball content check.

3. **Phase 4 Skill Behavior**
   - Add transcript parser and headless Claude/Codex prompt tests.
   - Keep outside default `npm test`.

4. **Phase 5 Agent Workflow Evals**
   - Add `test/evals/` runner, eval cases, deterministic metrics, token/cost report.
   - Run manually or nightly only.
