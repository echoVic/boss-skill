# Boss CLI Agent-Friendly Contract Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make every `boss` / `boss-skill` command safe and predictable for agents by supporting structured JSON output, non-interactive operation, dry-run plans, bounded output, structured errors, stable help/describe metadata, JSON input, and input validation.

**Architecture:** Add one shared CLI contract layer under `packages/boss-cli/src/cli/` and route all command modules through it instead of hand-rolled `console.log`, ad hoc `JSON.stringify`, and raw thrown errors. Commands keep their existing runtime/domain functions, but expose a uniform agent-facing shell: common flags, stable output envelopes, structured errors, and command descriptions. Runtime CLIs are migrated in groups so read-only commands, mutating commands, and hook/install/project helpers can be verified independently.

**Tech Stack:** TypeScript ESM, Node.js standard library only (`node:util`, `node:fs`, `node:path`, `node:child_process`), Vitest, existing Boss CLI runtime modules.

---

## File Map

- Create: `packages/boss-cli/src/cli/contract.ts`
  - Owns global option parsing, JSON/text output selection, `--fields`, `--limit`, `--json-input`, `--describe`, structured errors, stable help rendering, and safe path validation.
  - Exports `CliUserError`, `createCliContext`, `writeOutput`, `outputList`, `writeError`, `readJsonInput`, `validatePathInside`, `parseLimit`, `pickFields`, `describeCommand`, `renderHelp`, and `runMain`.

- Create: `packages/boss-cli/src/cli/command-registry.ts`
  - Single registry for top-level commands, command groups, and runtime commands.
  - Exposes metadata used by `boss --describe`, `boss runtime --describe`, and tests.

- Modify: `packages/boss-cli/src/bin/boss.ts`
  - Parse global flags before dispatch.
  - Return structured JSON by default when stdout is not a TTY.
  - Emit structured errors for unknown commands.
  - Support `--describe` for root and command groups.

- Modify command modules:
  - `packages/boss-cli/src/commands/install.ts`
  - `packages/boss-cli/src/commands/project.ts`
  - `packages/boss-cli/src/commands/artifact.ts`
  - `packages/boss-cli/src/commands/packs.ts`

- Modify runtime CLI modules:
  - `packages/boss-cli/src/runtime/cli/build-memory-summary.ts`
  - `packages/boss-cli/src/runtime/cli/check-stage.ts`
  - `packages/boss-cli/src/runtime/cli/evaluate-gates.ts`
  - `packages/boss-cli/src/runtime/cli/extract-memory.ts`
  - `packages/boss-cli/src/runtime/cli/generate-summary.ts`
  - `packages/boss-cli/src/runtime/cli/get-ready-artifacts.ts`
  - `packages/boss-cli/src/runtime/cli/init-pipeline.ts`
  - `packages/boss-cli/src/runtime/cli/inspect-events.ts`
  - `packages/boss-cli/src/runtime/cli/inspect-pipeline.ts`
  - `packages/boss-cli/src/runtime/cli/inspect-plugins.ts`
  - `packages/boss-cli/src/runtime/cli/inspect-progress.ts`
  - `packages/boss-cli/src/runtime/cli/query-memory.ts`
  - `packages/boss-cli/src/runtime/cli/record-artifact.ts`
  - `packages/boss-cli/src/runtime/cli/record-feedback.ts`
  - `packages/boss-cli/src/runtime/cli/register-plugins.ts`
  - `packages/boss-cli/src/runtime/cli/render-diagnostics.ts`
  - `packages/boss-cli/src/runtime/cli/replay-events.ts`
  - `packages/boss-cli/src/runtime/cli/retry-agent.ts`
  - `packages/boss-cli/src/runtime/cli/retry-stage.ts`
  - `packages/boss-cli/src/runtime/cli/run-plugin-hook.ts`
  - `packages/boss-cli/src/runtime/cli/update-agent.ts`
  - `packages/boss-cli/src/runtime/cli/update-stage.ts`

- Modify docs:
  - `README.md`
  - `CONTRIBUTING.md`
  - `DESIGN.md`
  - `skill/SKILL.md`
  - `skill/references/bmad-methodology.md`

- Tests:
  - Create: `test/cli/contract.test.ts`
  - Create: `test/cli/agent-cli-contract.test.ts`
  - Modify: `test/bin/boss-skill.test.ts`
  - Modify: `test/runtime/runtime-cli-contract.test.ts`
  - Modify existing command/runtime tests only when they assert old human-only output.

---

## Contract Decisions

- `useJson = values.json || !process.stdout.isTTY`.
- `--help` stays concise text and keeps stable `Usage:` / `Options:` sections.
- `--describe` returns JSON command metadata and is the machine-readable help surface.
- Structured command success envelopes use command-specific stable payloads, not a single forced wrapper. Example: `boss packs detect --json` returns `{ detected, matched, reason }`; `boss install --dry-run --json` returns `{ actions, risk_tier, requires_approval }`.
- Structured errors are always written to stderr as `{"error":{...}}` when `useJson` is true.
- Exit code `1` means permanent user/configuration error. Exit code `2` means retryable/transient error.
- `--yes` is required in non-interactive mode only when a command would delete, overwrite, or force-retry existing state.
- `--dry-run` is required for destructive previews and returns structured action plans. Read-only commands may accept `--dry-run` as a no-op plan if they already do not mutate; they should still include it in `--describe` only when meaningful.
- `--fields` and `--limit` apply to list/object JSON output before serialization. Missing requested fields are ignored rather than emitted as `null`.
- `--json-input=<json>` and `--json-input=-` are supported for commands with more than one user-provided data field. Flat flags remain supported.
- Inputs that form filesystem paths must reject path traversal and control characters before use.

---

### Task 1: Lock The Agent-Friendly CLI Contract With Failing Tests

**Files:**
- Create: `test/cli/agent-cli-contract.test.ts`
- Modify: `test/bin/boss-skill.test.ts`
- Modify: `test/runtime/runtime-cli-contract.test.ts`

- [ ] **Step 1: Add high-level command contract tests**

Create `test/cli/agent-cli-contract.test.ts`:

```ts
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const REPO_ROOT = path.resolve(import.meta.dirname, '..', '..');
const BOSS_BIN = path.join(REPO_ROOT, 'packages', 'boss-cli', 'dist', 'bin', 'boss.js');

function runBoss(args: string[], cwd: string, input?: string) {
  return spawnSync(process.execPath, [BOSS_BIN, ...args], {
    cwd,
    input,
    encoding: 'utf8',
    env: { ...process.env, NO_COLOR: '1' }
  });
}

function parseJson(stdout: string): unknown {
  expect(stdout.trim().length).toBeGreaterThan(0);
  return JSON.parse(stdout);
}

describe('agent-friendly boss CLI contract', () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'boss-agent-cli-'));
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it('defaults to JSON for non-TTY command output', () => {
    const result = runBoss(['packs', 'detect', '.'], tmpDir);

    expect(result.status).toBe(0);
    const payload = parseJson(result.stdout) as {
      detected: string;
      matched: string[];
    };
    expect(payload.detected).toBe('default');
    expect(Array.isArray(payload.matched)).toBe(true);
    expect(result.stderr).not.toContain('[PACK-DETECT]');
  });

  it('returns structured errors with code, input echo, retryability, and suggestion', () => {
    const result = runBoss(['packs', 'detect', '../outside'], tmpDir);

    expect(result.status).toBe(1);
    const payload = JSON.parse(result.stderr) as {
      error: {
        code: string;
        message: string;
        input: Record<string, unknown>;
        retryable: boolean;
        suggestion?: string;
      };
    };
    expect(payload.error.code).toBe('invalid_path');
    expect(payload.error.input).toEqual({ path: '../outside' });
    expect(payload.error.retryable).toBe(false);
    expect(payload.error.suggestion).toContain('project directory');
  });

  it('describes commands as stable JSON schemas', () => {
    const result = runBoss(['project', 'init', '--describe'], tmpDir);

    expect(result.status).toBe(0);
    const payload = parseJson(result.stdout) as {
      command: string;
      parameters: Array<{ name: string; type: string; required?: boolean }>;
      options: Array<{ name: string; type: string }>;
      risk_tier: string;
    };
    expect(payload.command).toBe('boss project init');
    expect(payload.parameters.some((param) => param.name === 'feature')).toBe(true);
    expect(payload.options.map((option) => option.name)).toContain('json');
    expect(payload.options.map((option) => option.name)).toContain('json-input');
    expect(payload.risk_tier).toBe('medium');
  });

  it('supports JSON input from stdin for project init dry-run', () => {
    const result = runBoss(
      ['project', 'init', '--json-input=-', '--dry-run', '--json'],
      tmpDir,
      '{"feature":"agent-json-input","template":true}'
    );

    expect(result.status).toBe(0);
    const payload = parseJson(result.stdout) as {
      actions: Array<{ type: string; path?: string }>;
      requires_approval: boolean;
    };
    expect(payload.actions.some((action) => action.type === 'create_feature_workspace')).toBe(true);
    expect(payload.requires_approval).toBe(false);
    expect(fs.existsSync(path.join(tmpDir, '.boss', 'agent-json-input'))).toBe(false);
  });

  it('requires --yes for non-interactive destructive overwrite', () => {
    fs.mkdirSync(path.join(tmpDir, '.boss', 'danger-zone'), { recursive: true });

    const result = runBoss(['project', 'init', 'danger-zone', '--force', '--json'], tmpDir);

    expect(result.status).toBe(1);
    const payload = JSON.parse(result.stderr) as { error: { code: string; retryable: boolean } };
    expect(payload.error.code).toBe('confirmation_required');
    expect(payload.error.retryable).toBe(false);
  });

  it('limits and picks fields for list-like JSON output', () => {
    const result = runBoss(['runtime', 'inspect-events', 'missing-feature', '--limit=1', '--fields=events', '--json'], tmpDir);

    expect(result.status).toBe(1);
    const payload = JSON.parse(result.stderr) as { error: { code: string } };
    expect(payload.error.code).toBe('feature_not_found');
  });
});
```

