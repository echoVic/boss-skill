# Codex Dual Hooks and Plugin Design

## Goal

Make Codex a first-class Boss install target by giving it dedicated hook and plugin artifacts, while keeping a single shared runtime for guard, tracking, and pipeline state.

## Decision

Boss should split Claude Code and Codex at the configuration and distribution layer, not at the runtime behavior layer.

The target architecture is:

- Claude Code: dedicated hook manifest and dedicated plugin manifest
- Codex: dedicated hook manifest and dedicated plugin manifest
- Shared runtime: the existing `scripts/hooks/*` logic and Boss runtime state under `.boss/<feature>/.meta`

This is a "dual manifest, single runtime" design.

## Why Split

The current Boss bundle ships one hook manifest, then expects the installer or the host to tolerate unsupported events. That approach is workable for small differences, but Codex differs from Claude Code in ways that are structural:

- Codex does not support `SubagentStart`, `SubagentStop`, `Notification`, or `SessionEnd`
- Codex uses `apply_patch` as the canonical write tool, even if `Edit|Write` matchers remain accepted
- Codex plugin hooks are gated behind `features.plugin_hooks`
- Codex adds events such as `PermissionRequest` and `UserPromptSubmit`

Keeping one shared manifest would force install-time filtering, make review harder, and hide agent-specific behavior inside installer code. Separate artifacts make support boundaries explicit and easier to test.

## Goals

1. Give Codex its own hook manifest with only supported events.
2. Give Codex its own plugin manifest so plugin mode can evolve independently from Claude Code.
3. Keep guard and artifact tracking logic shared across agents.
4. Make install and uninstall behavior deterministic for Codex users.
5. Preserve existing Claude Code behavior without regressions.

## Non-Goals

- Do not fork the pipeline runtime into separate Claude and Codex implementations.
- Do not reimplement `scripts/hooks/*` twice.
- Do not simulate missing Codex lifecycle events such as `SubagentStart` or `SessionEnd`.
- Do not make plugin mode the only Codex install path.

## Architecture

Boss should be organized into three layers:

1. Agent artifacts
2. Hook input normalization
3. Shared runtime behavior

### 1. Agent Artifacts

Claude Code and Codex each get their own published hook manifest and plugin manifest.

Expected artifact families:

- Claude hook manifest: existing Claude-oriented hook config
- Codex hook manifest: Codex-only hook config with unsupported events removed
- Claude plugin manifest: existing Claude plugin metadata
- Codex plugin manifest: Codex plugin metadata and hook attachment points

The installer selects the correct artifact family per agent instead of deriving one from the other at install time.

### 2. Hook Input Normalization

The hook scripts should stop reading raw host payloads directly. Instead, they should depend on a shared normalization helper that converts Claude Code and Codex payloads into one internal shape.

The normalized shape should expose:

- `eventName`
- `cwd`
- `toolName`
- `filePaths`
- `command`
- `permissionMode`
- `turnId`
- `rawInput`

This layer absorbs host differences such as:

- Claude-style direct `file_path` payloads
- Codex `apply_patch` payloads that need file extraction from patch content
- Codex-only request metadata such as `permission_mode`

### 3. Shared Runtime Behavior

The shared hook scripts continue to own behavior:

- artifact write guard
- dangerous bash guard
- artifact auto-tracking
- pipeline stop guard
- session startup context

The runtime remains the source of truth through `.boss/<feature>/.meta/execution.json` and related event logs.

## Codex Hook Scope

The first Codex hook manifest should include only the events Boss already knows how to use safely:

- `SessionStart`
- `PreToolUse`
- `PostToolUse`
- `Stop`

The first Codex hook manifest should not include:

- `SubagentStart`
- `SubagentStop`
- `Notification`
- `SessionEnd`

`PermissionRequest` should not be enabled in v1, but the manifest layout and normalization code should leave room for adding it later without reshaping the installer.

For `SessionStart`, Codex supports `startup`, `resume`, and `clear`. Boss should keep `startup` and `resume` only in v1. `clear` should remain unused until there is an explicit Boss behavior for clearing remembered session context.

For write interception, Codex matchers should prefer `apply_patch` explicitly instead of relying on `Write|Edit` aliases. This makes the manifest self-documenting and reduces ambiguity in tests.

## Installation Strategy

Codex should support two install modes:

1. Default mode: copy the Boss skill and merge Boss-managed entries into `~/.codex/hooks.json`
2. Optional mode: install Codex plugin artifacts for users who explicitly choose plugin mode

