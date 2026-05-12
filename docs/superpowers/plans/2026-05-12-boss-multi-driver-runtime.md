# Boss Multi-Driver Runtime Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a platform-neutral Boss runtime control surface that supports Codex checkpoints without weakening Claude Code hooks.

**Architecture:** Keep `.boss/<feature>/.meta/execution.json` as the shared read model. Add runtime application modules for driver capabilities, checkpoints, waves, QA findings, and final gates, then expose them through thin top-level CLI wrappers. Claude Code hooks remain additive enforcement; Codex receives explicit checkpoint output when hooks are unavailable.

**Tech Stack:** TypeScript, Node.js CLI, Vitest, existing Boss runtime event/state modules, Markdown skill docs.

---

## File Structure

- Create `packages/boss-cli/src/runtime/application/drivers.ts`: platform capability model and driver resolution.
- Create `packages/boss-cli/src/runtime/application/checkpoints.ts`: status/checkpoint builder shared by top-level commands.
- Create `packages/boss-cli/src/runtime/application/waves.ts`: initial wave read model parsed from `tasks.md`.
- Create `packages/boss-cli/src/runtime/application/final-gate.ts`: final completion gate decision logic.
- Create `packages/boss-cli/src/runtime/application/qa-attack.ts`: structured QA attack findings model and baseline checks.
- Create `packages/boss-cli/src/commands/status.ts`: `boss status <feature>`.
- Create `packages/boss-cli/src/commands/continue.ts`: `boss continue <feature>`.
- Create `packages/boss-cli/src/commands/gate/index.ts`: `boss gate <feature>` and `boss gate final <feature>`.
- Create `packages/boss-cli/src/commands/qa/index.ts`: `boss qa attack <feature>`.
- Modify `packages/boss-cli/src/bin/boss.ts`: route new top-level commands.
- Modify `packages/boss-cli/src/cli/dispatcher.ts`: add dispatcher helpers for `gate` and `qa` command groups.
- Modify `packages/boss-cli/src/cli/registry.ts`: describe new commands and options.
- Modify `packages/boss-cli/src/cli/help.ts`: include new commands in help text.
- Modify `packages/boss-cli/src/runtime/projectors/materialize-state.ts`: add optional wave and QA finding read-model fields.
- Modify `packages/boss-cli/src/runtime/schema/execution-schema.json`: accept optional wave and QA finding sections.
- Modify `skill/SKILL.md`: document multi-driver orchestration without removing Claude Code hook flow.
- Modify `test/runtime/docs-contract.test.ts`: pin multi-driver docs and hook compatibility.
- Create `test/runtime/checkpoint-runtime.test.ts`: runtime checkpoint behavior.
- Create `test/runtime/wave-runtime.test.ts`: wave parser and transition rules.
- Create `test/runtime/final-gate-runtime.test.ts`: final gate behavior.
- Create `test/runtime/qa-attack-runtime.test.ts`: structured QA attack findings.
- Modify `test/runtime/runtime-cli-contract.test.ts`: top-level command contract tests.
- Modify `test/bin/boss-skill.test.ts`: built CLI command exposure tests.

## Task 1: Pin Multi-Driver CLI and Documentation Contracts

**Files:**
- Modify: `test/runtime/runtime-cli-contract.test.ts`
- Modify: `test/runtime/docs-contract.test.ts`
- Modify: `test/bin/boss-skill.test.ts`

- [ ] **Step 1: Add RED tests for top-level command discovery**

In `test/runtime/runtime-cli-contract.test.ts`, add a helper beside the existing `runCli` helper:

```ts
function runBoss(args: string[]) {
  return spawnSync(process.execPath, [BOSS_BIN, ...args], {
    cwd: tmpDir,
    encoding: 'utf8'
  });
}
```

Add this test near the command metadata tests:

```ts
it('top-level multi-driver commands expose describe metadata', () => {
  for (const args of [
    ['status', '--describe'],
    ['continue', '--describe'],
    ['gate', '--describe'],
    ['gate', 'final', '--describe'],
    ['qa', 'attack', '--describe']
  ]) {
    const result = runBoss(args);
    expect(result.status, `${args.join(' ')} --describe`).toBe(0);
    const payload = JSON.parse(result.stdout) as { command: string; options: Array<{ name: string }> };
    expect(payload.command).toContain(args[0]!);
    expect(payload.options.map((option) => option.name)).toContain('json');
  }
});
```

- [ ] **Step 2: Add RED tests for status checkpoint JSON**

In the same file, add:

```ts
it('boss status returns driver capabilities and checkpoint fields', () => {
  initPipeline('test-feat', { cwd: tmpDir });

  const result = runBoss(['status', 'test-feat', '--json']);
  expect(result.status).toBe(0);

  const payload = JSON.parse(result.stdout) as {
    feature: string;
    driver: { name: string; hooks: string };
    capabilities: { checkpointPrompt: boolean; hooks: boolean };
    currentStage: { id: number; status: string } | null;
    readyArtifacts: string[];
    checkpoint: { checkpointRequired: boolean; continueCommand: string };
  };
  expect(payload.feature).toBe('test-feat');
  expect(payload.driver.name).toBe('generic');
  expect(payload.capabilities).toMatchObject({ checkpointPrompt: true });
  expect(payload.readyArtifacts).toContain('prd.md');
  expect(payload.checkpoint.continueCommand).toBe('boss continue test-feat');
});
```

