# Boss CLI + Thin Skill Architecture Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Restructure boss-skill into a thin skill bundle backed by a TypeScript CLI runtime under `packages/boss-cli`.

**Architecture:** The root npm package remains `@blade-ai/boss-skill` and acts as the distribution/installer package. Runtime code, installer logic, hook launchers, artifact helpers, and gate commands move behind a `boss` CLI exposed from `packages/boss-cli`; skill files call `boss ...` instead of local `runtime/*.js` and `scripts/*.sh` paths.

**Tech Stack:** Node.js >=20, TypeScript NodeNext, Vitest, npm workspaces.

---

### File Structure

- Create: `packages/boss-cli/package.json` - internal workspace package metadata and bin declarations.
- Create: `packages/boss-cli/tsconfig.json` - builds CLI package to `packages/boss-cli/dist`.
- Create: `packages/boss-cli/src/bin/boss.ts` - primary `boss`/`boss-skill` command dispatcher.
- Move: `src/bin/boss-skill.ts` to `packages/boss-cli/src/commands/install.ts` - installer command implementation.
- Move: `src/runtime/**` to `packages/boss-cli/src/runtime/**` - TypeScript runtime source.
- Move: `src/scripts/lib/progress-emitter.ts` to `packages/boss-cli/src/scripts/lib/progress-emitter.ts`.
- Modify: `package.json` - add workspaces, expose `boss` and `boss-skill`, update build/test package files.
- Modify: `test/bin/boss-skill.test.ts` - assert new bin layout and dispatcher behavior.
- Modify: `test/runtime/runtime-cli-contract.test.ts` - run runtime commands through `boss runtime <command>`.
- Modify: `test/**/*.test.ts` imports from the new package source path.
- Later create: `skill/` - thin skill bundle containing SKILL, commands, agents, references, templates, hooks config.

### Task 1: Introduce Boss CLI Workspace

**Files:**
- Modify: `package.json`
- Create: `packages/boss-cli/package.json`
- Create: `packages/boss-cli/tsconfig.json`
- Create: `packages/boss-cli/src/bin/boss.ts`
- Create: `packages/boss-cli/src/commands/install.ts`
- Move: `src/bin/boss-skill.ts`
- Test: `test/bin/boss-skill.test.ts`

- [ ] **Step 1: Write failing bin contract tests**

Update `test/bin/boss-skill.test.ts` to expect:

```ts
expect(pkg.workspaces).toEqual(['packages/*']);
expect(pkg.bin.boss).toBe('packages/boss-cli/dist/bin/boss.js');
expect(pkg.bin['boss-skill']).toBe('packages/boss-cli/dist/bin/boss.js');
expect(pkg.files).toContain('packages/boss-cli/dist/');
```

Also add a CLI test:

```ts
const result = runCli(['packages/boss-cli/dist/bin/boss.js', 'runtime', '--help']);
expect(result.status).toBe(0);
expect(result.stdout + result.stderr).toContain('boss runtime');
```

- [ ] **Step 2: Run failing test**

Run: `npm test -- test/bin/boss-skill.test.ts`

Expected: FAIL because the workspace package and new dist entrypoint do not exist.

- [ ] **Step 3: Implement minimal workspace CLI**

Add `packages/boss-cli/package.json`, `packages/boss-cli/tsconfig.json`, and a `boss.ts` dispatcher that supports:

```text
boss --help
boss --version
boss install
boss uninstall
boss path
boss runtime --help
```

Move installer implementation into `packages/boss-cli/src/commands/install.ts`.

- [ ] **Step 4: Run test**

Run: `npm test -- test/bin/boss-skill.test.ts`

Expected: PASS.

### Task 2: Move Runtime Source Behind `boss runtime`

**Files:**
- Move: `src/runtime/**` to `packages/boss-cli/src/runtime/**`
- Move: `src/scripts/lib/progress-emitter.ts` to `packages/boss-cli/src/scripts/lib/progress-emitter.ts`
- Modify: `packages/boss-cli/src/bin/boss.ts`
- Modify: `test/runtime/runtime-cli-contract.test.ts`
- Modify: `test/runtime/*.test.ts`
- Modify: `test/harness/*.test.ts`
- Modify: `test/lib/progress-emitter.test.ts`

- [ ] **Step 1: Write failing runtime dispatcher test**

Update `test/runtime/runtime-cli-contract.test.ts` so `runCli('init-pipeline', ['test-feat'])` invokes:

```ts
spawnSync(process.execPath, [BOSS_BIN, 'runtime', name, ...args], ...)
```

Expected payload stays unchanged.

- [ ] **Step 2: Run failing test**

Run: `npm test -- test/runtime/runtime-cli-contract.test.ts`

Expected: FAIL because `boss runtime init-pipeline` is not wired.

- [ ] **Step 3: Move TS runtime source and wire command map**

Implement a static command map in `packages/boss-cli/src/bin/boss.ts`:

```ts
const runtimeCommands = {
  'init-pipeline': () => import('../runtime/cli/init-pipeline.js'),
  'update-stage': () => import('../runtime/cli/update-stage.js')
};
```

Dispatch the rest of the existing runtime CLI modules the same way.

- [ ] **Step 4: Run runtime tests**

Run: `npm test -- test/runtime/runtime-cli-contract.test.ts`

Expected: PASS.

### Task 3: Update Skill Contract To Call CLI

**Files:**
- Modify: `SKILL.md`
- Modify: `commands/boss.md`
- Modify: `hooks/hooks.json`
- Modify: `.claude/settings.json`
- Modify: `test/runtime/docs-contract.test.ts`

- [ ] **Step 1: Write failing docs contract**

Assert `SKILL.md` contains `boss runtime init-pipeline`, `boss artifact prepare`, and does not contain `runtime/cli/` or `scripts/prepare-artifact.sh`.

- [ ] **Step 2: Run failing docs test**

Run: `npm test -- test/runtime/docs-contract.test.ts`

Expected: FAIL because docs still reference direct scripts.

- [ ] **Step 3: Replace direct runtime paths with CLI commands**

Replace examples:

```text
runtime/cli/update-stage.js <feature> 1 running
```

with:

```text
boss runtime update-stage <feature> 1 running
```

- [ ] **Step 4: Run docs test**

Run: `npm test -- test/runtime/docs-contract.test.ts`

Expected: PASS.

### Task 4: Thin Skill Bundle Boundary

**Files:**
- Create: `skill/`
- Move: `SKILL.md`, `commands/`, `agents/`, `references/`, `templates/`, `hooks/`, `skills/brainstorming/` into `skill/`
- Modify: `packages/boss-cli/src/commands/install.ts`
- Modify: package files list
- Modify: tests for install copy behavior

- [ ] **Step 1: Write failing install boundary test**

Assert copy installs use `skill/` as source and do not copy `packages/`, `scripts/`, root `runtime/`, or `src/`.

- [ ] **Step 2: Run failing install test**

Run: `npm test -- test/bin/boss-skill.test.ts`

Expected: FAIL until install source root is changed.

- [ ] **Step 3: Implement skill bundle copy**

Change install command to copy `PKG_ROOT/skill` for copy-mode agents and use package root only for Claude plugin registration.

- [ ] **Step 4: Run full test suite**

Run: `npm test`

Expected: PASS.