- [ ] **Step 2: Add command inventory assertions**

Append this test to `test/bin/boss-skill.test.ts`:

```ts
  it('exposes global agent contract flags in command help', () => {
    const help = runCli(['packages/boss-cli/dist/bin/boss.js', '--help']);
    expect(help.status).toBe(0);
    expect(help.stdout).toContain('--json');
    expect(help.stdout).toContain('--describe');
    expect(help.stdout).toContain('--json-input');

    for (const command of ['project', 'artifact', 'packs', 'hooks', 'runtime']) {
      const result = runCli(['packages/boss-cli/dist/bin/boss.js', command, '--help']);
      expect(result.status).toBe(0);
      expect(result.stdout + result.stderr).toContain('--json');
      expect(result.stdout + result.stderr).toContain('--describe');
    }
  });
```

- [ ] **Step 3: Add runtime CLI contract assertions**

Append this test to `test/runtime/runtime-cli-contract.test.ts`:

```ts
  it('runtime commands expose describe metadata and structured non-tty errors', () => {
    for (const command of [
      'init-pipeline',
      'update-stage',
      'update-agent',
      'record-artifact',
      'get-ready-artifacts',
      'evaluate-gates',
      'check-stage',
      'replay-events',
      'inspect-progress',
      'inspect-pipeline',
      'inspect-events',
      'inspect-plugins',
      'render-diagnostics',
      'extract-memory',
      'query-memory',
      'build-memory-summary',
      'generate-summary',
      'register-plugins',
      'run-plugin-hook',
      'record-feedback',
      'retry-agent',
      'retry-stage'
    ]) {
      const describe = runCli(command, ['--describe']);
      expect(describe.status, `${command} --describe`).toBe(0);
      const metadata = JSON.parse(describe.stdout) as { command: string; options: Array<{ name: string }> };
      expect(metadata.command).toContain(command);
      expect(metadata.options.map((option) => option.name)).toContain('json');
    }

    const result = runCli('update-stage', ['missing-feature', '1', 'running', '--bad-flag']);
    expect(result.status).toBe(1);
    const payload = JSON.parse(result.stderr) as { error: { code: string; retryable: boolean } };
    expect(payload.error.code).toBe('unknown_option');
    expect(payload.error.retryable).toBe(false);
  });
```

- [ ] **Step 4: Run tests to verify red**

Run:

```bash
npm test -- test/cli/agent-cli-contract.test.ts test/bin/boss-skill.test.ts test/runtime/runtime-cli-contract.test.ts
```

Expected:

```text
FAIL test/cli/agent-cli-contract.test.ts
FAIL test/bin/boss-skill.test.ts
FAIL test/runtime/runtime-cli-contract.test.ts
```

The failures should mention missing `--describe`, human-only output from `boss packs detect`, missing structured errors, and missing global help flags.

- [ ] **Step 5: Commit red tests**

```bash
git add test/cli/agent-cli-contract.test.ts test/bin/boss-skill.test.ts test/runtime/runtime-cli-contract.test.ts
git commit -m "test: lock agent friendly cli contract"
```

---

### Task 2: Add Shared CLI Contract Utilities

**Files:**
- Create: `packages/boss-cli/src/cli/contract.ts`
- Create: `packages/boss-cli/src/cli/command-registry.ts`
- Create: `test/cli/contract.test.ts`

- [ ] **Step 1: Write focused utility tests**

Create `test/cli/contract.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import path from 'node:path';

import {
  CliUserError,
  createCliContext,
  describeCommand,
  exitCodeForError,
  outputList,
  pickFields,
  readJsonInputText,
  validatePathInside
} from '../../packages/boss-cli/src/cli/contract.js';

describe('CLI contract utilities', () => {
  it('defaults to json when stdout is not a TTY', () => {
    const context = createCliContext(['--limit=2'], {
      command: 'boss test',
      stdoutIsTTY: false,
      stdinIsTTY: false
    });

    expect(context.useJson).toBe(true);
    expect(context.values.limit).toBe('2');
  });

  it('picks fields and applies list limits', () => {
    const context = createCliContext(['--fields=name,status', '--limit=1'], {
      command: 'boss test',
      stdoutIsTTY: false,
      stdinIsTTY: false
    });

    const payload = outputList(
      [
        { name: 'a', status: 'ok', secret: 'hidden' },
        { name: 'b', status: 'ok', secret: 'hidden' }
      ],
      context
    );

    expect(payload).toEqual([{ name: 'a', status: 'ok' }]);
  });

  it('rejects path traversal and control characters', () => {
    const baseDir = path.resolve('/tmp/boss-base');

    expect(() => validatePathInside('../outside', baseDir, 'project directory')).toThrow(CliUserError);
    expect(() => validatePathInside('bad\npath', baseDir, 'project directory')).toThrow(CliUserError);
    expect(validatePathInside('inside/project', baseDir, 'project directory')).toBe(
      path.join(baseDir, 'inside', 'project')
    );
  });

  it('parses direct and stdin json input text', () => {
    expect(readJsonInputText('{"feature":"demo"}', '')).toEqual({ feature: 'demo' });
    expect(readJsonInputText('-', '{"feature":"stdin-demo"}')).toEqual({ feature: 'stdin-demo' });
  });

  it('describes commands with stable metadata', () => {
    const metadata = describeCommand({
      command: 'boss project init',
      summary: 'Initialize a Boss feature workspace',
      parameters: [{ name: 'feature', type: 'string', required: true }],
      options: [{ name: 'json', type: 'boolean', default: false }],
      risk_tier: 'medium'
    });

    expect(metadata.command).toBe('boss project init');
    expect(metadata.parameters[0]).toEqual({ name: 'feature', type: 'string', required: true });
    expect(metadata.risk_tier).toBe('medium');
  });

  it('maps retryable errors to exit code 2', () => {
    expect(exitCodeForError(new CliUserError({
      code: 'transient_timeout',
      message: 'Timed out',
      retryable: true
    }))).toBe(2);
  });
});
```

- [ ] **Step 2: Run utility tests to verify red**

Run:

```bash
npm test -- test/cli/contract.test.ts
```

Expected:

```text
FAIL test/cli/contract.test.ts
Cannot find module '../../packages/boss-cli/src/cli/contract.js'
```

- [ ] **Step 3: Create `contract.ts`**

Create `packages/boss-cli/src/cli/contract.ts`:

```ts
import { readFileSync } from 'node:fs';
import { relative, resolve } from 'node:path';
import { parseArgs } from 'node:util';

export type RiskTier = 'low' | 'medium' | 'high';
export type JsonObject = Record<string, unknown>;

export interface CliErrorData {
  code: string;
  message: string;
  input?: JsonObject;
  retryable: boolean;
  suggestion?: string;
}

export class CliUserError extends Error {
  readonly code: string;
  readonly input?: JsonObject;
  readonly retryable: boolean;
  readonly suggestion?: string;

  constructor(data: CliErrorData) {
    super(data.message);
    this.name = 'CliUserError';
    this.code = data.code;
    this.input = data.input;
    this.retryable = data.retryable;
    this.suggestion = data.suggestion;
  }
}

export interface CliContext {
  command: string;
  values: {
    json: boolean;
    yes: boolean;
    dryRun: boolean;
    describe: boolean;
    fields?: string;
    limit: string;
    jsonInput?: string;
  };
  positionals: string[];
  useJson: boolean;
  stdinIsTTY: boolean;
  stdoutIsTTY: boolean;
}

export interface CommandParameter {
  name: string;
  type: 'string' | 'number' | 'boolean' | 'array' | 'object';
  required?: boolean;
  enum?: string[];
  default?: unknown;
}

export interface CommandOption extends CommandParameter {
  short?: string;
}

export interface CommandDescription {
  command: string;
  summary: string;
  parameters: CommandParameter[];
  options: CommandOption[];
  risk_tier: RiskTier;
}

export function createCliContext(
  argv: string[],
  {
    command,
    stdinIsTTY = Boolean(process.stdin.isTTY),
    stdoutIsTTY = Boolean(process.stdout.isTTY)
  }: { command: string; stdinIsTTY?: boolean; stdoutIsTTY?: boolean }
): CliContext {
  const { values, positionals } = parseArgs({
    args: argv,
    allowPositionals: true,
    options: {
      json: { type: 'boolean', default: false },
      yes: { type: 'boolean', short: 'y', default: false },
      'dry-run': { type: 'boolean', default: false },
      fields: { type: 'string' },
      limit: { type: 'string', default: '100' },
      'json-input': { type: 'string' },
      describe: { type: 'boolean', default: false }
    },
    strict: false
  });

  return {
    command,
    values: {
      json: Boolean(values.json),
      yes: Boolean(values.yes),
      dryRun: Boolean(values['dry-run']),
      describe: Boolean(values.describe),
      fields: typeof values.fields === 'string' ? values.fields : undefined,
      limit: typeof values.limit === 'string' ? values.limit : '100',
      jsonInput: typeof values['json-input'] === 'string' ? values['json-input'] : undefined
    },
    positionals,
    useJson: Boolean(values.json) || !stdoutIsTTY,
    stdinIsTTY,
    stdoutIsTTY
  };
}

export function parseLimit(limit: string): number {
  const parsed = Number(limit);
  if (!Number.isInteger(parsed) || parsed < 0 || parsed > 1000) {
    throw new CliUserError({
      code: 'invalid_limit',
      message: `Invalid --limit value: ${limit}`,
      input: { limit },
      retryable: false,
      suggestion: 'Use an integer between 0 and 1000'
    });
  }
  return parsed;
}

export function pickFields<T extends JsonObject>(obj: T, fields?: string): JsonObject {
  if (!fields) return obj;
  const keys = fields.split(',').map((key) => key.trim()).filter(Boolean);
  return Object.fromEntries(keys.filter((key) => key in obj).map((key) => [key, obj[key]]));
}

export function outputList(items: JsonObject[], context: CliContext): JsonObject[] {
  return items.slice(0, parseLimit(context.values.limit)).map((item) => pickFields(item, context.values.fields));
}

export function writeOutput(data: unknown, context: CliContext, renderText: (data: unknown) => string): void {
  const payload = Array.isArray(data)
    ? outputList(data.filter((item): item is JsonObject => Boolean(item) && typeof item === 'object' && !Array.isArray(item)), context)
    : Boolean(data) && typeof data === 'object' && !Array.isArray(data)
      ? pickFields(data as JsonObject, context.values.fields)
      : data;

  process.stdout.write(context.useJson ? `${JSON.stringify(payload)}\n` : renderText(payload));
}

export function readJsonInputText(raw: string, stdinText: string): unknown {
  const text = raw === '-' ? stdinText : raw;
  try {
    return JSON.parse(text) as unknown;
  } catch {
    throw new CliUserError({
      code: 'invalid_json_input',
      message: 'Invalid JSON supplied to --json-input',
      input: { jsonInput: raw === '-' ? '<stdin>' : raw },
      retryable: false,
      suggestion: 'Pass valid JSON or use --json-input=- with JSON on stdin'
    });
  }
}

export function readJsonInput(raw: string | undefined): unknown | null {
  if (!raw) return null;
  return readJsonInputText(raw, raw === '-' ? readFileSync(0, 'utf8') : '');
}

export function assertConfirmed(context: CliContext, action: string): void {
  if (!context.stdinIsTTY && !context.values.yes) {
    throw new CliUserError({
      code: 'confirmation_required',
      message: '--yes required in non-interactive mode',
      input: { action },
      retryable: false,
      suggestion: `Re-run ${context.command} with --yes after reviewing --dry-run output`
    });
  }
}

export function validatePathInside(input: string, baseDir: string, label: string): string {
  if (/[\x00-\x1f]/.test(input)) {
    throw new CliUserError({
      code: 'invalid_path',
      message: `Control characters rejected in ${label}`,
      input: { path: input },
      retryable: false,
      suggestion: `Pass a ${label} path without control characters`
    });
  }
  const resolved = resolve(baseDir, input);
  const rel = relative(baseDir, resolved);
  if (rel === '..' || rel.startsWith(`..${process.platform === 'win32' ? '\\\\' : '/'}`) || resolve(input) === input && !resolved.startsWith(resolve(baseDir))) {
    throw new CliUserError({
      code: 'invalid_path',
      message: `Path traversal rejected for ${label}: ${input}`,
      input: { path: input },
      retryable: false,
      suggestion: `Use a ${label} path inside the current project directory`
    });
  }
  return resolved;
}

export function describeCommand(description: CommandDescription): CommandDescription {
  return {
    command: description.command,
    summary: description.summary,
    parameters: description.parameters,
    options: description.options,
    risk_tier: description.risk_tier
  };
}

export function renderHelp(description: CommandDescription, usage: string): string {
  const lines = [
    `Usage: ${usage}`,
    '',
    'Options:',
    '  --json              Output JSON',
    '  --describe          Output command schema as JSON',
    '  --fields <list>     Include only comma-separated JSON fields',
    '  --limit <number>    Limit list output, default 100',
    '  --json-input <json|- > Read input from JSON string or stdin',
    '  --dry-run           Preview changes without executing',
    '  -y, --yes           Skip confirmation for destructive actions',
    '  -h, --help          Show help',
    ''
  ];
  return lines.join('\n');
}

export function exitCodeForError(err: unknown): number {
  return err instanceof CliUserError && err.retryable ? 2 : 1;
}

export function errorPayload(err: unknown): { error: CliErrorData } {
  if (err instanceof CliUserError) {
    return {
      error: {
        code: err.code,
        message: err.message,
        input: err.input,
        retryable: err.retryable,
        suggestion: err.suggestion
      }
    };
  }
  const message = err instanceof Error ? err.message : String(err);
  return {
    error: {
      code: 'internal_error',
      message,
      retryable: false,
      suggestion: 'Re-run with --describe to verify command parameters'
    }
  };
}

export function writeError(err: unknown, context: Pick<CliContext, 'useJson'>): void {
  const payload = errorPayload(err);
  if (context.useJson) {
    process.stderr.write(`${JSON.stringify(payload)}\n`);
    return;
  }
  process.stderr.write(`Error [${payload.error.code}]: ${payload.error.message}\n`);
  if (payload.error.suggestion) {
    process.stderr.write(`Hint: ${payload.error.suggestion}\n`);
  }
}

export function runMain(fn: () => number | Promise<number>, context: Pick<CliContext, 'useJson'>): Promise<number> {
  return Promise.resolve()
    .then(fn)
    .catch((err) => {
      writeError(err, context);
      return exitCodeForError(err);
    });
}
```

- [ ] **Step 4: Create command registry**

Create `packages/boss-cli/src/cli/command-registry.ts`:

```ts
import type { CommandDescription } from './contract.js';

const commonOptions = [
  { name: 'json', type: 'boolean' as const, default: false },
  { name: 'describe', type: 'boolean' as const, default: false },
  { name: 'fields', type: 'string' as const },
  { name: 'limit', type: 'string' as const, default: '100' },
  { name: 'json-input', type: 'string' as const },
  { name: 'dry-run', type: 'boolean' as const, default: false },
  { name: 'yes', type: 'boolean' as const, short: 'y', default: false }
];

export const commandDescriptions: Record<string, CommandDescription> = {
  'boss project init': {
    command: 'boss project init',
    summary: 'Initialize a Boss feature workspace',
    parameters: [{ name: 'feature', type: 'string', required: true }],
    options: [
      ...commonOptions,
      { name: 'template', type: 'boolean', short: 't', default: false },
      { name: 'force', type: 'boolean', short: 'f', default: false }
    ],
    risk_tier: 'medium'
  },
  'boss artifact prepare': {
    command: 'boss artifact prepare',
    summary: 'Prepare an artifact from project or built-in templates',
    parameters: [
      { name: 'feature', type: 'string', required: true },
      { name: 'artifact', type: 'string', required: true },
      { name: 'template', type: 'string', required: false }
    ],
    options: commonOptions,
    risk_tier: 'medium'
  },
  'boss packs detect': {
    command: 'boss packs detect',
    summary: 'Detect the best pipeline pack for a project directory',
    parameters: [{ name: 'projectDir', type: 'string', required: false, default: '.' }],
    options: commonOptions,
    risk_tier: 'low'
  },
  'boss install': {
    command: 'boss install',
    summary: 'Install the thin Boss skill bundle into detected agents',
    parameters: [],
    options: commonOptions,
    risk_tier: 'medium'
  },
  'boss uninstall': {
    command: 'boss uninstall',
    summary: 'Remove copied Boss skill bundles from detected agents',
    parameters: [],
    options: commonOptions,
    risk_tier: 'high'
  },
  'boss path': {
    command: 'boss path',
    summary: 'Print the package root used for Claude plugin mode',
    parameters: [],
    options: commonOptions,
    risk_tier: 'low'
  },
  'boss hooks run': {
    command: 'boss hooks run',
    summary: 'Run a Boss hook through the hook dispatcher',
    parameters: [
      { name: 'hookId', type: 'string', required: true },
      { name: 'scriptRelativePath', type: 'string', required: true },
      { name: 'profilesCsv', type: 'string', required: false }
    ],
    options: commonOptions,
    risk_tier: 'medium'
  }
};

export const runtimeCommandNames = [
  'init-pipeline',
  'update-stage',
  'update-agent',
  'record-artifact',
  'get-ready-artifacts',
  'evaluate-gates',
  'check-stage',
  'replay-events',
  'inspect-progress',
  'inspect-pipeline',
  'inspect-events',
  'inspect-plugins',
  'render-diagnostics',
  'extract-memory',
  'query-memory',
  'build-memory-summary',
  'generate-summary',
  'register-plugins',
  'run-plugin-hook',
  'record-feedback',
  'retry-agent',
  'retry-stage'
] as const;
```

- [ ] **Step 5: Run utility tests to verify green**

Run:

```bash
npm test -- test/cli/contract.test.ts
```

Expected:

```text
PASS test/cli/contract.test.ts
```

- [ ] **Step 6: Commit shared CLI utilities**

```bash
git add packages/boss-cli/src/cli/contract.ts packages/boss-cli/src/cli/command-registry.ts test/cli/contract.test.ts
git commit -m "feat: add shared agent cli contract utilities"
```

---

### Task 3: Wire Root Dispatcher To Global Flags, Describe, And Structured Errors

**Files:**
- Modify: `packages/boss-cli/src/bin/boss.ts`
- Modify: `test/bin/boss-skill.test.ts`
- Test: `test/cli/agent-cli-contract.test.ts`

- [ ] **Step 1: Add dispatcher-specific red tests**

Append to `test/bin/boss-skill.test.ts`:

```ts
  it('returns structured root command metadata with --describe', () => {
    const result = runCli(['packages/boss-cli/dist/bin/boss.js', '--describe']);
    expect(result.status).toBe(0);
    const payload = JSON.parse(result.stdout) as {
      command: string;
      commands: string[];
      options: Array<{ name: string }>;
    };
    expect(payload.command).toBe('boss');
    expect(payload.commands).toContain('project init');
    expect(payload.commands).toContain('runtime COMMAND');
    expect(payload.options.map((option) => option.name)).toContain('json');
  });

  it('returns structured errors for unknown root commands in non-tty mode', () => {
    const result = runCli(['packages/boss-cli/dist/bin/boss.js', 'unknown-command']);
    expect(result.status).toBe(1);
    const payload = JSON.parse(result.stderr) as { error: { code: string; input: Record<string, unknown> } };
    expect(payload.error.code).toBe('unknown_command');
    expect(payload.error.input).toEqual({ command: 'unknown-command' });
  });
```