- [ ] **Step 3: Add RED docs contract test for preserving Claude Code hooks**

In `test/runtime/docs-contract.test.ts`, add to the Boss documentation contract section:

```ts
it('documents multi-driver runtime without weakening Claude Code hooks', () => {
  expect(skill).toContain('Claude Code');
  expect(skill).toContain('Codex');
  expect(skill).toContain('Platform Driver');
  expect(skill).toContain('hooks');
  expect(skill).toContain('CHECKPOINT_REQUIRED');
  expect(skill).toContain('execution.json');
  expect(skill).not.toContain('Codex-only');
});
```

- [ ] **Step 4: Verify RED**

Run:

```bash
npm test -- test/runtime/runtime-cli-contract.test.ts test/runtime/docs-contract.test.ts test/bin/boss-skill.test.ts
```

Expected: FAIL because the top-level commands and docs do not exist yet.

## Task 2: Add Driver and Checkpoint Runtime Model

**Files:**
- Create: `packages/boss-cli/src/runtime/application/drivers.ts`
- Create: `packages/boss-cli/src/runtime/application/checkpoints.ts`
- Create: `test/runtime/checkpoint-runtime.test.ts`

- [ ] **Step 1: Write RED runtime tests**

Create `test/runtime/checkpoint-runtime.test.ts`:

```ts
import { beforeEach, afterEach, describe, expect, it } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { initPipeline, updateStage } from '../../packages/boss-cli/src/runtime/application/pipeline.js';
import { buildBossStatus } from '../../packages/boss-cli/src/runtime/application/checkpoints.js';
import { resolveDriverCapabilities } from '../../packages/boss-cli/src/runtime/application/drivers.js';

describe('multi-driver checkpoint runtime', () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'boss-checkpoint-'));
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it('resolves generic capabilities without assuming hooks', () => {
    expect(resolveDriverCapabilities('generic')).toEqual({
      name: 'generic',
      hooks: false,
      checkpointPrompt: true,
      stopGuards: false,
      subagents: false
    });
  });

  it('resolves Claude Code capabilities with hooks enabled', () => {
    expect(resolveDriverCapabilities('claude-code')).toEqual({
      name: 'claude-code',
      hooks: true,
      checkpointPrompt: false,
      stopGuards: true,
      subagents: true
    });
  });

  it('builds status from execution state and ready artifacts', () => {
    initPipeline('test-feat', { cwd: tmpDir });
    updateStage('test-feat', 1, 'running', { cwd: tmpDir });

    const status = buildBossStatus('test-feat', { cwd: tmpDir, driver: 'codex' });

    expect(status.feature).toBe('test-feat');
    expect(status.driver.name).toBe('codex');
    expect(status.capabilities.checkpointPrompt).toBe(true);
    expect(status.currentStage).toMatchObject({ id: 1, status: 'running' });
    expect(status.readyArtifacts).toContain('prd.md');
    expect(status.checkpoint).toMatchObject({
      checkpointRequired: true,
      continueCommand: 'boss continue test-feat'
    });
  });
});
```

- [ ] **Step 2: Verify RED**

Run:

```bash
npm test -- test/runtime/checkpoint-runtime.test.ts
```

Expected: FAIL because `drivers.ts` and `checkpoints.ts` do not exist.

- [ ] **Step 3: Implement `drivers.ts`**

Create `packages/boss-cli/src/runtime/application/drivers.ts`:

```ts
export type BossDriverName = 'claude-code' | 'codex' | 'generic';

export interface BossDriverCapabilities {
  name: BossDriverName;
  hooks: boolean;
  checkpointPrompt: boolean;
  stopGuards: boolean;
  subagents: boolean;
}

export function normalizeDriverName(value: string | undefined): BossDriverName {
  if (value === 'claude-code' || value === 'codex' || value === 'generic') {
    return value;
  }
  return 'generic';
}

export function resolveDriverCapabilities(value: string | undefined): BossDriverCapabilities {
  const name = normalizeDriverName(value);
  if (name === 'claude-code') {
    return {
      name,
      hooks: true,
      checkpointPrompt: false,
      stopGuards: true,
      subagents: true
    };
  }
  if (name === 'codex') {
    return {
      name,
      hooks: false,
      checkpointPrompt: true,
      stopGuards: false,
      subagents: false
    };
  }
  return {
    name,
    hooks: false,
    checkpointPrompt: true,
    stopGuards: false,
    subagents: false
  };
}
```

- [ ] **Step 4: Implement `checkpoints.ts`**

Create `packages/boss-cli/src/runtime/application/checkpoints.ts`:

