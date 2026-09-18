# Codex Dual Hooks and Plugin Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add dedicated Codex hook and plugin artifacts while keeping one shared Boss hook runtime.

**Architecture:** Split Claude Code and Codex at the manifest and installer layer. Keep `scripts/hooks/*` as the shared behavior layer, but route all host payload handling through a new normalization helper so Claude-style write events and Codex `apply_patch` events are both understood.

**Tech Stack:** TypeScript, Node.js filesystem APIs, JSON config artifacts, Vitest, existing Boss CLI installer and hook test helpers.

---

## File Structure

- Create `skill/hooks/claude/hooks.json`: Claude-specific hook manifest copied from the current shared manifest.
- Create `skill/hooks/codex/hooks.json`: Codex-specific hook manifest limited to supported Codex events.
- Modify `skill/hooks/hooks.json`: either delete this legacy shared file after migration or replace it with a compatibility stub that points maintainers to the split manifests.
- Create `.codex-plugin/plugin.json`: Codex-specific plugin manifest.
- Create `.codex-plugin/marketplace.json`: Codex-specific marketplace metadata if Codex plugin packaging expects a marketplace descriptor in parallel with Claude.
- Create `scripts/hooks/lib/normalize-input.js`: shared hook payload normalization helper.
- Modify `scripts/hooks/pre-tool-write.js`: use normalized file targets rather than reading `tool_input.file_path` directly.
- Modify `scripts/hooks/post-tool-write.js`: use normalized file targets and record known artifacts after Codex patch writes.
- Modify `scripts/hooks/pre-tool-bash.js`: use normalized command extraction.
- Modify `scripts/hooks/post-tool-bash.js`: use normalized command extraction.
- Modify `scripts/hooks/session-start.js`: route raw hook payload through the normalization helper before reading `cwd`.
- Modify `scripts/hooks/session-resume.js`: route raw hook payload through the normalization helper before reading `cwd`.
- Modify `scripts/hooks/on-stop.js`: route raw hook payload through the normalization helper before reading `cwd`.
- Modify `packages/boss-cli/src/commands/install/index.ts`: choose agent-specific hook/plugin artifacts, merge Codex hooks into `~/.codex/hooks.json`, and track Boss-managed ownership state.
- Modify `package.json`: ensure `.codex-plugin/` and split hook manifests are published.
- Modify `test/install/install-matrix.test.ts`: cover Codex hook merge/install/uninstall and packaged artifact inclusion.
- Modify `test/hooks/pre-tool-write.test.ts`: add Codex `apply_patch` payload coverage.
- Modify `test/hooks/post-tool-write.test.ts`: add Codex `apply_patch` payload coverage.
- Modify `test/hooks/pre-tool-bash.test.ts`: add normalized command payload coverage if current tests only cover one host shape.
- Modify `test/hooks/post-tool-bash.test.ts`: add normalized command payload coverage if current tests only cover one host shape.
- Modify `test/runtime/docs-contract.test.ts`: pin documentation references to split hook manifests if needed.

## Task 1: Pin the Split-Artifact Contract with RED Tests

**Files:**
- Modify: `test/install/install-matrix.test.ts`

- [ ] **Step 1: Add RED assertions for split hook artifacts**

Extend the representative bundle coverage so the published skill bundle is expected to contain:

```ts
'hooks/claude/hooks.json',
'hooks/codex/hooks.json',
```

and no longer depends on a single shared manifest path as the source of truth.

- [ ] **Step 2: Add RED assertions for Codex package artifacts**

In the `REQUIRED_PACKED_FILES` list, add:

```ts
'skill/hooks/claude/hooks.json',
'skill/hooks/codex/hooks.json',
'.codex-plugin/plugin.json',
'.codex-plugin/marketplace.json',
'scripts/hooks/lib/normalize-input.js',
```

- [ ] **Step 3: Add RED install coverage for Codex hook merge**

Add a new test that:

1. Creates a temporary HOME with `~/.codex/`
2. Writes an existing `~/.codex/hooks.json` containing one non-Boss hook entry
3. Runs `boss install --json`
4. Asserts:
   - install succeeds
   - `~/.codex/skills/boss` exists
   - `~/.codex/hooks.json` still contains the user hook entry
   - `~/.codex/hooks.json` now contains Boss-owned Codex hook entries
   - `~/.codex/.boss-hooks-state.json` exists

- [ ] **Step 4: Add RED uninstall preservation coverage**

Add a test that installs Boss into a temp Codex home, then runs uninstall and asserts:

1. `~/.codex/skills/boss` is removed
2. the original non-Boss hook entry remains in `~/.codex/hooks.json`
3. Boss-owned hook ids are removed

- [ ] **Step 5: Verify RED**

Run:

```bash
pnpm vitest run test/install/install-matrix.test.ts
```

Expected: FAIL because split manifests, Codex merge install, and ownership tracking do not exist yet.