- [ ] **Step 2: Run dispatcher tests to verify red**

Run:

```bash
npm test -- test/bin/boss-skill.test.ts
```

Expected:

```text
FAIL
```

The failures should mention missing `--describe`, missing help flags, and non-JSON unknown command stderr.

- [ ] **Step 3: Update root usage and dispatcher context**

In `packages/boss-cli/src/bin/boss.ts`, import the contract utilities:

```ts
import {
  CliUserError,
  createCliContext,
  describeCommand,
  renderHelp,
  runMain,
  writeOutput
} from '../cli/contract.js';
import { commandDescriptions, runtimeCommandNames } from '../cli/command-registry.js';
```

Replace root `USAGE` with concise stable help text:

```ts
const rootDescription = {
  command: 'boss',
  summary: 'Boss Skill CLI',
  parameters: [{ name: 'command', type: 'string' as const, required: false }],
  options: [
    { name: 'json', type: 'boolean' as const, default: false },
    { name: 'describe', type: 'boolean' as const, default: false },
    { name: 'json-input', type: 'string' as const },
    { name: 'fields', type: 'string' as const },
    { name: 'limit', type: 'string' as const, default: '100' },
    { name: 'dry-run', type: 'boolean' as const, default: false },
    { name: 'yes', type: 'boolean' as const, short: 'y', default: false }
  ],
  risk_tier: 'low' as const
};

const ROOT_USAGE = [
  renderHelp(rootDescription, 'boss COMMAND [options]'),
  'Commands:',
  '  install',
  '  uninstall',
  '  path',
  '  runtime COMMAND',
  '  project init',
  '  artifact prepare',
  '  packs detect',
  '  hooks run',
  ''
].join('\n');
```

- [ ] **Step 4: Add root describe output**

Add:

```ts
function describeRoot() {
  return {
    ...describeCommand(rootDescription),
    version: pkg.version,
    commands: [
      'install',
      'uninstall',
      'path',
      'runtime COMMAND',
      'project init',
      'artifact prepare',
      'packs detect',
      'hooks run'
    ],
    runtime_commands: runtimeCommandNames
  };
}
```

Update `showHelp()`:

```ts
export function showHelp(): void {
  process.stdout.write(ROOT_USAGE);
}
```

- [ ] **Step 5: Route unknown commands through structured errors**

Update `main`:

```ts
export async function main(argv: string[] = process.argv.slice(2)): Promise<number> {
  const rootContext = createCliContext(argv, { command: 'boss' });

  if (rootContext.values.describe) {
    writeOutput(describeRoot(), rootContext, () => `${JSON.stringify(describeRoot(), null, 2)}\n`);
    return 0;
  }

  const cmd = rootContext.positionals[0];

  switch (cmd) {
    // keep existing cases, but pass argv slices that include global options to subcommands
    default:
      throw new CliUserError({
        code: 'unknown_command',
        message: `Unknown command: ${cmd}`,
        input: { command: cmd },
        retryable: false,
        suggestion: 'Run boss --describe to list available commands'
      });
  }
}
```

At the entrypoint bottom:

```ts
if (process.argv[1] && fs.realpathSync(process.argv[1]) === fs.realpathSync(__filename)) {
  const context = createCliContext(process.argv.slice(2), { command: 'boss' });
  process.exit(await runMain(() => main(process.argv.slice(2)), context));
}
```

Keep the existing command switch bodies but replace raw `console.error` unknown subcommand branches with `CliUserError` using `code: 'unknown_command'`.

- [ ] **Step 6: Run dispatcher tests**

Run:

```bash
npm run build
npm test -- test/bin/boss-skill.test.ts test/cli/agent-cli-contract.test.ts
```

Expected:

```text
PASS test/bin/boss-skill.test.ts
```

`test/cli/agent-cli-contract.test.ts` may still fail on command modules that Task 4 and later will migrate.

- [ ] **Step 7: Commit dispatcher wiring**

```bash
git add packages/boss-cli/src/bin/boss.ts test/bin/boss-skill.test.ts
git commit -m "feat: add agent contract to boss dispatcher"
```

---

### Task 4: Make Install, Uninstall, Path, Project, Artifact, Packs, And Hooks Agent-Friendly

**Files:**
- Modify: `packages/boss-cli/src/commands/install.ts`
- Modify: `packages/boss-cli/src/commands/project.ts`
- Modify: `packages/boss-cli/src/commands/artifact.ts`
- Modify: `packages/boss-cli/src/commands/packs.ts`
- Modify: `packages/boss-cli/src/bin/boss.ts`
- Modify: `test/cli/agent-cli-contract.test.ts`
- Modify: `test/bin/boss-skill.test.ts`

- [ ] **Step 1: Add command behavior tests**

Append to `test/cli/agent-cli-contract.test.ts`:

```ts
  it('install dry-run returns structured actions and writes nothing', () => {
    const home = path.join(tmpDir, 'home');
    fs.mkdirSync(path.join(home, '.codex'), { recursive: true });

    const result = spawnSync(process.execPath, [BOSS_BIN, 'install', '--dry-run', '--json'], {
      cwd: tmpDir,
      env: { ...process.env, HOME: home },
      encoding: 'utf8'
    });

    expect(result.status).toBe(0);
    const payload = JSON.parse(result.stdout) as {
      actions: Array<{ type: string; agent: string; path: string }>;
      risk_tier: string;
      requires_approval: boolean;
    };
    expect(payload.actions.some((action) => action.agent === 'Codex')).toBe(true);
    expect(payload.risk_tier).toBe('medium');
    expect(payload.requires_approval).toBe(false);
    expect(fs.existsSync(path.join(home, '.codex', 'skills', 'boss'))).toBe(false);
  });

  it('artifact prepare dry-run returns a structured write plan', () => {
    fs.mkdirSync(path.join(tmpDir, '.boss', 'demo'), { recursive: true });
    const result = runBoss(['artifact', 'prepare', 'demo', 'prd.md', '--dry-run', '--json'], tmpDir);

    expect(result.status).toBe(0);
    const payload = JSON.parse(result.stdout) as {
      actions: Array<{ type: string; path: string; template: string }>;
      risk_tier: string;
    };
    expect(payload.actions).toEqual([
      expect.objectContaining({ type: 'write_artifact', path: '.boss/demo/prd.md' })
    ]);
    expect(payload.risk_tier).toBe('medium');
    expect(fs.existsSync(path.join(tmpDir, '.boss', 'demo', 'prd.md'))).toBe(false);
  });

  it('packs detect supports fields and limit', () => {
    const result = runBoss(['packs', 'detect', '.', '--json', '--fields=detected', '--limit=1'], tmpDir);

    expect(result.status).toBe(0);
    expect(JSON.parse(result.stdout)).toEqual({ detected: 'default' });
  });
```

- [ ] **Step 2: Run command behavior tests to verify red**

Run:

```bash
npm test -- test/cli/agent-cli-contract.test.ts test/bin/boss-skill.test.ts
```

Expected:

```text
FAIL test/cli/agent-cli-contract.test.ts
```

- [ ] **Step 3: Update `install.ts`**

Refactor install into plan builders:

```ts
interface InstallAction {
  type: 'install_skill' | 'register_plugin' | 'remove_skill' | 'skip_missing';
  agent: string;
  path: string;
}

function buildInstallPlan(): InstallAction[] {
  return AGENTS.filter((agent) => agent.detect()).map((agent) => ({
    type: agent.method === 'copy' ? 'install_skill' : 'register_plugin',
    agent: agent.name,
    path: agent.dest()
  }));
}

function buildUninstallPlan(): InstallAction[] {
  return AGENTS.filter((agent) => agent.method === 'copy' && agent.detect()).map((agent) => ({
    type: fs.existsSync(agent.dest()) ? 'remove_skill' : 'skip_missing',
    agent: agent.name,
    path: agent.dest()
  }));
}
```

Use `createCliContext` in `installMain`:

```ts
const context = createCliContext(argv, { command: 'boss install' });
if (context.values.describe) {
  writeOutput(describeCommand(commandDescriptions['boss install']), context, () => JSON.stringify(commandDescriptions['boss install'], null, 2) + '\n');
  return 0;
}
```

For `install --dry-run`:

```ts
writeOutput({
  actions: buildInstallPlan(),
  risk_tier: 'medium',
  requires_approval: false
}, context, () => renderInstallPlanText(buildInstallPlan()));
return 0;
```

For `uninstall`, require confirmation in non-TTY:

```ts
const uninstallContext = createCliContext(argv, { command: 'boss uninstall' });
const actions = buildUninstallPlan();
if (uninstallContext.values.dryRun) {
  writeOutput({ actions, risk_tier: 'high', requires_approval: true }, uninstallContext, () => renderInstallPlanText(actions));
  return 0;
}
assertConfirmed(uninstallContext, 'uninstall');
```

Keep `boss path` JSON output:

```ts
writeOutput({ path: PKG_ROOT }, context, (payload) => `${(payload as { path: string }).path}\n`);
```

- [ ] **Step 4: Update `project.ts`**

Define input type and resolver:

```ts
interface ProjectInitInput {
  feature: string;
  template?: boolean;
  force?: boolean;
}

function resolveProjectInput(argv: string[]): { input: ProjectInitInput; context: CliContext } {
  const context = createCliContext(argv, { command: 'boss project init' });
  const jsonInput = readJsonInput(context.values.jsonInput) as Partial<ProjectInitInput> | null;
  if (jsonInput) {
    return {
      context,
      input: {
        feature: String(jsonInput.feature || ''),
        template: Boolean(jsonInput.template),
        force: Boolean(jsonInput.force)
      }
    };
  }
  return {
    context,
    input: {
      feature: context.positionals[0] || '',
      template: argv.includes('-t') || argv.includes('--template'),
      force: argv.includes('-f') || argv.includes('--force')
    }
  };
}
```