```ts
import { inspectPipeline, type CurrentStageSummary } from './inspection.js';
import { resolveDriverCapabilities, type BossDriverName, type BossDriverCapabilities } from './drivers.js';

export interface RequiredCheck {
  id: string;
  command: string;
  required: boolean;
}

export interface BossCheckpoint {
  checkpointRequired: boolean;
  reason: string;
  changedFiles: string[];
  requiredChecks: RequiredCheck[];
  continueCommand: string;
}

export interface BossStatus {
  feature: string;
  status: string;
  driver: BossDriverCapabilities;
  capabilities: {
    hooks: boolean;
    checkpointPrompt: boolean;
    stopGuards: boolean;
    subagents: boolean;
  };
  currentStage: CurrentStageSummary | null;
  currentWave: null;
  readyArtifacts: string[];
  blockedReason: string | null;
  checkpoint: BossCheckpoint;
}

function defaultRequiredChecks(stage: CurrentStageSummary | null): RequiredCheck[] {
  if (!stage) return [];
  if (stage.id >= 3) {
    return [
      { id: 'typecheck', command: 'npm run typecheck', required: true },
      { id: 'tests', command: 'npm test', required: true }
    ];
  }
  return [];
}

export function buildBossStatus(
  feature: string,
  { cwd = process.cwd(), driver = 'generic' }: { cwd?: string; driver?: BossDriverName | string } = {}
): BossStatus {
  const inspection = inspectPipeline(feature, { cwd });
  const capabilities = resolveDriverCapabilities(driver);
  const requiredChecks = defaultRequiredChecks(inspection.currentStage);
  const checkpointRequired = capabilities.checkpointPrompt || requiredChecks.length > 0;

  return {
    feature,
    status: inspection.status,
    driver: capabilities,
    capabilities: {
      hooks: capabilities.hooks,
      checkpointPrompt: capabilities.checkpointPrompt,
      stopGuards: capabilities.stopGuards,
      subagents: capabilities.subagents
    },
    currentStage: inspection.currentStage,
    currentWave: null,
    readyArtifacts: inspection.readyArtifacts,
    blockedReason: inspection.recentFailures[0]?.reason || null,
    checkpoint: {
      checkpointRequired,
      reason: checkpointRequired ? 'next-action-requires-explicit-confirmation' : 'hooks-enforce-next-action',
      changedFiles: [],
      requiredChecks,
      continueCommand: `boss continue ${feature}`
    }
  };
}
```

- [ ] **Step 5: Verify GREEN**

Run:

```bash
npm test -- test/runtime/checkpoint-runtime.test.ts
```

Expected: PASS.

## Task 3: Add Top-Level `boss status` and `boss continue`

**Files:**
- Create: `packages/boss-cli/src/commands/status.ts`
- Create: `packages/boss-cli/src/commands/continue.ts`
- Modify: `packages/boss-cli/src/bin/boss.ts`
- Modify: `packages/boss-cli/src/cli/registry.ts`
- Modify: `packages/boss-cli/src/cli/help.ts`
- Modify: `test/runtime/runtime-cli-contract.test.ts`
- Modify: `test/bin/boss-skill.test.ts`

- [ ] **Step 1: Add command descriptions**

In `packages/boss-cli/src/cli/registry.ts`, add entries to `commandDescriptions`:

```ts
'boss status': {
  command: 'boss status',
  summary: 'Inspect Boss pipeline state and next checkpoint',
  parameters: [{ name: 'feature', type: 'string', required: true }],
  options: [
    ...commonOptions,
    { name: 'driver', type: 'string', default: 'generic' }
  ],
  risk_tier: 'low'
},
'boss continue': {
  command: 'boss continue',
  summary: 'Advance a Boss pipeline to the next safe checkpoint',
  parameters: [{ name: 'feature', type: 'string', required: true }],
  options: [
    ...commonOptions,
    { name: 'driver', type: 'string', default: 'generic' }
  ],
  risk_tier: 'medium'
},
```

- [ ] **Step 2: Implement `status.ts`**

Create `packages/boss-cli/src/commands/status.ts`:

```ts
import { createCliContext, describeCommand, writeOutput } from '../cli/contract.js';
import { commandDescriptions } from '../cli/registry.js';
import { buildBossStatus } from '../runtime/application/checkpoints.js';

export async function main(argv: string[], { cwd = process.cwd() }: { cwd?: string } = {}): Promise<number> {
  const context = createCliContext(argv, { command: 'boss status' });
  if (context.values.describe) {
    writeOutput(commandDescriptions['boss status'], context, () => `${JSON.stringify(describeCommand(commandDescriptions['boss status']!), null, 2)}\n`);
    return 0;
  }

  const feature = context.positionals[0];
  if (!feature) {
    throw new Error('Usage: boss status FEATURE [options]');
  }

  const status = buildBossStatus(feature, {
    cwd,
    driver: typeof context.values.driver === 'string' ? context.values.driver : 'generic'
  });

  writeOutput(status, context, () => {
    const stage = status.currentStage ? `${status.currentStage.name || status.currentStage.id} (${status.currentStage.status})` : 'none';
    return [
      `Feature: ${status.feature}`,
      `Driver: ${status.driver.name}`,
      `Stage: ${stage}`,
      `Ready artifacts: ${status.readyArtifacts.join(', ') || 'none'}`,
      status.checkpoint.checkpointRequired ? 'CHECKPOINT_REQUIRED' : 'Checkpoint: hooks-managed',
      `Continue: ${status.checkpoint.continueCommand}`,
      ''
    ].join('\n');
  });
  return 0;
}
```