## Task 2: Create Claude and Codex Hook Manifests

**Files:**
- Create: `skill/hooks/claude/hooks.json`
- Create: `skill/hooks/codex/hooks.json`
- Modify: `skill/hooks/hooks.json`

- [ ] **Step 1: Move the current Claude-oriented manifest into `skill/hooks/claude/hooks.json`**

Copy the current shared hook config into `skill/hooks/claude/hooks.json` without behavior changes.

- [ ] **Step 2: Create the Codex-specific hook manifest**

Create `skill/hooks/codex/hooks.json` with only:

- `SessionStart` entries for `startup` and `resume`
- `PreToolUse` entries for `apply_patch` and `Bash`
- `PostToolUse` entries for `apply_patch` and `Bash`
- `Stop`

Do not include `SubagentStart`, `SubagentStop`, `Notification`, `SessionEnd`, or `PermissionRequest`.

- [ ] **Step 3: Decide the fate of `skill/hooks/hooks.json`**

If other tests or docs still expect `skill/hooks/hooks.json`, replace it with a minimal compatibility file or note for maintainers. If nothing depends on it, remove it and update references. The result must leave one clear source of truth per agent.

- [ ] **Step 4: Verify artifact contents locally**

Run:

```bash
sed -n '1,240p' skill/hooks/claude/hooks.json
sed -n '1,240p' skill/hooks/codex/hooks.json
```

Expected: Claude keeps the full lifecycle set; Codex contains only supported events and explicit `apply_patch` matchers for write hooks.

## Task 3: Add Codex Plugin Artifacts

**Files:**
- Create: `.codex-plugin/plugin.json`
- Create: `.codex-plugin/marketplace.json`
- Modify: `package.json`

- [ ] **Step 1: Write Codex plugin manifests**

Create `.codex-plugin/plugin.json` so it mirrors the Boss skill roots used by Claude plugin mode:

```json
{
  "name": "boss",
  "version": "3.8.10",
  "description": "BMAD pipeline plugin for Codex.",
  "skills": [
    "./skill/",
    "./skill/skills/"
  ]
}
```

Use the existing package version and repository metadata style from `.claude-plugin/plugin.json`, but keep the descriptor Codex-specific instead of reusing Claude naming assumptions.

- [ ] **Step 2: Add marketplace metadata if needed by the current packaging conventions**

Create `.codex-plugin/marketplace.json` mirroring the fields used in `.claude-plugin/marketplace.json`, but scoped to Codex plugin distribution.

- [ ] **Step 3: Publish the new plugin artifacts**

In `package.json`, add:

```json
".codex-plugin/"
```

to the `files` array so `npm pack --dry-run` includes the Codex plugin descriptors.

- [ ] **Step 4: Verify packaging view**

Run:

```bash
npm pack --json --dry-run
```

Expected: output includes `.codex-plugin/plugin.json` and `.codex-plugin/marketplace.json`.

## Task 4: Add Shared Hook Payload Normalization

**Files:**
- Create: `scripts/hooks/lib/normalize-input.js`
- Modify: `scripts/hooks/pre-tool-write.js`
- Modify: `scripts/hooks/post-tool-write.js`
- Modify: `scripts/hooks/pre-tool-bash.js`
- Modify: `scripts/hooks/post-tool-bash.js`
- Modify: `scripts/hooks/session-start.js`
- Modify: `scripts/hooks/session-resume.js`
- Modify: `scripts/hooks/on-stop.js`

- [ ] **Step 1: Add RED tests for Codex write payloads**

In `test/hooks/pre-tool-write.test.ts`, add a test that passes a Codex-style `apply_patch` payload touching `.boss/feat/.meta/execution.json` and expects `permissionDecision === 'deny'`.

Use a payload shaped like:

```ts
{
  tool_name: 'apply_patch',
  tool_input: {
    patch: `*** Begin Patch
*** Update File: /tmp/project/.boss/feat/.meta/execution.json
@@
-old
+new
*** End Patch`
  },
  cwd: '/tmp/project'
}
```

- [ ] **Step 2: Add RED tests for Codex artifact tracking**

In `test/hooks/post-tool-write.test.ts`, add a test that passes a Codex-style `apply_patch` payload touching `/.boss/test-feat/prd.md` and expects the hook to record `prd.md` into stage 1 artifacts.

- [ ] **Step 3: Add RED tests for normalized bash command extraction**

If bash hooks currently assume only `tool_input.command`, add tests that also pass a Codex-shaped payload where the normalized layer still resolves the command string and preserves dangerous-command blocking behavior.

- [ ] **Step 4: Implement `normalize-input.js`**

Create a helper that exports functions along these lines:

```js
function extractPatchedFiles(patch) {
  if (!patch) return [];
  return patch
    .split('\n')
    .filter((line) => line.startsWith('*** Update File: ') || line.startsWith('*** Add File: '))
    .map((line) => line.replace(/^\*\*\* (Update|Add) File: /, '').trim());
}

function normalizeHookInput(rawInput) {
  const input = JSON.parse(rawInput);
  const toolName = input.tool_name || input.tool || '';
  const toolInput = input.tool_input || input.arguments || {};
  const patch = toolInput.patch || '';
  const directFilePath = toolInput.file_path || toolInput.path || '';
  const filePaths = directFilePath ? [directFilePath] : extractPatchedFiles(patch);

  return {
    rawInput: input,
    eventName: input.hook_event_name || '',
    cwd: input.cwd || '',
    toolName,
    toolInput,
    filePaths,
    command: toolInput.command || '',
    permissionMode: input.permission_mode || '',
    turnId: input.turn_id || ''
  };
}
```

Handle duplicate file paths by de-duplicating them. If no file paths can be extracted from `apply_patch`, return an empty list and let callers fail closed.

- [ ] **Step 5: Update hook scripts to use normalized input**

Refactor each script so it calls the helper once and then reads:

- `normalized.cwd`
- `normalized.command`
- `normalized.filePaths`

For write hooks, iterate through `filePaths` and apply the existing logic to each path. Return the strongest decision:

- `deny` beats `ask`
- `ask` beats empty allow

For post-write artifact tracking, stop after the first recognized artifact write successfully records, but make sure the script can still discover artifacts from a multi-file patch.

- [ ] **Step 6: Verify hook tests**

Run:

```bash
pnpm vitest run test/hooks/pre-tool-write.test.ts test/hooks/post-tool-write.test.ts test/hooks/pre-tool-bash.test.ts test/hooks/post-tool-bash.test.ts
```

Expected: PASS, including both legacy and Codex payload coverage.

## Task 5: Implement Codex Install Merge and Ownership Tracking

**Files:**
- Modify: `packages/boss-cli/src/commands/install/index.ts`
- Modify: `test/install/install-matrix.test.ts`

- [ ] **Step 1: Add Codex-specific install mode metadata**

Extend the installer model so Codex is no longer a plain `copy` target. It needs explicit Codex install behavior capable of:

- copying the skill bundle
- choosing default `hooks.json` merge mode
- optionally selecting plugin mode later

Represent this with either a new install method such as `codex-copy-with-hooks` or a Codex-specific handler function. Avoid pushing Codex branching into the generic copy installer.

- [ ] **Step 2: Add JSON helpers for hooks merge**

Inside `install/index.ts` or a small adjacent helper module, add logic to:

1. read `~/.codex/hooks.json` if present
2. read `skill/hooks/codex/hooks.json`
3. merge Boss hook entries by stable `id`
4. preserve non-Boss entries
5. write the merged file with pretty JSON formatting

Use hook `id` as the ownership boundary. Boss should fully replace any existing entry whose `id` matches a Boss-owned Codex hook id.

- [ ] **Step 3: Add ownership state persistence**

Write `~/.codex/.boss-hooks-state.json` with a shape like:

```json
{
  "version": "3.8.10",
  "installMode": "hooks-json",
  "hookIds": [
    "session:start",
    "session:resume",
    "pre:write:artifact-guard",
    "pre:bash:dangerous-cmd-guard",
    "post:write:artifact-track",
    "post:bash:context",
    "stop:pipeline-guard"
  ]
}
```

- [ ] **Step 4: Add uninstall cleanup by ownership**

During uninstall, if `~/.codex/.boss-hooks-state.json` exists:

1. load the recorded hook ids
2. remove only those ids from `~/.codex/hooks.json`
3. keep every other hook entry untouched
4. delete the state file only after cleanup succeeds

- [ ] **Step 5: Keep help text honest**

Update the CLI help text so Codex no longer appears as a bare "copy + metadata inject" target. Document that Codex default install also merges hooks into `~/.codex/hooks.json`, and that plugin mode is a separate advanced path if you choose to expose it in help now.

- [ ] **Step 6: Verify install behavior**

Run:

```bash
pnpm vitest run test/install/install-matrix.test.ts
```

Expected: PASS.

## Task 6: Final Packaging and Regression Verification

**Files:**
- Modify only if verification reveals gaps.

- [ ] **Step 1: Run focused typecheck**

Run:

```bash
pnpm run typecheck
```

Expected: PASS.

- [ ] **Step 2: Run focused install and hook suites**

Run:

```bash
pnpm vitest run test/install test/hooks
```

Expected: PASS.

- [ ] **Step 3: Run full test suite**

Run:

```bash
pnpm test
```

Expected: PASS.

- [ ] **Step 4: Verify publish contents**

Run:

```bash
npm pack --json --dry-run
```

Expected: packed files include split hook manifests, `.claude-plugin/`, `.codex-plugin/`, and `scripts/hooks/lib/normalize-input.js`.
