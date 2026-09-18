# Knowledge Layer Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a separate long-term knowledge layer with project/global scope, background LLM extraction, queue inspection, and query/summarize commands.

**Architecture:** Keep the existing execution memory subsystem intact. Add a new `runtime/knowledge` subsystem for durable knowledge records, append-only job tracking, LLM-backed extraction, and ranking/summarization. Runtime transitions should enqueue work and return immediately; a detached worker command processes jobs in the background and writes project/global knowledge stores.

**Tech Stack:** TypeScript, native ESM, Node `fs`/`path`/`child_process`, JSON/JSONL files, current Boss CLI contract helpers, Vitest.

---

## File Map

Create:

- `packages/boss-cli/src/runtime/schema/knowledge-record-schema.json`
- `packages/boss-cli/src/runtime/schema/knowledge-job-schema.json`
- `packages/boss-cli/src/runtime/schema/knowledge-summary-schema.json`
- `packages/boss-cli/src/runtime/knowledge/store.ts`
- `packages/boss-cli/src/runtime/knowledge/jobs.ts`
- `packages/boss-cli/src/runtime/knowledge/client.ts`
- `packages/boss-cli/src/runtime/knowledge/extractor.ts`
- `packages/boss-cli/src/runtime/knowledge/query.ts`
- `packages/boss-cli/src/runtime/knowledge/summarizer.ts`
- `packages/boss-cli/src/runtime/knowledge/promote.ts`
- `packages/boss-cli/src/runtime/knowledge/collector.ts`
- `packages/boss-cli/src/runtime/application/knowledge.ts`
- `packages/boss-cli/src/commands/runtime/enqueue-knowledge.ts`
- `packages/boss-cli/src/commands/runtime/process-knowledge-jobs.ts`
- `packages/boss-cli/src/commands/runtime/inspect-knowledge-jobs.ts`
- `packages/boss-cli/src/commands/runtime/build-knowledge-summary.ts`
- `packages/boss-cli/src/commands/runtime/query-knowledge.ts`
- `packages/boss-cli/src/commands/runtime/rebuild-global-knowledge.ts`

Modify:

- `packages/boss-cli/src/runtime/application/state.ts`
- `packages/boss-cli/src/runtime/application/inspection.ts`
- `packages/boss-cli/src/cli/registry.ts`
- `packages/boss-cli/src/cli/dispatcher.ts`
- `packages/boss-cli/src/commands/runtime/inspect-pipeline.ts`
- `test/runtime/memory-runtime.integration.test.ts`
- `test/runtime/runtime-cli-contract.test.ts`
- add new knowledge-focused tests under `test/runtime/` and `test/cli/`

---

### Task 1: Add knowledge record storage and schema

**Files:**
- Create: `packages/boss-cli/src/runtime/schema/knowledge-record-schema.json`
- Create: `packages/boss-cli/src/runtime/schema/knowledge-job-schema.json`
- Create: `packages/boss-cli/src/runtime/schema/knowledge-summary-schema.json`
- Create: `packages/boss-cli/src/runtime/knowledge/store.ts`
- Create: `test/runtime/knowledge-store.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
import { expect, it } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {
  mergeKnowledgeRecords,
  readProjectKnowledge,
  saveProjectKnowledge
} from '../../packages/boss-cli/src/runtime/knowledge/store.js';

it('persists and merges project knowledge', () => {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'boss-knowledge-'));
  const payload = saveProjectKnowledge('feat-a', [
    {
      id: 'k1',
      scope: 'project',
      kind: 'preference',
      category: 'user_preference',
      subject: 'user',
      summary: 'Prefer automatic extraction',
      source: { type: 'dialogue', ref: 'turn-12' },
      evidence: [{ type: 'dialogue', ref: 'turn-12' }],
      confidence: 0.92,
      createdAt: '2026-05-10T00:00:00Z',
      lastSeenAt: '2026-05-10T00:00:00Z',
      expiresAt: null,
      decayScore: 8
    }
  ], { cwd: tmpDir });

  expect(payload.records).toHaveLength(1);
  expect(readProjectKnowledge('feat-a', { cwd: tmpDir }).records[0]?.summary).toBe('Prefer automatic extraction');

  const merged = mergeKnowledgeRecords(payload.records, [
    {
      ...payload.records[0]!,
      id: 'k2',
      summary: 'Prefer automatic extraction in the background',
      evidence: [{ type: 'runtime-event', ref: '18' }],
      confidence: 0.97,
      lastSeenAt: '2026-05-10T00:05:00Z'
    }
  ]);

  expect(merged).toHaveLength(1);
  expect(merged[0]?.summary).toBe('Prefer automatic extraction in the background');
  expect(merged[0]?.evidence).toHaveLength(2);
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `vitest run test/runtime/knowledge-store.test.ts -t "persists and merges project knowledge"`
Expected: fail because `saveProjectKnowledge` and the schema-backed store do not exist yet.

- [ ] **Step 3: Write the minimal store**

```ts
export interface KnowledgeRecord {
  id: string;
  scope: 'project' | 'global';
  kind: 'preference' | 'fact' | 'decision' | 'lesson';
  category: string;
  subject: string;
  summary: string;
  source: { type: string; ref?: string; [key: string]: unknown };
  evidence: Array<{ type: string; ref: string; [key: string]: unknown }>;
  confidence: number;
  createdAt: string;
  lastSeenAt: string;
  expiresAt: string | null;
  decayScore: number;
}