- [ ] **Step 3: Implement `continue.ts`**

Create `packages/boss-cli/src/commands/continue.ts`:

```ts
import { createCliContext, describeCommand, writeOutput } from '../cli/contract.js';
import { commandDescriptions } from '../cli/registry.js';
import { buildBossStatus } from '../runtime/application/checkpoints.js';

export async function main(argv: string[], { cwd = process.cwd() }: { cwd?: string } = {}): Promise<number> {
  const context = createCliContext(argv, { command: 'boss continue' });
  if (context.values.describe) {
    writeOutput(commandDescriptions['boss continue'], context, () => `${JSON.stringify(describeCommand(commandDescriptions['boss continue']!), null, 2)}\n`);
    return 0;
  }

  const feature = context.positionals[0];
  if (!feature) {
    throw new Error('Usage: boss continue FEATURE [options]');
  }

  const status = buildBossStatus(feature, {
    cwd,
    driver: typeof context.values.driver === 'string' ? context.values.driver : 'generic'
  });

  writeOutput(status, context, () => {
    if (!status.checkpoint.checkpointRequired) {
      return `READY_TO_CONTINUE:\n- feature: ${feature}\n- next: ${status.readyArtifacts[0] || 'none'}\n`;
    }
    const checks = status.checkpoint.requiredChecks
      .map((check, index) => `  ${index + 1}. ${check.command}`)
      .join('\n');
    return [
      'CHECKPOINT_REQUIRED:',
      `- feature: ${feature}`,
      `- reason: ${status.checkpoint.reason}`,
      '- required checks:',
      checks || '  none',
      `- continue: ${status.checkpoint.continueCommand}`,
      ''
    ].join('\n');
  });
  return status.blockedReason ? 1 : 0;
}
```

- [ ] **Step 4: Route commands in `boss.ts`**

In `packages/boss-cli/src/bin/boss.ts`, import:

```ts
import { main as statusMain } from '../commands/status.js';
import { main as continueMain } from '../commands/continue.js';
```

Add `status` and `continue` to `describeRoot().commands`.

Add cases:

```ts
case 'status':
  return statusMain(commandArgv, { cwd: process.cwd() });

case 'continue':
  return continueMain(commandArgv, { cwd: process.cwd() });
```

- [ ] **Step 5: Update help text**

In `packages/boss-cli/src/cli/help.ts`, add `boss status FEATURE` and `boss continue FEATURE` to the root help command list.

- [ ] **Step 6: Verify focused tests**

Run:

```bash
npm run build
npm test -- test/runtime/checkpoint-runtime.test.ts test/runtime/runtime-cli-contract.test.ts test/bin/boss-skill.test.ts
```

Expected: PASS for checkpoint runtime and new status/continue tests; remaining RED from gate/qa commands is handled in later tasks.

## Task 4: Add Runtime Wave Read Model

**Files:**
- Create: `packages/boss-cli/src/runtime/application/waves.ts`
- Create: `test/runtime/wave-runtime.test.ts`
- Modify: `packages/boss-cli/src/runtime/application/checkpoints.ts`
- Modify: `packages/boss-cli/src/runtime/projectors/materialize-state.ts`
- Modify: `packages/boss-cli/src/runtime/schema/execution-schema.json`

- [ ] **Step 1: Write RED wave parser tests**

Create `test/runtime/wave-runtime.test.ts`:

```ts
import { beforeEach, afterEach, describe, expect, it } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { initPipeline } from '../../packages/boss-cli/src/runtime/application/pipeline.js';
import { readWaves } from '../../packages/boss-cli/src/runtime/application/waves.js';

describe('wave runtime read model', () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'boss-waves-'));
    initPipeline('test-feat', { cwd: tmpDir });
    fs.mkdirSync(path.join(tmpDir, '.boss', 'test-feat'), { recursive: true });
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it('parses Evidence Wave rows from tasks.md', () => {
    fs.writeFileSync(
      path.join(tmpDir, '.boss', 'test-feat', 'tasks.md'),
      [
        '### 4.2 Evidence Wave 验收计划',
        '',
        '| Evidence Wave | 范围 | Owner 文件 | 红测 | 绿门禁 | Contract Matrix 行 | Stop Condition |',
        '|---------------|------|------------|------|--------|--------------------|----------------|',
        '| Wave 1：Data | schema | `src/schema.ts` | `npm test -- tests/schema.test.ts` | `npm test -- tests/schema.test.ts` | CM-001 | schema mismatch |'
      ].join('\n'),
      'utf8'
    );

    const waves = readWaves('test-feat', { cwd: tmpDir });

    expect(waves).toEqual([
      expect.objectContaining({
        id: 'wave-1-data',
        title: 'Wave 1：Data',
        status: 'pending',
        greenGates: ['npm test -- tests/schema.test.ts'],
        contractRows: ['CM-001']
      })
    ]);
  });
});
```

- [ ] **Step 2: Verify RED**