Default mode is preferred because Codex plugin hooks require extra feature flags and trust setup, which is a worse first-run experience.

### Codex Default Install

When `~/.codex/` exists, `boss install` should:

1. Copy the Boss skill bundle to `~/.codex/skills/boss`
2. Merge the Codex-specific Boss hook entries into `~/.codex/hooks.json`
3. Record Boss-managed hook ownership in a small state file under `~/.codex/`

The installer must not overwrite unrelated user hook entries.

### Codex Uninstall

When uninstalling from Codex, Boss should:

1. Remove `~/.codex/skills/boss`
2. Remove only the Boss-managed hook entries from `~/.codex/hooks.json`
3. Preserve unrelated user hooks
4. Remove the Boss state file only when no Boss-managed hook entries remain

This requires explicit ownership tracking rather than "rewrite the whole file" behavior.

## Ownership State

Codex hook install state should be tracked in a dedicated file, for example:

`~/.codex/.boss-hooks-state.json`

The state file should record:

- Boss package version
- install mode
- hook ids owned by Boss
- source manifest version or checksum

This state allows:

- idempotent reinstall
- targeted uninstall
- safe upgrades when Boss changes its Codex manifest

If a user edits a Boss-owned hook entry, reinstall should restore the canonical Boss version. This keeps the install result deterministic and makes uninstall logic reliable.

## Plugin Strategy

Boss should add a Codex-specific plugin manifest rather than extending the Claude plugin metadata in place.

The Codex plugin artifact should:

- point at the same Boss skill roots
- reference the Codex-specific hook manifest
- avoid Claude-only metadata assumptions

The Claude plugin artifact should remain unchanged in behavior.

## File Layout

The exact final paths can be adjusted during implementation, but the repository should clearly separate Claude and Codex artifacts. A representative structure is:

```text
skill/hooks/claude/hooks.json
skill/hooks/codex/hooks.json
.claude-plugin/plugin.json
.claude-plugin/marketplace.json
.codex-plugin/plugin.json
.codex-plugin/marketplace.json
scripts/hooks/lib/normalize-input.js
```

The important requirement is separation by agent, not the exact directory names.

## Runtime Changes

The shared hook scripts should adopt the normalization helper before any host-specific logic runs.

Priority runtime changes:

1. Parse Codex `apply_patch` input into one or more touched file paths
2. Preserve current Claude-compatible behavior for `tool_input.file_path`
3. Normalize command extraction for bash hooks
4. Pass through Codex request metadata needed for future `PermissionRequest` support

The main behavioral risk is artifact write detection. If Codex patch parsing is incomplete, the artifact guard and artifact tracker will silently stop protecting `.boss` artifacts. That path must be tested directly.

## Testing

Testing should be split by layer.

### Installer Tests

Add Codex-focused install coverage for:

- fresh install with no existing `hooks.json`
- merge install with existing user hooks
- reinstall idempotency
- uninstall preserving non-Boss hooks
- optional plugin-mode install selection

### Hook Runtime Tests

Add shared runtime tests that exercise both payload styles:

- Claude-style `file_path`
- Codex-style `apply_patch`

These tests should verify:

- `execution.json` direct edits are still denied
- stage mismatch still returns `ask`
- known artifacts are still tracked after patch writes
- non-artifact files remain ignored

### Packaging Tests

Package tests should assert that publish artifacts include:

- Codex hook manifest
- Codex plugin manifest
- normalization helper

They should also continue to assert the existing Claude plugin artifacts.

## Acceptance Criteria

- Codex has a dedicated hook manifest with only supported events.
- Codex has a dedicated plugin manifest.
- Installer logic selects agent-specific artifacts instead of filtering a shared hook manifest.
- Codex default install merges into `~/.codex/hooks.json` without overwriting unrelated user hooks.
- Uninstall removes only Boss-managed Codex hook entries.
- Shared hook scripts support both Claude-style and Codex-style payloads.
- Claude Code behavior and tests remain intact.

## Risks

- Hook ownership tracking adds installer complexity. This is acceptable because it prevents destructive uninstall behavior.
- Codex plugin support may drift from default `hooks.json` install support. Keeping separate manifests makes that drift visible.
- Parsing `apply_patch` file targets can be brittle if Codex evolves payload shape. The normalization layer should fail closed and log useful diagnostics when file extraction is impossible.