Build dry-run action plan:

```ts
function buildProjectInitActions(cwd: string, input: ProjectInitInput): Array<{ type: string; path: string; overwrite: boolean }> {
  const featureDir = path.join(cwd, '.boss', input.feature);
  const actions = [
    {
      type: 'create_feature_workspace',
      path: path.join('.boss', input.feature),
      overwrite: fs.existsSync(featureDir)
    }
  ];
  if (input.template) {
    actions.push({
      type: 'copy_project_templates',
      path: path.join('.boss', 'templates'),
      overwrite: fs.existsSync(path.join(cwd, '.boss', 'templates'))
    });
  }
  return actions;
}
```

When `force` would overwrite and `!dryRun`, call:

```ts
assertConfirmed(context, 'project_init_overwrite');
```

For `dryRun`, output:

```ts
writeOutput({
  actions: buildProjectInitActions(cwd, input),
  risk_tier: input.force ? 'high' : 'medium',
  requires_approval: Boolean(input.force)
}, context, () => renderProjectPlanText(input, cwd));
return 0;
```

For success, output:

```ts
writeOutput({
  feature: input.feature,
  workspace: relativeTarget,
  templatesInitialized: input.template,
  skippedFeatureBootstrap: skipFeatureBootstrap,
  next: input.template
    ? 'edit .boss/templates before running /boss'
    : 'run /boss to start development'
}, context, () => humanMessage);
```

- [ ] **Step 5: Update `artifact.ts`**

Add `ArtifactPrepareInput` and JSON input:

```ts
interface ArtifactPrepareInput {
  feature: string;
  artifact: string;
  template?: string;
}
```

Validate `feature`, `artifact`, and `template` for control characters. Reject path traversal in `artifact` and `template`:

```ts
if (artifact.includes('..') || path.isAbsolute(artifact)) {
  throw new CliUserError({
    code: 'invalid_artifact_path',
    message: `Invalid artifact path: ${artifact}`,
    input: { artifact },
    retryable: false,
    suggestion: 'Use an artifact name such as prd.md or architecture.md'
  });
}
```

For `--dry-run --json`, output:

```ts
writeOutput({
  actions: [
    {
      type: 'write_artifact',
      path: path.join('.boss', feature, artifact),
      template: path.relative(cwd, templatePath)
    }
  ],
  risk_tier: 'medium',
  requires_approval: false
}, context, () => `Would prepare ${artifact}\n`);
return 0;
```

- [ ] **Step 6: Update `packs.ts`**

Use `createCliContext` and safe path validation:

```ts
const context = createCliContext(argv, { command: 'boss packs detect' });
const projectArg = context.positionals[0] || '.';
const projectDir = validatePathInside(projectArg, cwd, 'project directory');
const result = detectPipelinePacks(projectDir);
const payload = {
  detected: result.detected.name,
  detectedPack: result.detected,
  matched: result.matched.map((pack) => pack.name),
  matchedPacks: result.matched,
  reason: result.matched.length === 0 ? 'no pack matched' : 'matched pack priority'
};
writeOutput(payload, context, () => `${result.detected.name}\n`);
```

Remove `[PACK-DETECT]` stderr in JSON mode:

```ts
if (!context.useJson) {
  for (const pack of result.matched) {
    process.stderr.write(`[PACK-DETECT] 匹配: ${pack.name} (priority=${pack.priority})\n`);
  }
}
```

- [ ] **Step 7: Update `boss hooks run` wrapper**

In `packages/boss-cli/src/bin/boss.ts`, validate `script-relative-path`:

```ts
const scriptRel = argv[2] || '';
if (scriptRel) validatePathInside(scriptRel, path.join(PKG_ROOT, 'scripts'), 'hook script');
```

For JSON mode, use `spawnSync` with `stdio: ['inherit', 'pipe', 'pipe']` and output:

```ts
writeOutput({
  hook: argv[1],
  script: scriptRel,
  exitCode: result.status ?? 0,
  stdout: result.stdout.toString(),
  stderr: result.stderr.toString()
}, context, () => result.stdout.toString());
```

Keep human mode using existing inherited stdio.

- [ ] **Step 8: Run command tests**

Run:

```bash
npm run build
npm test -- test/cli/agent-cli-contract.test.ts test/bin/boss-skill.test.ts
```

Expected:

```text
PASS test/bin/boss-skill.test.ts
PASS test/cli/agent-cli-contract.test.ts
```

- [ ] **Step 9: Commit top-level command migration**

```bash
git add packages/boss-cli/src/commands/install.ts packages/boss-cli/src/commands/project.ts packages/boss-cli/src/commands/artifact.ts packages/boss-cli/src/commands/packs.ts packages/boss-cli/src/bin/boss.ts test/cli/agent-cli-contract.test.ts test/bin/boss-skill.test.ts
git commit -m "feat: make top level boss commands agent friendly"
```

---

### Task 5: Migrate Read-Only Runtime Commands To The Shared Contract

**Files:**
- Modify read-only runtime commands:
  - `packages/boss-cli/src/runtime/cli/check-stage.ts`
  - `packages/boss-cli/src/runtime/cli/generate-summary.ts`
  - `packages/boss-cli/src/runtime/cli/get-ready-artifacts.ts`
  - `packages/boss-cli/src/runtime/cli/inspect-events.ts`
  - `packages/boss-cli/src/runtime/cli/inspect-pipeline.ts`
  - `packages/boss-cli/src/runtime/cli/inspect-plugins.ts`
  - `packages/boss-cli/src/runtime/cli/inspect-progress.ts`
  - `packages/boss-cli/src/runtime/cli/query-memory.ts`
  - `packages/boss-cli/src/runtime/cli/replay-events.ts`
  - `packages/boss-cli/src/runtime/cli/render-diagnostics.ts`
  - `packages/boss-cli/src/runtime/cli/build-memory-summary.ts`
  - `packages/boss-cli/src/runtime/cli/extract-memory.ts`
- Modify: `test/runtime/runtime-cli-contract.test.ts`

- [x] **Step 1: Add read-only runtime tests**

Append to `test/runtime/runtime-cli-contract.test.ts`:

```ts
  it('read-only runtime commands default to json in non-tty mode and support fields/limit', () => {
    initPipeline('test-feat', { cwd: tmpDir });

    const events = runCli('inspect-events', ['test-feat', '--limit=1', '--fields=events']);
    expect(events.status).toBe(0);
    const eventsPayload = JSON.parse(events.stdout) as { events: unknown[] };
    expect(Object.keys(eventsPayload)).toEqual(['events']);
    expect(eventsPayload.events.length).toBeLessThanOrEqual(1);

    const pipeline = runCli('inspect-pipeline', ['test-feat', '--fields=feature,status']);
    expect(pipeline.status).toBe(0);
    expect(JSON.parse(pipeline.stdout)).toEqual({
      feature: 'test-feat',
      status: 'initialized'
    });
  });

  it('read-only runtime command errors are structured in non-tty mode', () => {
    const result = runCli('inspect-pipeline', ['missing-feature']);

    expect(result.status).toBe(1);
    const payload = JSON.parse(result.stderr) as { error: { code: string; input: Record<string, unknown> } };
    expect(payload.error.code).toBe('feature_not_found');
    expect(payload.error.input).toEqual({ feature: 'missing-feature' });
  });
```

- [x] **Step 2: Run read-only tests to verify red**

Run:

```bash
npm test -- test/runtime/runtime-cli-contract.test.ts
```

Expected:

```text
FAIL
```

The failing assertions should show text output for non-TTY commands and unstructured stderr errors.

- [x] **Step 3: Add runtime command descriptions**

Add descriptions for read-only runtime commands to `packages/boss-cli/src/cli/command-registry.ts`:

```ts
export const runtimeCommandDescriptions: Record<string, CommandDescription> = Object.fromEntries(
  runtimeCommandNames.map((name) => [
    name,
    {
      command: `boss runtime ${name}`,
      summary: `Run runtime command ${name}`,
      parameters: [{ name: 'feature', type: 'string', required: false }],
      options: [
        { name: 'json', type: 'boolean', default: false },
        { name: 'describe', type: 'boolean', default: false },
        { name: 'fields', type: 'string' },
        { name: 'limit', type: 'string', default: '100' },
        { name: 'dry-run', type: 'boolean', default: false },
        { name: 'json-input', type: 'string' }
      ],
      risk_tier: 'low'
    }
  ])
) as Record<string, CommandDescription>;
```

- [x] **Step 4: Migrate `inspect-events.ts` as the reference pattern**

Replace manual JSON/text branching with:

```ts
const context = createCliContext(argv, { command: 'boss runtime inspect-events' });
if (context.values.describe) {
  writeOutput(describeCommand(runtimeCommandDescriptions['inspect-events']), context, () => JSON.stringify(runtimeCommandDescriptions['inspect-events'], null, 2) + '\n');
  return 0;
}
```

Use existing parser values plus common options:

```ts
const limit = parseLimit(parsed.limit ? String(parsed.limit) : context.values.limit);
const payload = inspectEvents(parsed.feature, { cwd, limit, type: parsed.type });
writeOutput(payload, context, () => renderText(payload));
return 0;
```

At entrypoint bottom, replace raw catch with:

```ts
const context = createCliContext(process.argv.slice(2), { command: 'boss runtime inspect-events' });
process.exit(await runMain(() => main(process.argv.slice(2), { cwd: process.cwd() }), context));
```

- [x] **Step 5: Apply the read-only pattern to the remaining files**

For `check-stage.ts`, add:

```ts
const context = createCliContext(argv, { command: 'boss runtime check-stage' });
if (context.values.describe) {
  writeOutput(describeCommand(runtimeCommandDescriptions['check-stage']), context, () => JSON.stringify(runtimeCommandDescriptions['check-stage'], null, 2) + '\n');
  return 0;
}
```

For `get-ready-artifacts.ts`, add:

```ts
const context = createCliContext(argv, { command: 'boss runtime get-ready-artifacts' });
if (context.values.describe) {
  writeOutput(describeCommand(runtimeCommandDescriptions['get-ready-artifacts']), context, () => JSON.stringify(runtimeCommandDescriptions['get-ready-artifacts'], null, 2) + '\n');
  return 0;
}
```

For `inspect-pipeline.ts`, add:

```ts
const context = createCliContext(argv, { command: 'boss runtime inspect-pipeline' });
if (context.values.describe) {
  writeOutput(describeCommand(runtimeCommandDescriptions['inspect-pipeline']), context, () => JSON.stringify(runtimeCommandDescriptions['inspect-pipeline'], null, 2) + '\n');
  return 0;
}
```

For `inspect-plugins.ts`, add:

```ts
const context = createCliContext(argv, { command: 'boss runtime inspect-plugins' });
if (context.values.describe) {
  writeOutput(describeCommand(runtimeCommandDescriptions['inspect-plugins']), context, () => JSON.stringify(runtimeCommandDescriptions['inspect-plugins'], null, 2) + '\n');
  return 0;
}
```

For `inspect-progress.ts`, add:

```ts
const context = createCliContext(argv, { command: 'boss runtime inspect-progress' });
if (context.values.describe) {
  writeOutput(describeCommand(runtimeCommandDescriptions['inspect-progress']), context, () => JSON.stringify(runtimeCommandDescriptions['inspect-progress'], null, 2) + '\n');
  return 0;
}
```

For `replay-events.ts`, add:

```ts
const context = createCliContext(argv, { command: 'boss runtime replay-events' });
if (context.values.describe) {
  writeOutput(describeCommand(runtimeCommandDescriptions['replay-events']), context, () => JSON.stringify(runtimeCommandDescriptions['replay-events'], null, 2) + '\n');
  return 0;
}
```

For `query-memory.ts`, add:

```ts
const context = createCliContext(argv, { command: 'boss runtime query-memory' });
if (context.values.describe) {
  writeOutput(describeCommand(runtimeCommandDescriptions['query-memory']), context, () => JSON.stringify(runtimeCommandDescriptions['query-memory'], null, 2) + '\n');
  return 0;
}
```

For `build-memory-summary.ts`, add:

```ts
const context = createCliContext(argv, { command: 'boss runtime build-memory-summary' });
if (context.values.describe) {
  writeOutput(describeCommand(runtimeCommandDescriptions['build-memory-summary']), context, () => JSON.stringify(runtimeCommandDescriptions['build-memory-summary'], null, 2) + '\n');
  return 0;
}
```

For `render-diagnostics.ts`, add:

```ts
const context = createCliContext(argv, { command: 'boss runtime render-diagnostics' });
if (context.values.describe) {
  writeOutput(describeCommand(runtimeCommandDescriptions['render-diagnostics']), context, () => JSON.stringify(runtimeCommandDescriptions['render-diagnostics'], null, 2) + '\n');
  return 0;
}
```

Use these payload mappings:

```ts
// check-stage
const payload = parsed.summary
  ? checkStage(parsed.feature, parsed.stage, { cwd })
  : parsed.canProceed
    ? checkCanProceed(parsed.feature, parsed.stage, { cwd })
    : parsed.canRetry
      ? checkCanRetry(parsed.feature, parsed.stage, { cwd })
      : checkStage(parsed.feature, parsed.stage, { cwd });

// get-ready-artifacts --ready
const payload = { feature, readyArtifacts: readyList };

// inspect-pipeline
const payload = inspectPipeline(parsed.feature, { cwd });

// inspect-progress
const payload = inspectProgress(parsed.feature, { cwd, limit: parseLimit(String(parsed.limit || context.values.limit)) });

// inspect-plugins
const payload = inspectPlugins(parsed.feature, { cwd });

// query-memory
const payload = parsed.startup ? buildStartupSummary(...) : queryMemory(...);

// replay-events
const payload = parsed.at ? replaySnapshot(...) : replayEvents(...);

// generate-summary --stdout false
const payload = { feature: parsed.feature, path: outputPath, format: parsed.json ? 'json' : 'markdown' };

// render-diagnostics --stdout false
const payload = { feature: parsed.feature, path: outputPath, format: 'html' };

// build-memory-summary and extract-memory
const payload = existing JSON payload;
```

For commands that write files (`generate-summary`, `render-diagnostics`), support `--dry-run`:

```ts
if (context.values.dryRun && !parsed.stdout) {
  writeOutput({
    actions: [{ type: 'write_file', path: path.relative(cwd, outputPath), format }],
    risk_tier: 'medium',
    requires_approval: false
  }, context, () => `Would write ${path.relative(cwd, outputPath)}\n`);
  return 0;
}
```

- [x] **Step 6: Convert thrown missing feature errors to structured codes**

Wrap runtime call sites with:

```ts
try {
  // existing runtime call
} catch (err) {
  const message = err instanceof Error ? err.message : String(err);
  if (message.includes('未找到执行文件') || message.includes('未找到事件文件')) {
    throw new CliUserError({
      code: 'feature_not_found',
      message,
      input: { feature: parsed.feature },
      retryable: false,
      suggestion: 'Run boss runtime init-pipeline <feature> first'
    });
  }
  throw err;
}
```

- [x] **Step 7: Run read-only runtime tests**

Run:

```bash
npm run build
npm test -- test/runtime/runtime-cli-contract.test.ts test/runtime/inspect-runtime.test.ts test/runtime/report-runtime.test.ts
```

Expected:

```text
PASS
```

- [x] **Step 8: Commit read-only runtime migration**

```bash
git add packages/boss-cli/src/cli/command-registry.ts packages/boss-cli/src/runtime/cli/check-stage.ts packages/boss-cli/src/runtime/cli/generate-summary.ts packages/boss-cli/src/runtime/cli/get-ready-artifacts.ts packages/boss-cli/src/runtime/cli/inspect-events.ts packages/boss-cli/src/runtime/cli/inspect-pipeline.ts packages/boss-cli/src/runtime/cli/inspect-plugins.ts packages/boss-cli/src/runtime/cli/inspect-progress.ts packages/boss-cli/src/runtime/cli/query-memory.ts packages/boss-cli/src/runtime/cli/replay-events.ts packages/boss-cli/src/runtime/cli/render-diagnostics.ts packages/boss-cli/src/runtime/cli/build-memory-summary.ts packages/boss-cli/src/runtime/cli/extract-memory.ts test/runtime/runtime-cli-contract.test.ts
git commit -m "feat: make read only runtime commands agent friendly"
```

---

### Task 6: Migrate Mutating Runtime Commands, Dry-Run Plans, And JSON Input

**Files:**
- Modify mutating runtime commands:
  - `packages/boss-cli/src/runtime/cli/evaluate-gates.ts`
  - `packages/boss-cli/src/runtime/cli/init-pipeline.ts`
  - `packages/boss-cli/src/runtime/cli/record-artifact.ts`
  - `packages/boss-cli/src/runtime/cli/record-feedback.ts`
  - `packages/boss-cli/src/runtime/cli/register-plugins.ts`
  - `packages/boss-cli/src/runtime/cli/retry-agent.ts`
  - `packages/boss-cli/src/runtime/cli/retry-stage.ts`
  - `packages/boss-cli/src/runtime/cli/run-plugin-hook.ts`
  - `packages/boss-cli/src/runtime/cli/update-agent.ts`
  - `packages/boss-cli/src/runtime/cli/update-stage.ts`
- Modify tests:
  - `test/runtime/runtime-cli-contract.test.ts`
  - `test/runtime/stage-agent-runtime.test.ts`
  - `test/runtime/record-artifact.test.ts`
  - `test/runtime/feedback-retry-runtime.test.ts`
  - `test/runtime/plugin-hook-runtime.test.ts`
  - `test/runtime/evaluate-gates.test.ts`

- [x] **Step 1: Add mutating runtime contract tests**

Append to `test/runtime/runtime-cli-contract.test.ts`:

```ts
  it('mutating runtime commands support dry-run plans and json input', () => {
    initPipeline('test-feat', { cwd: tmpDir });

    const updateStage = runCli('update-stage', [
      '--json-input={"feature":"test-feat","stage":1,"status":"running"}',
      '--dry-run',
      '--json'
    ]);
    expect(updateStage.status).toBe(0);
    expect(JSON.parse(updateStage.stdout)).toEqual({
      actions: [
        expect.objectContaining({ type: 'update_stage', feature: 'test-feat', stage: 1, target_status: 'running' })
      ],
      risk_tier: 'medium',
      requires_approval: false
    });

    const retryStage = runCli('retry-stage', ['test-feat', '1', '--dry-run', '--json']);
    expect(retryStage.status).toBe(0);
    const retryPayload = JSON.parse(retryStage.stdout) as {
      actions: Array<{ type: string; feature: string; stage: number }>;
      requires_approval: boolean;
    };
    expect(retryPayload.actions[0]).toMatchObject({ type: 'retry_stage', feature: 'test-feat', stage: 1 });
  });

  it('mutating runtime commands require yes for non-interactive high risk retry execution', () => {
    initPipeline('test-feat', { cwd: tmpDir });

    const result = runCli('retry-stage', ['test-feat', '1', '--json']);
    expect(result.status).toBe(1);
    const payload = JSON.parse(result.stderr) as { error: { code: string } };
    expect(payload.error.code).toBe('confirmation_required');
  });
```