Run:

```bash
npm test -- test/runtime/wave-runtime.test.ts
```

Expected: FAIL because `waves.ts` does not exist.

- [ ] **Step 3: Implement `waves.ts`**

Create `packages/boss-cli/src/runtime/application/waves.ts`:

```ts
import fs from 'node:fs';
import path from 'node:path';

export type WaveStatus = 'pending' | 'running' | 'blocked' | 'completed' | 'failed';

export interface EvidenceWave {
  id: string;
  title: string;
  scope: string;
  writeSet: string[];
  redTests: string[];
  greenGates: string[];
  contractRows: string[];
  rollbackRisk: string;
  pausePolicy: string;
  status: WaveStatus;
}

function slugify(value: string): string {
  return value
    .toLowerCase()
    .replace(/[`*]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '') || 'wave';
}

function splitCellCommands(value: string): string[] {
  return value
    .split(/<br\s*\/?>|,|，/i)
    .map((item) => item.replace(/`/g, '').trim())
    .filter(Boolean);
}

function parseWaveRows(markdown: string): EvidenceWave[] {
  const lines = markdown.split('\n');
  const headerIndex = lines.findIndex((line) => line.includes('| Evidence Wave |') && line.includes('| Stop Condition |'));
  if (headerIndex === -1) return [];

  const rows: EvidenceWave[] = [];
  for (const line of lines.slice(headerIndex + 2)) {
    if (!line.trim().startsWith('|')) break;
    const cells = line.split('|').slice(1, -1).map((cell) => cell.trim());
    if (cells.length < 7) continue;
    const [title, scope, owners, red, green, contracts, stop] = cells as [string, string, string, string, string, string, string];
    rows.push({
      id: slugify(title),
      title,
      scope,
      writeSet: splitCellCommands(owners),
      redTests: splitCellCommands(red),
      greenGates: splitCellCommands(green),
      contractRows: splitCellCommands(contracts),
      rollbackRisk: stop,
      pausePolicy: stop,
      status: 'pending'
    });
  }
  return rows;
}

export function readWaves(feature: string, { cwd = process.cwd() }: { cwd?: string } = {}): EvidenceWave[] {
  const tasksPath = path.join(cwd, '.boss', feature, 'tasks.md');
  if (!fs.existsSync(tasksPath)) return [];
  return parseWaveRows(fs.readFileSync(tasksPath, 'utf8'));
}
```

- [ ] **Step 4: Include waves in checkpoint status**

In `checkpoints.ts`, import `readWaves` and set `currentWave` to the first non-completed wave:

```ts
import { readWaves, type EvidenceWave } from './waves.js';
```

Change `BossStatus.currentWave` from `null` to:

```ts
currentWave: EvidenceWave | null;
```

Inside `buildBossStatus`, add:

```ts
const waves = readWaves(feature, { cwd });
const currentWave = waves.find((wave) => wave.status !== 'completed') ?? null;
```

Return `currentWave`.

- [ ] **Step 5: Verify GREEN**

Run:

```bash
npm test -- test/runtime/wave-runtime.test.ts test/runtime/checkpoint-runtime.test.ts
```

Expected: PASS.

## Task 5: Add `boss gate final`

**Files:**
- Create: `packages/boss-cli/src/runtime/application/final-gate.ts`
- Create: `packages/boss-cli/src/commands/gate/index.ts`
- Create: `test/runtime/final-gate-runtime.test.ts`
- Modify: `packages/boss-cli/src/bin/boss.ts`
- Modify: `packages/boss-cli/src/cli/dispatcher.ts`
- Modify: `packages/boss-cli/src/cli/registry.ts`
- Modify: `packages/boss-cli/src/cli/help.ts`
- Modify: `test/runtime/runtime-cli-contract.test.ts`

- [ ] **Step 1: Write RED final gate runtime tests**

Create `test/runtime/final-gate-runtime.test.ts`:

```ts
import { beforeEach, afterEach, describe, expect, it } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { initPipeline, recordArtifact } from '../../packages/boss-cli/src/runtime/application/pipeline.js';
import { evaluateFinalGate } from '../../packages/boss-cli/src/runtime/application/final-gate.js';

describe('final gate runtime', () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'boss-final-gate-'));
    initPipeline('test-feat', { cwd: tmpDir });
    fs.mkdirSync(path.join(tmpDir, '.boss', 'test-feat'), { recursive: true });
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it('fails when required artifacts are missing', () => {
    const result = evaluateFinalGate('test-feat', { cwd: tmpDir });

    expect(result.passed).toBe(false);
    expect(result.checks).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ id: 'required-artifacts', passed: false })
      ])
    );
  });

  it('passes required artifact check after core artifacts are recorded', () => {
    for (const artifact of ['prd.md', 'architecture.md', 'tasks.md', 'qa-report.md']) {
      fs.writeFileSync(path.join(tmpDir, '.boss', 'test-feat', artifact), `# ${artifact}\n`, 'utf8');
    }
    recordArtifact('test-feat', 'prd.md', 1, { cwd: tmpDir });
    recordArtifact('test-feat', 'architecture.md', 1, { cwd: tmpDir });
    recordArtifact('test-feat', 'tasks.md', 2, { cwd: tmpDir });
    recordArtifact('test-feat', 'qa-report.md', 3, { cwd: tmpDir });

    const result = evaluateFinalGate('test-feat', { cwd: tmpDir });

    expect(result.checks.find((check) => check.id === 'required-artifacts')?.passed).toBe(true);
  });
});
```

- [ ] **Step 2: Verify RED**

Run:

```bash
npm test -- test/runtime/final-gate-runtime.test.ts
```

Expected: FAIL because `final-gate.ts` does not exist.

- [ ] **Step 3: Implement `final-gate.ts`**

Create `packages/boss-cli/src/runtime/application/final-gate.ts`:

```ts
import { inspectPipeline, readExecution } from './inspection.js';

