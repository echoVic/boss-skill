# Hermes Agent Support Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add Hermes Agent as a copy-install target for `boss-skill`.

**Architecture:** Extend the existing installer registry in `packages/boss-cli/src/commands/install/index.ts`. Hermes follows the same copy-install path as Codex/OpenClaw/Antigravity and injects a Hermes metadata block into the copied `SKILL.md`.

**Tech Stack:** TypeScript, Node.js filesystem APIs, Vitest, existing boss CLI test helpers.

---

### Task 1: Add Hermes Installer Coverage

**Files:**
- Modify: `test/cli/agent-cli-contract.test.ts`
- Modify: `test/bin/boss-skill.test.ts`

- [ ] **Step 1: Write failing tests**

Add coverage that creates a temporary HOME with `.hermes`, runs install dry-run and real install/uninstall commands, and asserts Hermes appears in structured actions. Add dist-bin coverage that `~/.hermes/skills/boss/SKILL.md` exists and contains `metadata.hermes`.

- [ ] **Step 2: Run tests to verify failure**

Run: `pnpm vitest run test/cli/agent-cli-contract.test.ts test/bin/boss-skill.test.ts`

Expected: FAIL because Hermes is not yet listed in install actions and no Hermes skill directory is created.

### Task 2: Implement Hermes Installer Target

**Files:**
- Modify: `packages/boss-cli/src/commands/install/index.ts`

- [ ] **Step 1: Add Hermes metadata**

Add a `Hermes` entry to `METADATA` with `metadata.hermes`, emoji, and `node`/`bash` requirements.

- [ ] **Step 2: Add Hermes agent registration**

Add an `AGENTS` entry with:

```ts
{
  name: 'Hermes',
  detect: () => fs.existsSync(path.join(HOME, '.hermes')),
  dest: () => path.join(HOME, '.hermes', 'skills', 'boss'),
  method: 'copy',
}
```

- [ ] **Step 3: Update help text**

Update compatibility and auto-detect help text to mention Hermes and the `~/.hermes/skills/boss` target.

- [ ] **Step 4: Run tests to verify pass**

Run: `pnpm vitest run test/cli/agent-cli-contract.test.ts test/bin/boss-skill.test.ts`

Expected: PASS.

### Task 3: Full Verification

**Files:**
- No additional source files.

- [ ] **Step 1: Run typecheck**

Run: `pnpm run typecheck`

Expected: PASS.

- [ ] **Step 2: Run full test suite**

Run: `pnpm test`

Expected: PASS.