- [x] **Step 2: Run mutating runtime tests to verify red**

Run:

```bash
npm test -- test/runtime/runtime-cli-contract.test.ts test/runtime/stage-agent-runtime.test.ts
```

Expected:

```text
FAIL
```

- [x] **Step 3: Add shared input resolvers per command**

For each mutating runtime file, define an input interface and resolver.

For `update-stage.ts`:

```ts
interface UpdateStageInput {
  feature: string;
  stage: string;
  status: string;
  reason?: string;
  artifacts: string[];
  gate?: string;
  gatePassed?: boolean | null;
}

function resolveInput(argv: string[]): { context: CliContext; input: UpdateStageInput } {
  const context = createCliContext(argv, { command: 'boss runtime update-stage' });
  const jsonInput = readJsonInput(context.values.jsonInput) as Partial<UpdateStageInput> | null;
  if (jsonInput) {
    return {
      context,
      input: {
        feature: String(jsonInput.feature || ''),
        stage: String(jsonInput.stage || ''),
        status: String(jsonInput.status || ''),
        reason: typeof jsonInput.reason === 'string' ? jsonInput.reason : undefined,
        artifacts: Array.isArray(jsonInput.artifacts) ? jsonInput.artifacts.map(String) : [],
        gate: typeof jsonInput.gate === 'string' ? jsonInput.gate : undefined,
        gatePassed: typeof jsonInput.gatePassed === 'boolean' ? jsonInput.gatePassed : null
      }
    };
  }
  return { context, input: parseFlatUpdateStageArgs(context.positionals, argv) };
}
```

For `update-agent.ts`, `record-artifact.ts`, `record-feedback.ts`, `retry-agent.ts`, `retry-stage.ts`, `register-plugins.ts`, `run-plugin-hook.ts`, and `evaluate-gates.ts`, follow the same pattern with command-specific input names. Use exact JSON property names matching existing output fields: `feature`, `stage`, `agent`, `status`, `artifact`, `gate`, `hook`, `priority`, `reason`.

- [x] **Step 4: Add dry-run action plans**

Use these action payloads:

```ts
// init-pipeline
{ type: 'init_pipeline', feature, path: `.boss/${feature}/.meta/execution.json` }

// update-stage
{ type: 'update_stage', feature, stage: Number(stage), target_status: status, artifacts, gate, gatePassed }

// update-agent
{ type: 'update_agent', feature, stage: Number(stage), agent, target_status: status, reason }

// record-artifact
{ type: 'record_artifact', feature, artifact, stage: Number(stage) }

// record-feedback
{ type: 'record_feedback', feature, artifact, priority, reason }

// retry-stage
{ type: 'retry_stage', feature, stage: Number(stage) }

// retry-agent
{ type: 'retry_agent', feature, stage: Number(stage), agent }

// register-plugins
{ type: 'register_plugins', feature, plugin_count: result.plugins.length, plugin_names: result.plugins.map((plugin) => plugin.name) }

// run-plugin-hook
{ type: 'run_plugin_hook', feature, hook, stage }

// evaluate-gates
{ type: 'evaluate_gate', feature, gate: gateName, writes_event: !dryRun }
```

For each `--dry-run`, output:

```ts
writeOutput({
  actions,
  risk_tier: riskTier,
  requires_approval: riskTier === 'high'
}, context, () => actions.map((action) => `Would ${action.type}\n`).join(''));
return 0;
```

- [x] **Step 5: Require `--yes` for high-risk mutation execution**

Apply confirmation only to these execution paths when not `--dry-run`:

```ts
// retry-stage
assertConfirmed(context, 'retry_stage');

// retry-agent
assertConfirmed(context, 'retry_agent');

// project init --force already handled in Task 4
```

Do not require `--yes` for normal event recording and normal stage/agent status updates because existing hooks call them non-interactively.

- [x] **Step 6: Convert mutating runtime errors to structured errors**

Replace raw entrypoint catches with:

```ts
const context = createCliContext(process.argv.slice(2), { command: 'boss runtime update-stage' });
process.exit(await runMain(() => main(process.argv.slice(2), { cwd: process.cwd() }), context));
```

Use the same replacement shape for these entrypoints, changing only the literal `command` value to the exact command string shown here:

```ts
createCliContext(process.argv.slice(2), { command: 'boss runtime update-agent' });
createCliContext(process.argv.slice(2), { command: 'boss runtime record-artifact' });
createCliContext(process.argv.slice(2), { command: 'boss runtime record-feedback' });
createCliContext(process.argv.slice(2), { command: 'boss runtime retry-agent' });
createCliContext(process.argv.slice(2), { command: 'boss runtime retry-stage' });
createCliContext(process.argv.slice(2), { command: 'boss runtime register-plugins' });
createCliContext(process.argv.slice(2), { command: 'boss runtime run-plugin-hook' });
createCliContext(process.argv.slice(2), { command: 'boss runtime evaluate-gates' });
createCliContext(process.argv.slice(2), { command: 'boss runtime init-pipeline' });
createCliContext(process.argv.slice(2), { command: 'boss runtime extract-memory' });
createCliContext(process.argv.slice(2), { command: 'boss runtime generate-summary' });
```

Map missing feature and missing option values:

```ts
throw new CliUserError({
  code: 'missing_required_argument',
  message: 'Missing feature argument',
  input: { argument: 'feature' },
  retryable: false,
  suggestion: 'Run this command with --describe to see required parameters'
});
```

- [x] **Step 7: Run mutating runtime tests**

Run:

```bash
npm run build
npm test -- test/runtime/runtime-cli-contract.test.ts test/runtime/stage-agent-runtime.test.ts test/runtime/record-artifact.test.ts test/runtime/feedback-retry-runtime.test.ts test/runtime/plugin-hook-runtime.test.ts test/runtime/evaluate-gates.test.ts
```

Expected:

```text
PASS
```

- [x] **Step 8: Commit mutating runtime migration**

```bash
git add packages/boss-cli/src/runtime/cli/evaluate-gates.ts packages/boss-cli/src/runtime/cli/init-pipeline.ts packages/boss-cli/src/runtime/cli/record-artifact.ts packages/boss-cli/src/runtime/cli/record-feedback.ts packages/boss-cli/src/runtime/cli/register-plugins.ts packages/boss-cli/src/runtime/cli/retry-agent.ts packages/boss-cli/src/runtime/cli/retry-stage.ts packages/boss-cli/src/runtime/cli/run-plugin-hook.ts packages/boss-cli/src/runtime/cli/update-agent.ts packages/boss-cli/src/runtime/cli/update-stage.ts test/runtime/runtime-cli-contract.test.ts test/runtime/stage-agent-runtime.test.ts test/runtime/record-artifact.test.ts test/runtime/feedback-retry-runtime.test.ts test/runtime/plugin-hook-runtime.test.ts test/runtime/evaluate-gates.test.ts
git commit -m "feat: make mutating runtime commands agent friendly"
```

---

### Task 7: Add Architecture Guards For JSON, Errors, Help, And Unsafe Input

**Files:**
- Modify: `test/runtime/no-first-party-shell.test.ts`
- Create: `test/cli/agent-safety-contract.test.ts`
- Modify: `test/runtime/docs-contract.test.ts`

- [x] **Step 1: Add source architecture guard tests**

Create `test/cli/agent-safety-contract.test.ts`:

```ts
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
    const sourceFiles = walkFiles(path.join(REPO_ROOT, 'packages', 'boss-cli', 'src'))
      .filter((file) => file.endsWith('.ts'));

    for (const file of sourceFiles) {
      const source = fs.readFileSync(file, 'utf8');
      expect(source, path.relative(REPO_ROOT, file)).not.toContain('console.table');
      expect(source, path.relative(REPO_ROOT, file)).not.toMatch(/\x1b\[/);
      expect(source, path.relative(REPO_ROOT, file)).not.toContain('ora(');
    }
  });

  it('routes command entrypoint errors through cli contract helpers', () => {
    const cliFiles = [
      ...walkFiles(path.join(REPO_ROOT, 'packages', 'boss-cli', 'src', 'commands')),
      ...walkFiles(path.join(REPO_ROOT, 'packages', 'boss-cli', 'src', 'runtime', 'cli'))
    ].filter((file) => file.endsWith('.ts') && !file.includes(`${path.sep}lib${path.sep}`));

    for (const file of cliFiles) {
      const source = fs.readFileSync(file, 'utf8');
      expect(source, path.relative(REPO_ROOT, file)).toMatch(/createCliContext|runMain/);
      expect(source, path.relative(REPO_ROOT, file)).not.toMatch(/process\.stderr\.write\(`?\$\{\(err as Error\)\.message/);
    }
  });
});
```

- [x] **Step 2: Add docs contract for the eight rules**

Append to `test/runtime/docs-contract.test.ts`:

```ts
  it('documents the agent-friendly CLI contract', () => {
    expect(readme).toContain('--json');
    expect(readme).toContain('--describe');
    expect(readme).toContain('--dry-run');
    expect(readme).toContain('--json-input');
    expect(readme).toContain('--fields');
    expect(readme).toContain('--limit');
    expect(contributing).toContain('structured JSON');
    expect(contributing).toContain('non-interactive');
  });