export interface FinalGateCheck {
  id: string;
  passed: boolean;
  detail: string;
}

export interface FinalGateResult {
  feature: string;
  passed: boolean;
  checks: FinalGateCheck[];
}

const REQUIRED_ARTIFACTS = ['prd.md', 'architecture.md', 'tasks.md', 'qa-report.md'];

export function evaluateFinalGate(
  feature: string,
  { cwd = process.cwd() }: { cwd?: string } = {}
): FinalGateResult {
  const inspection = inspectPipeline(feature, { cwd });
  const execution = readExecution(feature, cwd);
  const artifacts = new Set<string>();
  for (const stage of Object.values(execution.stages)) {
    for (const artifact of stage.artifacts ?? []) {
      artifacts.add(artifact);
    }
  }
  const missing = REQUIRED_ARTIFACTS.filter((artifact) => !artifacts.has(artifact));
  const checks: FinalGateCheck[] = [
    {
      id: 'required-artifacts',
      passed: missing.length === 0,
      detail: missing.length === 0 ? 'required artifacts recorded' : `missing or unrecorded: ${missing.join(', ')}`
    },
    {
      id: 'no-active-agents',
      passed: inspection.activeAgents.length === 0,
      detail: inspection.activeAgents.length === 0 ? 'no active agents' : 'agents still running'
    },
    {
      id: 'no-recent-failures',
      passed: inspection.recentFailures.length === 0,
      detail: inspection.recentFailures.length === 0 ? 'no failed stages or agents' : 'failed stages or agents remain'
    }
  ];
  return {
    feature,
    passed: checks.every((check) => check.passed),
    checks
  };
}
```

- [ ] **Step 4: Add `gate` command group**

Create `packages/boss-cli/src/commands/gate/index.ts`:

```ts
import { createCliContext, describeCommand, writeOutput } from '../../cli/contract.js';
import { commandDescriptions } from '../../cli/registry.js';
import { evaluateFinalGate } from '../../runtime/application/final-gate.js';
import { evaluateGates } from '../../runtime/application/gates.js';

export async function main(argv: string[], { cwd = process.cwd() }: { cwd?: string } = {}): Promise<number> {
  const context = createCliContext(argv, { command: 'boss gate' });
  const subcommand = context.positionals[0];

  if (context.values.describe && !subcommand) {
    writeOutput(commandDescriptions['boss gate'], context, () => `${JSON.stringify(describeCommand(commandDescriptions['boss gate']!), null, 2)}\n`);
    return 0;
  }

  if (subcommand === 'final') {
    const finalContext = createCliContext(argv.slice(1), { command: 'boss gate final' });
    if (finalContext.values.describe) {
      writeOutput(commandDescriptions['boss gate final'], finalContext, () => `${JSON.stringify(describeCommand(commandDescriptions['boss gate final']!), null, 2)}\n`);
      return 0;
    }
    const feature = finalContext.positionals[0];
    if (!feature) throw new Error('Usage: boss gate final FEATURE [options]');
    const result = evaluateFinalGate(feature, { cwd });
    writeOutput(result, finalContext, () => `${result.passed ? 'FINAL_GATE_PASSED' : 'FINAL_GATE_FAILED'}\n`);
    return result.passed ? 0 : 1;
  }

  const feature = context.positionals[0];
  const gateName = typeof context.values.gate === 'string' ? context.values.gate : 'gate1';
  if (!feature) throw new Error('Usage: boss gate FEATURE [options]');
  const result = evaluateGates(feature, gateName, { cwd });
  writeOutput(result, context, () => `${gateName}: ${result.passed ? 'passed' : 'failed'}\n`);
  return result.passed ? 0 : 1;
}
```

- [ ] **Step 5: Register command metadata and routing**

Add `boss gate` and `boss gate final` descriptions to `registry.ts`.

Add `runGateCommand` to `dispatcher.ts` following `runDesignCommand` shape.

Add import and case in `bin/boss.ts`:

```ts
import { runGateCommand } from '../cli/dispatcher.js';

case 'gate':
  return runGateCommand(commandArgv);