function projectKnowledgePath(cwd: string, feature: string): string {
  return path.join(cwd, '.boss', feature, '.meta', 'project-knowledge.json');
}

function recordKey(record: KnowledgeRecord): string {
  return [record.scope, record.kind, record.category, record.subject].join(':').toLowerCase();
}

function cloneRecord(record: KnowledgeRecord): KnowledgeRecord {
  return { ...record, evidence: [...record.evidence] };
}

function readJson<T>(filePath: string, fallback: T): T {
  if (!fs.existsSync(filePath)) return fallback;
  return JSON.parse(fs.readFileSync(filePath, 'utf8')) as T;
}

function writeJson(filePath: string, value: unknown): void {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, JSON.stringify(value, null, 2) + '\n', 'utf8');
}

export function mergeKnowledgeRecords(existing: KnowledgeRecord[], incoming: KnowledgeRecord[]): KnowledgeRecord[] {
  const merged = new Map(existing.map((record) => [recordKey(record), cloneRecord(record)]));
  for (const record of incoming) {
    const key = recordKey(record);
    if (!merged.has(key)) {
      merged.set(key, cloneRecord(record));
      continue;
    }
    const current = merged.get(key)!;
    merged.set(key, {
      ...current,
      summary: record.summary,
      confidence: Math.max(current.confidence, record.confidence),
      lastSeenAt: record.lastSeenAt,
      decayScore: Math.max(current.decayScore, record.decayScore),
      evidence: [...current.evidence, ...record.evidence]
    });
  }
  return [...merged.values()];
}

export function saveProjectKnowledge(feature: string, records: KnowledgeRecord[], opts?: { cwd?: string }): { feature: string; records: KnowledgeRecord[] } {
  const cwd = opts?.cwd ?? process.cwd();
  const filePath = projectKnowledgePath(cwd, feature);
  const current = readJson(filePath, { feature, records: [] });
  const next = { feature, records: mergeKnowledgeRecords(current.records, records) };
  writeJson(filePath, next);
  return next;
}
```

Implement the same pattern for global knowledge paths under `.boss/.knowledge/`.

- [ ] **Step 4: Run the test to verify it passes**

Run: `vitest run test/runtime/knowledge-store.test.ts`
Expected: pass, and the new JSON schema files should validate the shape used by the store.

- [ ] **Step 5: Commit**

```bash
git add packages/boss-cli/src/runtime/schema/knowledge-*.json packages/boss-cli/src/runtime/knowledge/store.ts test/runtime/knowledge-store.test.ts
git commit -m "feat: add knowledge storage primitives"
```

---

### Task 2: Add the append-only job queue and detached LLM worker

**Files:**
- Create: `packages/boss-cli/src/runtime/knowledge/jobs.ts`
- Create: `packages/boss-cli/src/runtime/knowledge/client.ts`
- Create: `packages/boss-cli/src/runtime/knowledge/extractor.ts`
- Create: `packages/boss-cli/src/runtime/knowledge/promote.ts`
- Create: `packages/boss-cli/src/runtime/application/knowledge.ts`
- Modify: `packages/boss-cli/src/runtime/application/state.ts`
- Create: `test/runtime/knowledge-worker.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
import { describe, expect, it, vi } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { enqueueKnowledgeJob, processKnowledgeJobs } from '../../packages/boss-cli/src/runtime/knowledge/jobs.js';

