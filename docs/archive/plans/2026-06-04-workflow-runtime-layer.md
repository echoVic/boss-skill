# Workflow Runtime Layer Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a persisted workflow plan layer that compiles pipeline packs and artifact DAGs into a deterministic, resumable execution graph.

**Architecture:** Introduce a focused workflow application module that converts the selected pack plus artifact DAG into `.boss/<feature>/.meta/workflow-plan.json`, validates graph determinism, stores workflow definition metadata separately from `runId`, and exposes resume decisions through `boss runtime resume`. Existing event sourcing remains the source of truth; projection learns the new workflow metadata.

**Tech Stack:** TypeScript, Node.js fs/path/crypto, existing Boss runtime CLI contract, Vitest.

---

### Task 1: Workflow Plan Contract Tests

**Files:**
- Test: `test/runtime/workflow-runtime.test.ts`
- Modify later: `packages/boss-cli/src/runtime/application/workflow.ts`
- Modify later: `packages/boss-cli/src/runtime/application/pipeline.ts`

- [ ] **Step 1: Write the failing test**

```ts
it('initializes a deterministic workflow plan file and separates definition metadata from run metadata', () => {
  const state = runtime.initPipeline('workflow-feat', { cwd: tmpDir });
  const planPath = path.join(tmpDir, '.boss', 'workflow-feat', '.meta', 'workflow-plan.json');
  const plan = JSON.parse(fs.readFileSync(planPath, 'utf8')) as { nodes: unknown[] };
  expect(plan.nodes.length).toBeGreaterThan(0);
  expect(state.parameters.workflowPlanPath).toBe('.boss/workflow-feat/.meta/workflow-plan.json');
  expect(state.parameters.workflowHash).toMatch(/^[a-f0-9]{64}$/);
  expect(state.parameters.packHash).toMatch(/^[a-f0-9]{64}$/);
  expect(state.parameters.artifactDagHash).toMatch(/^[a-f0-9]{64}$/);
  expect(state.parameters.runId).toMatch(/^[a-f0-9]{64}$/);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- test/runtime/workflow-runtime.test.ts`

Expected: FAIL because `workflow-runtime.test.ts` or `workflowPlanPath` behavior does not exist.

- [ ] **Step 3: Write minimal implementation**

Create `compileWorkflowPlan`, `writeWorkflowPlan`, and call it from `initPipeline`.

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- test/runtime/workflow-runtime.test.ts`

Expected: PASS for the new initialization test.

### Task 2: Workflow Validation Tests

**Files:**
- Test: `test/runtime/workflow-runtime.test.ts`
- Modify later: `packages/boss-cli/src/runtime/application/workflow.ts`

- [ ] **Step 1: Write the failing test**

```ts
it('rejects artifact DAG nodes with undeclared inputs or dynamic scripts', () => {
  const dag = { version: '1.0.0', artifacts: { output: { inputs: ['missing'], agent: 'boss-pm', stage: 1 } } };
  expect(() => workflow.compileWorkflowPlan({ feature: 'x', pack, artifactDag: dag, cwd: tmpDir }))
    .toThrow(/undeclared input/i);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- test/runtime/workflow-runtime.test.ts`

Expected: FAIL because workflow validation does not exist.

- [ ] **Step 3: Write minimal implementation**

Validate every input references a defined artifact or known virtual input, every non-gate node has an artifact or agent binding, and `script` fields do not contain `Date.now`, `new Date`, `Math.random`, or shell command substitution markers.

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- test/runtime/workflow-runtime.test.ts`

Expected: PASS.

### Task 3: Resume Runtime Tests

**Files:**
- Test: `test/runtime/workflow-runtime.test.ts`
- Create later: `packages/boss-cli/src/commands/runtime/resume.ts`
- Modify later: `packages/boss-cli/src/runtime/application/workflow.ts`
- Modify later: `packages/boss-cli/src/cli/dispatcher.ts`
- Modify later: `packages/boss-cli/src/cli/registry.ts`

- [ ] **Step 1: Write the failing test**

```ts
it('exposes boss runtime resume with node-level reuse decisions', () => {
  runtime.initPipeline('workflow-feat', { cwd: tmpDir });
  runtime.updateAgent('workflow-feat', 1, 'boss-pm', 'completed', {
    cwd: tmpDir,
    prompt: 'make prd',
    dependencyArtifacts: ['design-brief']
  });
  const result = runRuntimeCommand('resume', ['workflow-feat', '--from-run', runId, '--json'], tmpDir);
  expect(result.status).toBe(0);
  expect(JSON.parse(result.stdout).nodes.some((node: { decision: string }) => node.decision === 'reuse')).toBe(true);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- test/runtime/workflow-runtime.test.ts`

Expected: FAIL because the resume command is missing.

- [ ] **Step 3: Write minimal implementation**

Add `resumeWorkflow` to load `workflow-plan.json`, verify `--from-run` matches current `runId`, evaluate each agent node via existing fingerprint metadata where available, and emit `PipelineResumed`.

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- test/runtime/workflow-runtime.test.ts`

Expected: PASS.

### Task 4: CLI Contract and Documentation

**Files:**
- Test: `test/runtime/runtime-cli-contract.test.ts`
- Modify: `packages/boss-cli/src/cli/registry.ts`
- Modify: `packages/boss-cli/src/cli/dispatcher.ts`
- Modify: `README.md`

- [ ] **Step 1: Write failing CLI contract assertions**

Assert `boss runtime resume --describe` exists and README mentions `workflow-plan.json`, `workflowHash`, and `boss runtime resume`.

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- test/runtime/runtime-cli-contract.test.ts`

Expected: FAIL before registry/docs updates.

- [ ] **Step 3: Wire command and docs**

Add command description, dispatcher import, runtime command list entry, help text, and README docs.

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- test/runtime/runtime-cli-contract.test.ts`

Expected: PASS.

### Task 5: Full Verification

**Files:**
- No new files.

- [ ] **Step 1: Run targeted tests**

Run: `npm test -- test/runtime/workflow-runtime.test.ts test/runtime/stage-agent-runtime.test.ts test/runtime/runtime-cli-contract.test.ts`

Expected: PASS.

- [ ] **Step 2: Run typecheck**

Run: `npm run typecheck`

Expected: PASS.

- [ ] **Step 3: Run full test suite if targeted verification is clean**

Run: `npm test`

Expected: PASS.