```

- [ ] **Step 6: Verify GREEN**

Run:

```bash
npm run build
npm test -- test/runtime/final-gate-runtime.test.ts test/runtime/runtime-cli-contract.test.ts
```

Expected: PASS.

## Task 6: Add Structured `boss qa attack`

**Files:**
- Create: `packages/boss-cli/src/runtime/application/qa-attack.ts`
- Create: `packages/boss-cli/src/commands/qa/index.ts`
- Create: `test/runtime/qa-attack-runtime.test.ts`
- Modify: `packages/boss-cli/src/bin/boss.ts`
- Modify: `packages/boss-cli/src/cli/dispatcher.ts`
- Modify: `packages/boss-cli/src/cli/registry.ts`
- Modify: `packages/boss-cli/src/cli/help.ts`

- [ ] **Step 1: Write RED QA attack runtime tests**

Create `test/runtime/qa-attack-runtime.test.ts`:

```ts
import { beforeEach, afterEach, describe, expect, it } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { initPipeline } from '../../packages/boss-cli/src/runtime/application/pipeline.js';
import { runQaAttack } from '../../packages/boss-cli/src/runtime/application/qa-attack.js';

describe('qa attack runtime', () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'boss-qa-attack-'));
    initPipeline('test-feat', { cwd: tmpDir });
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it('marks missing QA report evidence as open findings', () => {
    const result = runQaAttack('test-feat', { cwd: tmpDir });

    expect(result.status).toBe('failed');
    expect(result.findings).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: 'qa-report-missing',
          severity: 'critical',
          status: 'open'
        })
      ])
    );
  });
});
```

- [ ] **Step 2: Verify RED**

Run:

```bash
npm test -- test/runtime/qa-attack-runtime.test.ts
```

Expected: FAIL because `qa-attack.ts` does not exist.

- [ ] **Step 3: Implement `qa-attack.ts`**

Create `packages/boss-cli/src/runtime/application/qa-attack.ts`:

```ts
import fs from 'node:fs';
import path from 'node:path';

export type QaFindingSeverity = 'critical' | 'high' | 'medium' | 'low';
export type QaFindingStatus = 'open' | 'closed' | 'accepted';

export interface QaFinding {
  id: string;
  severity: QaFindingSeverity;
  status: QaFindingStatus;
  evidence: string;
}

export interface QaAttackResult {
  feature: string;
  status: 'passed' | 'failed';
  findings: QaFinding[];
}

export function runQaAttack(feature: string, { cwd = process.cwd() }: { cwd?: string } = {}): QaAttackResult {
  const findings: QaFinding[] = [];
  const qaReportPath = path.join(cwd, '.boss', feature, 'qa-report.md');
  if (!fs.existsSync(qaReportPath)) {
    findings.push({
      id: 'qa-report-missing',
      severity: 'critical',
      status: 'open',
      evidence: '.boss/<feature>/qa-report.md is missing'
    });
  } else {
    const report = fs.readFileSync(qaReportPath, 'utf8');
    for (const required of ['核心用户路径', '真实 payload', 'schema', '未验证']) {
      if (!report.includes(required)) {
        findings.push({
          id: `qa-evidence-${required}`,
          severity: 'high',
          status: 'open',
          evidence: `qa-report.md does not mention ${required}`
        });
      }
    }
  }

  return {
    feature,
    status: findings.some((finding) => finding.status === 'open' && finding.severity === 'critical') ? 'failed' : 'passed',
    findings
  };
}
```

- [ ] **Step 4: Add command group**

Create `packages/boss-cli/src/commands/qa/index.ts`:

```ts
import { createCliContext, describeCommand, writeOutput } from '../../cli/contract.js';
import { commandDescriptions } from '../../cli/registry.js';
import { runQaAttack } from '../../runtime/application/qa-attack.js';

export async function main(argv: string[], { cwd = process.cwd() }: { cwd?: string } = {}): Promise<number> {
  const context = createCliContext(argv, { command: 'boss qa' });
  const subcommand = context.positionals[0];
  if (context.values.describe && !subcommand) {
    writeOutput(commandDescriptions['boss qa'], context, () => `${JSON.stringify(describeCommand(commandDescriptions['boss qa']!), null, 2)}\n`);
    return 0;
  }
  if (subcommand !== 'attack') {
    throw new Error('Usage: boss qa attack FEATURE [options]');
  }

  const attackContext = createCliContext(argv.slice(1), { command: 'boss qa attack' });
  if (attackContext.values.describe) {
    writeOutput(commandDescriptions['boss qa attack'], attackContext, () => `${JSON.stringify(describeCommand(commandDescriptions['boss qa attack']!), null, 2)}\n`);
    return 0;
  }
  const feature = attackContext.positionals[0];
  if (!feature) throw new Error('Usage: boss qa attack FEATURE [options]');
  const result = runQaAttack(feature, { cwd });
  writeOutput(result, attackContext, () => `${result.status === 'passed' ? 'QA_ATTACK_PASSED' : 'QA_ATTACK_FAILED'}\n`);
  return result.status === 'passed' ? 0 : 1;
}
```

- [ ] **Step 5: Register metadata and routing**

Add `boss qa` and `boss qa attack` descriptions to `registry.ts`.

Add `runQaCommand` to `dispatcher.ts`.

Add import and case in `bin/boss.ts`:

```ts
import { runQaCommand } from '../cli/dispatcher.js';