it('queues a knowledge job and processes it with a fake LLM client', async () => {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'boss-knowledge-job-'));
  const job = enqueueKnowledgeJob('feat-a', {
    sources: [{ type: 'runtime-event', ref: '17' }]
  }, { cwd: tmpDir });

  const result = await processKnowledgeJobs('feat-a', {
    cwd: tmpDir,
    client: {
      extract: vi.fn(async () => ({
        records: [
          {
            id: 'k1',
            scope: 'project',
            kind: 'decision',
            category: 'workflow_decision',
            subject: 'feature',
            summary: 'Use background LLM extraction',
            source: { type: 'runtime-event', ref: '17' },
            evidence: [{ type: 'runtime-event', ref: '17' }],
            confidence: 0.95,
            createdAt: '2026-05-10T00:00:00Z',
            lastSeenAt: '2026-05-10T00:00:00Z',
            expiresAt: null,
            decayScore: 9
          }
        ]
      }))
    }
  });

  expect(job.status).toBe('pending');
  expect(result.processed).toBe(1);
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `vitest run test/runtime/knowledge-worker.test.ts -t "queues a knowledge job and processes it"`
Expected: fail because the queue, worker, and client abstraction do not exist yet.

- [ ] **Step 3: Write the minimal queue and worker**

```ts
export interface KnowledgeJob {
  id: string;
  feature: string;
  scope: 'project' | 'global';
  status: 'pending' | 'processing' | 'succeeded' | 'failed';
  payload: {
    sources: Array<{ type: string; ref?: string; [key: string]: unknown }>;
    summary?: unknown;
  };
  attempts: number;
  createdAt: string;
  updatedAt: string;
  error?: string;
}

export interface KnowledgeLlmClient {
  extract(input: KnowledgeJob['payload']): Promise<{ records: KnowledgeRecord[] }>;
}

export function enqueueKnowledgeJob(feature: string, payload: KnowledgeJob['payload'], opts?: { cwd?: string }): KnowledgeJob;
export async function processKnowledgeJobs(feature: string, opts?: { cwd?: string; client?: KnowledgeLlmClient }): Promise<{ processed: number; failed: number }>;
```

Implement the queue as append-only JSONL so job inspection can replay history. The worker should:

- read pending job records
- call the injected LLM client
- validate the returned JSON
- merge new project records
- optionally promote stable records into global knowledge
- append succeeded/failed status records back into the same job log

Use a detached `spawn` in `packages/boss-cli/src/runtime/application/knowledge.ts` so `state.ts` can enqueue work and immediately return:

```ts
const child = spawn(process.execPath, [binPath, 'runtime', 'process-knowledge-jobs', feature], {
  cwd,
  detached: true,
  stdio: 'ignore'
});
child.unref();
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `vitest run test/runtime/knowledge-worker.test.ts`
Expected: pass, including the invalid-output rejection case for the LLM client.

- [ ] **Step 5: Commit**

```bash
git add packages/boss-cli/src/runtime/knowledge/{jobs.ts,client.ts,extractor.ts,promote.ts} packages/boss-cli/src/runtime/application/{knowledge.ts,state.ts} test/runtime/knowledge-worker.test.ts
git commit -m "feat: add background knowledge worker"
```

---

### Task 3: Add knowledge query, summarization, and promotion views

**Files:**
- Create: `packages/boss-cli/src/runtime/knowledge/query.ts`
- Create: `packages/boss-cli/src/runtime/knowledge/summarizer.ts`
- Modify: `packages/boss-cli/src/runtime/application/inspection.ts`
- Modify: `packages/boss-cli/src/commands/runtime/inspect-pipeline.ts`
- Create: `test/runtime/knowledge-query.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
import { describe, expect, it } from 'vitest';
import { buildKnowledgeSummary, queryKnowledgeSection } from '../../packages/boss-cli/src/runtime/knowledge/query.js';