```

- [x] **Step 3: Run safety tests to verify red**

Run:

```bash
npm test -- test/cli/agent-safety-contract.test.ts test/runtime/docs-contract.test.ts
```

Expected:

```text
FAIL
```

Any failures should identify command files that still use raw entrypoint error handling or missing documentation.

- [x] **Step 4: Fix remaining raw error handlers and docs**

For each failing CLI entrypoint file, replace:

```ts
try {
  process.exit(main(process.argv.slice(2), { cwd: process.cwd() }));
} catch (err) {
  process.stderr.write(`${(err as Error).message}\n`);
  process.exit(1);
}
```

with:

```ts
const context = createCliContext(process.argv.slice(2), { command: 'boss runtime update-stage' });
process.exit(await runMain(() => main(process.argv.slice(2), { cwd: process.cwd() }), context));
```

Apply that replacement to any remaining failing entrypoint from the verification scan, using the concrete runtime command name for the file: `update-agent`, `record-artifact`, `record-feedback`, `retry-agent`, `retry-stage`, `register-plugins`, `run-plugin-hook`, `evaluate-gates`, `init-pipeline`, `extract-memory`, `generate-summary`, `inspect-events`, `inspect-pipeline`, `inspect-plugins`, `inspect-progress`, `check-stage`, `get-ready-artifacts`, `replay-events`, `query-memory`, `build-memory-summary`, or `render-diagnostics`.

Update README and CONTRIBUTING with this concise section:

```md
### Agent-Friendly CLI Contract

Every `boss` command supports:

- `--json`: structured output; non-TTY stdout defaults to JSON
- `--describe`: JSON command schema
- `--dry-run`: structured action plan for writes or risky operations
- `--json-input=<json|- >`: JSON input payload
- `--fields=<a,b>` and `--limit=<n>`: bounded output
- `--yes`: required for destructive non-interactive execution

Structured errors are written to stderr as `{"error":{...}}` and include `code`, `message`, `input`, `retryable`, and `suggestion`.
```

- [x] **Step 5: Run safety tests to verify green**

Run:

```bash
npm test -- test/cli/agent-safety-contract.test.ts test/runtime/docs-contract.test.ts
```

Expected:

```text
PASS
```

- [x] **Step 6: Commit safety guards**

```bash
git add test/cli/agent-safety-contract.test.ts test/runtime/no-first-party-shell.test.ts test/runtime/docs-contract.test.ts README.md CONTRIBUTING.md packages/boss-cli/src
git commit -m "test: enforce agent friendly cli safety contract"
```

---

### Task 8: Update Help Text And Describe Metadata For Every Command

**Files:**
- Modify: `packages/boss-cli/src/cli/command-registry.ts`
- Modify every command file listed in File Map if help text still omits common flags.
- Modify: `test/runtime/runtime-cli-contract.test.ts`
- Modify: `test/bin/boss-skill.test.ts`

- [x] **Step 1: Add exhaustive help/describe tests**

Append to `test/runtime/runtime-cli-contract.test.ts`:

```ts
  it('all runtime command help is concise and lists agent contract flags', () => {
    for (const command of [
      'init-pipeline',
      'update-stage',
      'update-agent',
      'record-artifact',
      'get-ready-artifacts',
      'evaluate-gates',
      'check-stage',
      'replay-events',
      'inspect-progress',
      'inspect-pipeline',
      'inspect-events',
      'inspect-plugins',
      'render-diagnostics',
      'extract-memory',
      'query-memory',
      'build-memory-summary',
      'generate-summary',
      'register-plugins',
      'run-plugin-hook',
      'record-feedback',
      'retry-agent',
      'retry-stage'
    ]) {
      const help = runCli(command, ['--help']);
      expect(help.status, command).toBe(0);
      const text = help.stdout + help.stderr;
      expect(text).toContain('Usage:');
      expect(text).toContain('--json');
      expect(text).toContain('--describe');
      expect(text.split('\n').length).toBeLessThanOrEqual(28);

      const describe = runCli(command, ['--describe']);
      expect(describe.status, `${command} --describe`).toBe(0);
      const payload = JSON.parse(describe.stdout) as { command: string; risk_tier: string };
      expect(payload.command).toBe(`boss runtime ${command}`);
      expect(['low', 'medium', 'high']).toContain(payload.risk_tier);
    }
  });
```

- [x] **Step 2: Run help tests to verify red**

Run:

```bash
npm test -- test/runtime/runtime-cli-contract.test.ts test/bin/boss-skill.test.ts
```

Expected:

```text
FAIL
```

- [x] **Step 3: Normalize help text**

For every CLI command, replace long paragraphs and examples with this structure:

```ts
function showHelp(): void {
  process.stdout.write(renderHelp(description, 'boss runtime inspect-events FEATURE [options]'));
}
```

For command-specific options, extend the rendered help with a stable extra section:

```ts
const extraOptions = [
  'Command Options:',
  '  --stage <number>     Stage number',
  '  --type TYPE          Filter by event or plugin type',
  ''
].join('\n');
process.stdout.write(`${renderHelp(description, usage)}${extraOptions}`);
```

Keep every help output under 28 lines.

- [x] **Step 4: Fill command registry metadata**

Replace generic runtime metadata from Task 5 with explicit entries. Example:

```ts
export const runtimeCommandDescriptions: Record<string, CommandDescription> = {
  'update-stage': {
    command: 'boss runtime update-stage',
    summary: 'Update stage status and optionally record artifacts or gate result',
    parameters: [
      { name: 'feature', type: 'string', required: true },
      { name: 'stage', type: 'number', required: true },
      { name: 'status', type: 'string', required: true, enum: ['running', 'completed', 'failed', 'retrying', 'skipped'] }
    ],
    options: [
      { name: 'reason', type: 'string' },
      { name: 'artifact', type: 'array' },
      { name: 'gate', type: 'string' },
      { name: 'gate-passed', type: 'boolean', default: false },
      { name: 'gate-failed', type: 'boolean', default: false },
      { name: 'json', type: 'boolean', default: false },
      { name: 'describe', type: 'boolean', default: false },
      { name: 'json-input', type: 'string' },
      { name: 'dry-run', type: 'boolean', default: false },
      { name: 'fields', type: 'string' },
      { name: 'limit', type: 'string', default: '100' }
    ],
    risk_tier: 'medium'
  }
};
```

Provide explicit descriptions for all runtime command names listed in Task 1.

- [x] **Step 5: Run help and describe tests**

Run:

```bash
npm run build
npm test -- test/runtime/runtime-cli-contract.test.ts test/bin/boss-skill.test.ts
```

Expected:

```text
PASS
```

- [x] **Step 6: Commit help and describe metadata**

```bash
git add packages/boss-cli/src/cli/command-registry.ts packages/boss-cli/src/bin/boss.ts packages/boss-cli/src/commands packages/boss-cli/src/runtime/cli test/runtime/runtime-cli-contract.test.ts test/bin/boss-skill.test.ts
git commit -m "docs: stabilize boss cli help and describe output"
```

---

### Task 9: Full Verification And Package Dry Run

**Files:**
- No source edits expected unless verification exposes a concrete bug.

- [x] **Step 1: Run build**

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

- [x] **Step 2: Run typecheck**

Run:

```bash
npm run typecheck
```

Expected:

```text
> @blade-ai/boss-skill@3.7.1 typecheck
```

Exit code must be 0.

- [x] **Step 3: Run full test suite**

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

- [x] **Step 4: Run CLI contract smoke commands**

Run:

```bash
node packages/boss-cli/dist/bin/boss.js --describe
node packages/boss-cli/dist/bin/boss.js packs detect . --json --fields=detected
node packages/boss-cli/dist/bin/boss.js project init --json-input='{"feature":"smoke-agent-cli"}' --dry-run --json
node packages/boss-cli/dist/bin/boss.js runtime update-stage smoke 1 running --bad-flag
```

Expected:

```text
```

The first three commands exit 0 and print parseable JSON on stdout. The fourth exits 1 and prints parseable JSON on stderr with `error.code` equal to `unknown_option`.

- [x] **Step 5: Run package dry run**

Run:

```bash
npm pack --dry-run
```

Expected:

```text
npm notice
```

Package contents must include:

```text
packages/boss-cli/dist/bin/boss.js
packages/boss-cli/dist/cli/contract.js
packages/boss-cli/dist/cli/command-registry.js
packages/boss-cli/assets/artifact-dag.json
packages/boss-cli/assets/pipeline-packs/default/pipeline.json
packages/boss-cli/assets/plugins/security-audit/plugin.json
```

- [x] **Step 6: Run source scans**

Run:

```bash
rg -n "console\\.table|ora\\(|chalk|\\x1b\\[" packages/boss-cli/src
rg -n "process\\.stderr\\.write\\(`?\\$\\{\\(err as Error\\)\\.message|console\\.error\\(" packages/boss-cli/src
rg -n "Are you sure|\\(y/n\\)|readline" packages/boss-cli/src
```

Expected:

```text
stdout JSON parse succeeds for every --json command
stderr JSON parse succeeds for every failing --json command
no console.table, ora, chalk, ANSI escape, readline, or y/n prompt references remain
No matches in `packages/boss-cli/src`.
```

- [x] **Step 7: Commit verification fixes if needed**

If verification required source, docs, or test fixes:

```bash
git status --short
git add packages/boss-cli/src test README.md CONTRIBUTING.md DESIGN.md skill docs/superpowers/plans/2026-05-05-boss-cli-agent-friendly-contract.md
git commit -m "fix: complete agent friendly cli contract"
```

If no fixes were needed, do not create an empty commit.

---

## Self-Review Notes

- Rule 1 coverage: Tasks 1, 2, 3, 4, 5, 6, 8 verify `--json` and non-TTY JSON output.
- Rule 2 coverage: Tasks 4 and 6 enforce `--yes` for destructive non-interactive execution.
- Rule 3 coverage: Tasks 4, 5, and 6 add structured `--dry-run` action plans.
- Rule 4 coverage: Tasks 2, 4, and 5 add `--fields` and `--limit`.
- Rule 5 coverage: Tasks 2, 3, 5, 6, and 7 add structured errors and exit code semantics.
- Rule 6 coverage: Tasks 1 and 8 stabilize `--help` and add `--describe`.
- Rule 7 coverage: Tasks 4 and 6 add `--json-input` for multi-field commands.
- Rule 8 coverage: Tasks 2, 4, and 7 add safe path validation and source guards.