case 'qa':
  return runQaCommand(commandArgv);
```

- [ ] **Step 6: Verify GREEN**

Run:

```bash
npm run build
npm test -- test/runtime/qa-attack-runtime.test.ts test/runtime/runtime-cli-contract.test.ts
```

Expected: PASS.

## Task 7: Update Skill Documentation Without Weakening Claude Code

**Files:**
- Modify: `skill/SKILL.md`
- Modify: `test/runtime/docs-contract.test.ts`

- [ ] **Step 1: Add docs text after runtime overview**

In `skill/SKILL.md`, add a section named `## Platform Driver 模式`:

```md
## Platform Driver 模式

Boss 使用统一 Runtime Core 和多个 Platform Driver。所有平台都以 `.boss/<feature>/.meta/execution.json` 为状态源；不要从聊天上下文推断流水线状态。

### Claude Code Driver

- 继续优先使用 hooks、artifact guard、stop guard、subagent 协议和现有 Skill 流程。
- `boss status`、`boss gate final` 可作为可观测性和兜底命令，但不得替代 hooks。
- hooks 可用时，checkpoint 文本只是透明提示，不是唯一约束来源。

### Codex Driver

- 每轮先运行 `boss status <feature> --json --driver codex`。
- 只执行 runtime 返回的单个下一步或 checkpoint。
- 看到 `CHECKPOINT_REQUIRED` 时，必须运行 `requiredChecks`，读取结果，再调用 `boss continue <feature> --driver codex`。
- 最终回答前必须运行 `boss gate final <feature>` 并确认通过。

### Shared Rules

- Runtime Core 负责状态、waves、gates、QA findings 和 final evidence。
- Platform Driver 只决定 enforcement 方式，不改变状态语义。
- Codex 适配是 additive，不得删除或弱化 Claude Code hooks。
```

- [ ] **Step 2: Update command table**

In `skill/SKILL.md`, add top-level command rows:

```md
| 状态检查 | `boss status <feature>` | 读取 runtime 状态并输出下一 checkpoint |
| 安全继续 | `boss continue <feature>` | 推进到下一安全 checkpoint |
| 当前门禁 | `boss gate <feature>` | 运行或汇总当前阶段/波次门禁 |
| Final Gate | `boss gate final <feature>` | 完成前统一门禁 |
| QA Attack | `boss qa attack <feature>` | 生成结构化 QA findings |
```

- [ ] **Step 3: Verify docs contract**

Run:

```bash
npm test -- test/runtime/docs-contract.test.ts
```

Expected: PASS.

## Task 8: Full Verification and Commit

**Files:**
- All files changed by Tasks 1-7

- [ ] **Step 1: Build**

Run:

```bash
npm run build
```

Expected: exit 0.

- [ ] **Step 2: Typecheck**

Run:

```bash
npm run typecheck
```

Expected: exit 0.

- [ ] **Step 3: Full test suite**

Run:

```bash
npm test
```

Expected: all tests pass.

- [ ] **Step 4: Diff hygiene**

Run:

```bash
git diff --check
git status --short
```

Expected: no whitespace errors; changed files match this plan.

- [ ] **Step 5: Commit**

Run:

```bash
git add packages/boss-cli/src/runtime/application/drivers.ts \
  packages/boss-cli/src/runtime/application/checkpoints.ts \
  packages/boss-cli/src/runtime/application/waves.ts \
  packages/boss-cli/src/runtime/application/final-gate.ts \
  packages/boss-cli/src/runtime/application/qa-attack.ts \
  packages/boss-cli/src/commands/status.ts \
  packages/boss-cli/src/commands/continue.ts \
  packages/boss-cli/src/commands/gate/index.ts \
  packages/boss-cli/src/commands/qa/index.ts \
  packages/boss-cli/src/bin/boss.ts \
  packages/boss-cli/src/cli/dispatcher.ts \
  packages/boss-cli/src/cli/registry.ts \
  packages/boss-cli/src/cli/help.ts \
  packages/boss-cli/src/runtime/projectors/materialize-state.ts \
  packages/boss-cli/src/runtime/schema/execution-schema.json \
  skill/SKILL.md \
  test/runtime/docs-contract.test.ts \
  test/runtime/runtime-cli-contract.test.ts \
  test/bin/boss-skill.test.ts \
  test/runtime/checkpoint-runtime.test.ts \
  test/runtime/wave-runtime.test.ts \
  test/runtime/final-gate-runtime.test.ts \
  test/runtime/qa-attack-runtime.test.ts
git commit -m "feat: add boss multi-driver checkpoints"
```

Expected: commit succeeds.

## Self-Review Notes

- Spec coverage: all design requirements map to tasks. Runtime source of truth is preserved, driver-specific behavior is isolated, Claude Code hooks remain first-class, Codex receives checkpoints, and final gate/QA attack are explicit commands.
- Scope: this plan implements the first functional multi-driver slice plus minimal wave, QA, and final gate models. It does not implement full autonomous execution, deployment, or destructive migration handling.
- Risk control: all new top-level commands are thin wrappers over runtime application modules; no task removes existing `boss runtime ...` commands or hook config.