it('prefers project knowledge before global knowledge for the same agent', () => {
  const result = queryKnowledgeSection([
    {
      category: 'user_preference',
      summary: 'Prefer automatic extraction',
      scope: 'project',
      agent: 'boss-backend',
      stage: 3,
      confidence: 0.95,
      decayScore: 8
    },
    {
      category: 'workflow_decision',
      summary: 'Use background LLM extraction',
      scope: 'global',
      agent: 'boss-backend',
      stage: 3,
      confidence: 0.8,
      decayScore: 7
    }
  ], { agent: 'boss-backend', stage: 3, limit: 2 });

  expect(result[0]?.summary).toBe('Prefer automatic extraction');
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `vitest run test/runtime/knowledge-query.test.ts -t "prefers project knowledge before global knowledge"`
Expected: fail because the query ranking and summary helpers do not exist yet.

- [ ] **Step 3: Write the minimal query and summary logic**

```ts
export interface KnowledgeQueryRecord {
  category: string;
  summary: string;
  scope?: 'project' | 'global';
  agent?: string | null;
  stage?: number | null;
  confidence?: number;
  decayScore?: number;
  lastSeenAt?: string;
}

export interface KnowledgeSummaryEntry {
  category: string;
  summary: string;
  scope?: 'project' | 'global';
}

export interface KnowledgeSummary {
  generatedAt: string | null;
  startupSummary: KnowledgeSummaryEntry[];
  agentSections: Record<string, KnowledgeSummaryEntry[]>;
}

function score(record: KnowledgeQueryRecord, target: { agent?: string; stage?: number }): number {
  let value = record.scope === 'project' ? 10000 : 0;
  if (record.agent && record.agent === target.agent) value += 1000;
  if (record.stage != null && target.stage != null && record.stage === target.stage) value += 100;
  value += (record.decayScore ?? 0) * 10;
  value += (record.confidence ?? 0);
  return value;
}

export function queryKnowledgeRecords(records: KnowledgeQueryRecord[], opts: { agent?: string; stage?: number; limit?: number }): KnowledgeQueryRecord[] {
  return records
    .filter((record) => record.agent == null || record.agent === opts.agent)
    .filter((record) => record.stage == null || opts.stage == null || record.stage === opts.stage)
    .sort((left, right) => score(right, opts) - score(left, opts))
    .slice(0, opts.limit ?? 3);
}

export function queryKnowledgeSection(records: KnowledgeQueryRecord[], opts: { agent?: string; stage?: number; limit?: number }): KnowledgeSummaryEntry[] {
  return queryKnowledgeRecords(records, opts).map((record) => ({ category: record.category, summary: record.summary, scope: record.scope }));
}

export function buildKnowledgeSummary(records: KnowledgeQueryRecord[]): KnowledgeSummary {
  return {
    generatedAt: new Date().toISOString(),
    startupSummary: queryKnowledgeSection(records, { limit: 3 }),
    agentSections: {}
  };
}
```

Promotion should be conservative:

- only promote records seen more than once
- only promote records that are not tied to a single transient stage failure
- preserve evidence references
- never overwrite project records in place

Surface the new summary through `inspection.ts` so `inspect-pipeline` can render a knowledge startup line next to the existing memory line:

```ts
lines.push(`knowledgeStartup: ${((summary.knowledge && summary.knowledge.startupSummary) || []).map((item) => item.summary).join(' | ') || 'none'}`);
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `vitest run test/runtime/knowledge-query.test.ts`
Expected: pass, and `inspect-pipeline` should render knowledge output without breaking the current memory line.

- [ ] **Step 5: Commit**

```bash
git add packages/boss-cli/src/runtime/knowledge/{query.ts,summarizer.ts} packages/boss-cli/src/runtime/application/inspection.ts packages/boss-cli/src/commands/runtime/inspect-pipeline.ts test/runtime/knowledge-query.test.ts
git commit -m "feat: add knowledge query and summary views"
```

---

### Task 4: Add CLI commands and registry entries

**Files:**
- Create: `packages/boss-cli/src/commands/runtime/enqueue-knowledge.ts`
- Create: `packages/boss-cli/src/commands/runtime/process-knowledge-jobs.ts`
- Create: `packages/boss-cli/src/commands/runtime/inspect-knowledge-jobs.ts`
- Create: `packages/boss-cli/src/commands/runtime/build-knowledge-summary.ts`
- Create: `packages/boss-cli/src/commands/runtime/query-knowledge.ts`
- Create: `packages/boss-cli/src/commands/runtime/rebuild-global-knowledge.ts`
- Modify: `packages/boss-cli/src/cli/registry.ts`
- Modify: `packages/boss-cli/src/cli/dispatcher.ts`
- Create: `test/runtime/runtime-knowledge-cli-contract.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
import { describe, expect, it } from 'vitest';
import { main as queryKnowledgeMain } from '../../packages/boss-cli/src/commands/runtime/query-knowledge.js';

it('describes the new knowledge commands and routes query-knowledge', () => {
  const code = queryKnowledgeMain(['feat-a', '--agent', 'boss-backend', '--stage', '3']);
  expect(code).toBe(0);
});
```

Also add a contract assertion that `boss runtime --describe` now lists:

- `enqueue-knowledge`
- `process-knowledge-jobs`
- `inspect-knowledge-jobs`
- `build-knowledge-summary`
- `query-knowledge`
- `rebuild-global-knowledge`

- [ ] **Step 2: Run the test to verify it fails**

Run: `vitest run test/runtime/runtime-knowledge-cli-contract.test.ts`
Expected: fail because the commands are not registered yet.

- [ ] **Step 3: Write the minimal command wrappers**

Each command should follow the existing runtime command pattern:

```ts
export function main(argv: string[] = process.argv.slice(2), { cwd = process.cwd() }: { cwd?: string } = {}): number {
  const context = createCliContext(argv, { command: 'boss runtime query-knowledge' });
  if (context.values.describe) {
    writeOutput(describeCommand(runtimeCommandDescriptions['query-knowledge']!), context, () => `${JSON.stringify(runtimeCommandDescriptions['query-knowledge'], null, 2)}\n`);
    return 0;
  }
  const feature = context.positionals[0];
  const agentIndex = argv.indexOf('--agent');
  const stageIndex = argv.indexOf('--stage');
  const agent = agentIndex >= 0 ? argv[agentIndex + 1] : undefined;
  const stage = stageIndex >= 0 ? Number(argv[stageIndex + 1]) : undefined;
  if (!feature) {
    printRuntimeHelp('query-knowledge', 'boss runtime query-knowledge FEATURE [options]');
    return 1;
  }

  const records = queryKnowledgeRecords(feature, {
    cwd,
    agent,
    stage,
    limit: parseLimit(context.values.limit)
  });

  writeOutput(
    { feature, records },
    context,
    () => records.map((item) => `- [${item.category}] ${item.summary}`).join('\n') + '\n'
  );
  return 0;
}
```

Update `runtimeCommandNames` and `runtimeCommands` in `cli/registry.ts` and `cli/dispatcher.ts` together so help output and dispatch stay in sync.
Add `agent` and `stage` options to the `query-knowledge` command description so `--describe` output matches the parser:

```ts
options: [
  ...runtimeFieldOptions,
  { name: 'agent', type: 'string' as const },
  { name: 'stage', type: 'string' as const },
  { name: 'startup', type: 'boolean' as const, default: false }
]
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `vitest run test/runtime/runtime-knowledge-cli-contract.test.ts`
Expected: pass, and `boss runtime --describe` should show the new command family.

- [ ] **Step 5: Commit**

```bash
git add packages/boss-cli/src/cli/{registry.ts,dispatcher.ts} packages/boss-cli/src/commands/runtime/{enqueue-knowledge.ts,process-knowledge-jobs.ts,inspect-knowledge-jobs.ts,build-knowledge-summary.ts,query-knowledge.ts,rebuild-global-knowledge.ts} test/runtime/runtime-knowledge-cli-contract.test.ts
git commit -m "feat: add knowledge CLI surface"
```

---

### Task 5: Wire runtime enqueueing and finish the integration tests

**Files:**
- Create: `packages/boss-cli/src/runtime/knowledge/collector.ts`
- Modify: `packages/boss-cli/src/runtime/application/state.ts`
- Modify: `packages/boss-cli/src/runtime/application/inspection.ts`
- Create: `test/runtime/knowledge-runtime.integration.test.ts`
- Update: `test/runtime/memory-runtime.integration.test.ts`

- [ ] **Step 1: Write the failing integration test**

```ts
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

it('enqueues knowledge refresh when runtime memory refreshes', async () => {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'boss-knowledge-runtime-'));
  const spawn = vi.fn(() => ({ unref: vi.fn() }));
  vi.doMock('node:child_process', () => ({ spawn }));

  const state = await import('../../packages/boss-cli/src/runtime/application/state.js');
  state.refreshMemory('feat-a', tmpDir);

  expect(spawn).toHaveBeenCalled();
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `vitest run test/runtime/knowledge-runtime.integration.test.ts`
Expected: fail because `refreshMemory` does not yet enqueue or kick off the background worker.

- [ ] **Step 3: Wire the runtime entry point**

Extend `refreshMemory(feature, cwd)` so it keeps the existing execution-memory rebuild and then calls a new `refreshKnowledge(feature, cwd)` helper that:

- collects runtime events, stage/progress data, artifact summaries, and optional prompt/dialogue logs
- appends a knowledge job
- starts the detached worker process
- swallows worker-launch errors so runtime continues

Suggested shape:

```ts
export function refreshKnowledge(feature: string, cwd: string): void {
  try {
    enqueueKnowledgeJob(feature, collectKnowledgeInputs(feature, cwd), { cwd });
    startKnowledgeWorker(feature, { cwd });
  } catch (err) {
    process.stderr.write(`[boss-skill] knowledge refresh skipped: ${(err as Error).message}\n`);
  }
}
```

For prompt/dialogue coverage, make the collector read any existing `.boss/<feature>/.meta/prompt-log.jsonl` and `.boss/<feature>/.meta/dialogue-log.jsonl` files if they exist, alongside the current runtime event log and progress/notification traces.

- [ ] **Step 4: Run the test to verify it passes**

Run: `vitest run test/runtime/memory-runtime.integration.test.ts test/runtime/knowledge-runtime.integration.test.ts`
Expected: pass, with the mocked detached worker invoked and the existing memory flow still intact.

- [ ] **Step 5: Commit**

```bash
git add packages/boss-cli/src/runtime/application/{state.ts,inspection.ts} packages/boss-cli/src/runtime/knowledge/collector.ts test/runtime/{memory-runtime.integration.test.ts,knowledge-runtime.integration.test.ts}
git commit -m "feat: wire knowledge refresh into runtime"
```

---

### Task 6: Run the full verification sweep

**Files:**
- No new files
- Potentially update any tests that fail because of the new command family or summary output

- [ ] **Step 1: Run the focused knowledge test set**

Run:

```bash
vitest run test/runtime/knowledge-store.test.ts \
  test/runtime/knowledge-worker.test.ts \
  test/runtime/knowledge-query.test.ts \
  test/runtime/runtime-knowledge-cli-contract.test.ts \
  test/runtime/knowledge-runtime.integration.test.ts
```

Expected: all pass.

- [ ] **Step 2: Run the existing runtime regressions**

Run:

```bash
vitest run test/runtime/memory-runtime.integration.test.ts test/runtime/runtime-cli-contract.test.ts
```

Expected: the old memory and CLI surfaces still pass, and the new knowledge logic does not break runtime help or dispatch.

- [ ] **Step 3: Run the package-level checks**

Run:

```bash
npm run typecheck
npm test
npm run build
```

Expected: all pass with the new knowledge files included in the build output.

- [ ] **Step 4: Verify the pack shape**

Run:

```bash
npm pack --dry-run
```

Expected: the package still includes `packages/boss-cli/assets/`, `packages/boss-cli/src/runtime/schema/`, and the compiled CLI output that now includes the knowledge commands.

- [ ] **Step 5: Commit**

```bash
git add .
git commit -m "feat: ship background knowledge layer"
```

---

## Coverage Check

This plan covers:

- project knowledge and global knowledge stores
- automatic LLM-based extraction
- background processing without blocking the main runtime
- runtime-event and prompt/dialogue input collection
- query and startup-summary behavior
- command surface and dispatcher registration
- regression coverage for the existing memory path
