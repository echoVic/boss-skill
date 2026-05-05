# Runtime Application Structure Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [x]`) syntax for tracking.

**Goal:** Restructure `packages/boss-cli/src` so CLI adapters, application services, command metadata, and runtime domain code have clear boundaries without changing public CLI behavior.

**Architecture:** Move runtime service modules out of `runtime/cli/lib` into `runtime/application`, keep `runtime/cli/*.ts` as thin argument/output adapters, and split root dispatcher/help/metadata concerns out of `bin/boss.ts` and `cli/command-registry.ts`. Existing runtime and CLI contract tests remain the behavior safety net.

**Tech Stack:** TypeScript, Node.js standard library, Vitest, existing Boss CLI contract utilities.

---

### Task 1: Add Architecture Boundary Tests

**Files:**
- Modify: `test/runtime/no-first-party-shell.test.ts`
- Modify: `test/runtime/runtime-cli-contract.test.ts`

- [x] **Step 1: Add source-boundary assertions**

Add tests that fail while `packages/boss-cli/src/runtime/cli/lib` contains application services and while `bin/boss.ts` remains the only owner of group routing metadata.

- [x] **Step 2: Run focused tests to verify red**

Run:

```bash
npm test -- test/runtime/no-first-party-shell.test.ts test/runtime/runtime-cli-contract.test.ts
```

Expected: FAIL until application modules and router modules are moved.

### Task 2: Move Runtime Services To Application Layer

**Files:**
- Create: `packages/boss-cli/src/runtime/application/inspection-runtime.ts`
- Create: `packages/boss-cli/src/runtime/application/memory-runtime.ts`
- Create: `packages/boss-cli/src/runtime/application/pack-runtime.ts`
- Create: `packages/boss-cli/src/runtime/application/pipeline-runtime.ts`
- Create: `packages/boss-cli/src/runtime/application/plugin-runtime.ts`
- Modify: `packages/boss-cli/src/runtime/cli/*.ts`
- Modify: `test/**/*.ts`

- [x] **Step 1: Move files mechanically**

Move every file from `packages/boss-cli/src/runtime/cli/lib/*-runtime.ts` to `packages/boss-cli/src/runtime/application/*-runtime.ts`.

- [x] **Step 2: Update imports**

Update CLI adapters and tests to import runtime services from `packages/boss-cli/src/runtime/application/...`.

- [x] **Step 3: Keep adapter helpers under CLI**

Keep `packages/boss-cli/src/runtime/cli/lib/agent-command-utils.ts` in CLI because it only handles argument and output concerns.

- [x] **Step 4: Verify behavior**

Run:

```bash
npm run build
npm test -- test/runtime/runtime-cli-contract.test.ts test/runtime/feature-flow.integration.test.ts
```

Expected: PASS.

### Task 3: Split Root CLI Dispatcher

**Files:**
- Create: `packages/boss-cli/src/cli/root-descriptions.ts`
- Create: `packages/boss-cli/src/cli/root-help.ts`
- Create: `packages/boss-cli/src/cli/runtime-loader.ts`
- Create: `packages/boss-cli/src/cli/group-router.ts`
- Modify: `packages/boss-cli/src/bin/boss.ts`

- [x] **Step 1: Extract root descriptions and help text**

Move `rootDescription`, group descriptions, `ROOT_USAGE`, `RUNTIME_USAGE`, `PROJECT_USAGE`, `ARTIFACT_USAGE`, `PACKS_USAGE`, and `HOOKS_USAGE` out of `bin/boss.ts`.

- [x] **Step 2: Extract runtime module loader**

Move the runtime command dynamic import map into `cli/runtime-loader.ts`.

- [x] **Step 3: Extract command group routing**

Move `runRuntimeCommand`, `runProjectCommand`, `runArtifactCommand`, `runPacksCommand`, and `runHooksCommand` into `cli/group-router.ts`.

- [x] **Step 4: Shrink `bin/boss.ts`**

Leave `bin/boss.ts` responsible for entrypoint wiring, root-level dispatch, and `runMain()`.

### Task 4: Split Command Metadata

**Files:**
- Create: `packages/boss-cli/src/cli/common-options.ts`
- Create: `packages/boss-cli/src/cli/root-command-registry.ts`
- Create: `packages/boss-cli/src/cli/runtime-command-registry.ts`
- Modify: `packages/boss-cli/src/cli/command-registry.ts`

- [x] **Step 1: Move shared option builders**

Move common option arrays into `common-options.ts`.

- [x] **Step 2: Move top-level command descriptions**

Move `commandDescriptions` into `root-command-registry.ts`.

- [x] **Step 3: Move runtime descriptions**

Move `runtimeCommandNames` and `runtimeCommandDescriptions` into `runtime-command-registry.ts`.

- [x] **Step 4: Preserve compatibility barrel**

Keep `command-registry.ts` as a re-export barrel so existing imports continue to work.

### Task 5: Full Verification And Commit

**Files:**
- Modify: source/tests touched by earlier tasks.

- [x] **Step 1: Run source scans**

Run:

```bash
rg -n "runtime/cli/lib/(inspection|memory|pack|pipeline|plugin)-runtime" packages/boss-cli/src test
rg -n "console\\.table|ora\\(|chalk|\\x1b\\[" packages/boss-cli/src
rg -n "Are you sure|\\(y/n\\)|readline" packages/boss-cli/src
```

Expected: no matches.

- [x] **Step 2: Run full verification**

Run:

```bash
npm run build && npm run typecheck && npm test
```

Expected: all commands exit 0, with all tests passing.

- [x] **Step 3: Commit**

Run:

```bash
git add docs/superpowers/plans/2026-05-05-runtime-application-structure.md packages/boss-cli/src test
git commit -m "refactor: clarify boss cli runtime architecture"
```
