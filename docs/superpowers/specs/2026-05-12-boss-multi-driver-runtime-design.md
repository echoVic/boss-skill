# Boss Multi-Driver Runtime Design

## Context

Boss currently has a strong Claude Code-oriented operating model: skill instructions, agent prompts, hooks, and a TypeScript runtime that records pipeline state in `.boss/<feature>/.meta/execution.json`. That model works best when the host can enforce hooks and agent stop conditions.

Codex needs a different control surface. It can run commands and inspect files reliably, but it should not depend on long conversational memory or implicit hook enforcement. Adapting Boss for Codex should therefore add executable checkpoints, status commands, and final gates without weakening the Claude Code path.

The target architecture is not "Codex replaces Claude Code orchestration." It is "one runtime core with multiple platform drivers."

## Goals

1. Keep `.boss/<feature>/.meta/execution.json` as the shared source of truth for every host.
2. Add Codex-friendly top-level commands that report current state, next action, required checks, and pause reasons.
3. Preserve Claude Code hooks, skill prompts, and agent workflows as first-class behavior.
4. Make platform differences explicit through driver capabilities instead of scattering host-specific assumptions through prompts.
5. Support semi-automatic execution: one wave or checkpoint at a time, with machine-readable gates before continuation.

## Non-Goals

- Do not remove or weaken Claude Code hook behavior.
- Do not turn `SKILL.md` into a Codex-only launcher.
- Do not replace existing `boss runtime ...` commands with incompatible top-level commands.
- Do not add fully autonomous deployment or destructive migration behavior.
- Do not require every host to support the same enforcement mechanism.

## Architecture

Boss should be split conceptually into three layers:

1. **Skill layer**: explains how a host should invoke Boss, interpret runtime output, and report progress.
2. **Runtime core**: owns event sourcing, `.meta/execution.json`, artifact status, waves, gates, checks, QA findings, and final evidence.
3. **Platform drivers**: adapt the runtime core to host capabilities.

The runtime core must remain host-agnostic. It should expose deterministic commands and JSON structures. Drivers decide how to enforce the next step:

| Driver | Primary enforcement | Runtime behavior |
|--------|---------------------|------------------|
| Claude Code | Hooks, skill flow, subagents, stop guards | Runtime records state and gives hooks/agents structured facts |
| Codex | Explicit checkpoint output and manual command execution | Runtime prints required checks and refuses continuation when gates fail |
| Generic CLI | Plain commands and JSON | Runtime supports inspection, dry-run, and scripted automation |

## Command Surface

Top-level commands should be additive wrappers over existing runtime commands:

```bash
boss status <feature>
boss continue <feature>
boss gate <feature> [--stage <n> | --wave <id>]
boss gate final <feature>
boss qa attack <feature>
```

These commands should not bypass the existing lower-level runtime API. They should call into the same application modules that power `boss runtime init-pipeline`, `boss runtime check-stage`, `boss runtime evaluate-gates`, `boss runtime inspect-pipeline`, and `boss runtime generate-summary`.

### `boss status`

Reports the current pipeline state and the next actionable unit.

Human output should be concise:

```text
Feature: ip-platform-mvp
Stage: code (running)
Wave: wave-2-main-flow (blocked)
Next action: run required checks
```

JSON output should include:

- `feature`
- `driver`
- `capabilities`
- `currentStage`
- `currentWave`
- `readyArtifacts`
- `blockedReason`
- `checkpoint`

### `boss continue`

Advances only to the next safe checkpoint. It should never silently run through an entire high blast-radius feature.

Allowed outcomes:

- It records that the next artifact or wave may start.
- It prints `CHECKPOINT_REQUIRED` with exact checks.
- It exits non-zero with `BLOCKED` when required state or evidence is missing.
- It asks for human confirmation when a hard pause point is reached.

### `boss gate`

Runs or summarizes required checks for the current stage or wave. It should use the same gate engine as existing runtime gates, with additional wave-aware inputs when available.

### `boss gate final`

Final completion gate. It should verify:

- Required artifacts exist.
- Stage and wave states are complete.
- Required checks passed or have explicit allowed failures.
- QA findings are closed or explicitly accepted.
- Known-risk and skipped-check sections are present.
- Final report can be generated.

Codex should call this before claiming completion. Claude Code can also call it from stop hooks or manual review.

### `boss qa attack`

Runs platform-neutral QA attack checks when the project has enough information to execute them. It should produce structured findings, not just prose.

Example JSON shape:

```json
{
  "feature": "example-feature",
  "status": "failed",
  "findings": [
    {
      "id": "schema-submit-contract",
      "severity": "critical",
      "status": "open",
      "evidence": "POST /api/resource returned 422 for UI payload"
    }
  ]
}
```

## Checkpoint Contract

When a driver cannot rely on hooks, runtime output must describe the next mandatory action. The checkpoint is a data contract, not just a message.

```json
{
  "checkpointRequired": true,
  "reason": "required-checks-not-run",
  "changedFiles": ["src/server/schema.ts", "src/app/api/resource/route.ts"],
  "requiredChecks": [
    {
      "id": "schema-contract",
      "command": "npx vitest run tests/schema-contract.test.ts",
      "required": true
    },
    {
      "id": "typecheck",
      "command": "npx tsc --noEmit",
      "required": true
    }
  ],
  "continueCommand": "boss continue example-feature"
}
```

Codex-style textual output can render the same data:

```text
CHECKPOINT_REQUIRED:
- changed: src/server/schema.ts, src/app/api/resource/route.ts
- required checks:
  1. npx vitest run tests/schema-contract.test.ts
  2. npx tsc --noEmit
- continue: boss continue example-feature
```

Claude Code should not be forced into this textual checkpoint loop when hooks can enforce equivalent behavior. It may still display checkpoints for transparency.

## Wave Model

High blast-radius work should be represented as runtime-readable waves, not only prose in `tasks.md`.

Each wave should include:

- `id`
- `title`
- `scope`
- `writeSet`
- `redTests`
- `greenGates`
- `contractRows`
- `rollbackRisk`
- `pausePolicy`
- `status`

Runtime may initially parse a constrained markdown table from `tasks.md`. A later version can store `.boss/<feature>/.meta/waves.json` as the canonical read model materialized from events.

Continuation rules:

- Only one active wave at a time unless write sets prove independence.
- A wave cannot complete until its required checks pass.
- The next wave cannot start if the previous wave has open critical findings.
- Hard pause points require human confirmation regardless of driver.

## Human Pause Points

Boss should pause for:

- Product decisions that affect visibility, defaults, or core workflow semantics.
- Data migration strategy changes.
- Billing, payment, quota, or entitlement changes when those concepts exist in the project.
- Permission model changes.
- File deletion, route removal, or hiding a primary entry point.
- Deployment or production-affecting actions.

These pauses are platform-neutral. Claude Code can enforce them with hooks and stop guards; Codex can enforce them through `BLOCKED` status and checkpoint output.

## Skill Layer Changes

`SKILL.md` should describe both drivers without making one subordinate to the other:

- Claude Code path: use hooks, subagents, artifact guards, and runtime state.
- Codex path: call `boss status`, execute one checkpoint, run required checks, then call `boss continue`.
- Shared rule: never infer pipeline state from chat history when `execution.json` exists.

The skill should prefer runtime facts over prompt memory:

1. Read status from runtime.
2. Execute the single next action.
3. Run required checks.
4. Record evidence.
5. Stop at checkpoint, hard pause, or final gate failure.

## Compatibility Rules

- Existing `boss runtime ...` commands remain supported.
- Existing hook configuration remains valid.
- Existing tests for hook behavior must continue to pass.
- New top-level commands must use shared runtime modules, not duplicate state logic.
- JSON output must be stable enough for Codex and other agents to consume.
- Human output may be optimized per driver, but machine output should stay platform-neutral.

## Test Strategy

Add tests at three levels:

1. **CLI contract tests** for `boss status`, `boss continue`, `boss gate final`, and `boss qa attack`.
2. **Runtime application tests** for checkpoint generation, wave state transitions, and final gate decisions.
3. **Documentation contract tests** ensuring the skill documents both Claude Code and Codex drivers without removing hook-based behavior.

Regression tests must explicitly assert:

- Claude Code hook docs and hook config remain present.
- Top-level commands call shared runtime state rather than inventing a separate state file.
- Codex checkpoints include required checks and continuation commands.
- Final gate fails with open critical QA findings.

## Acceptance Criteria

- Boss has a documented multi-driver architecture.
- Codex adaptation is additive and does not weaken Claude Code hooks.
- Runtime state remains the shared source of truth.
- A top-level status command can tell an agent exactly what to do next.
- Checkpoints are machine-readable and human-readable.
- High blast-radius execution can be advanced one wave at a time.
- Final completion requires an executable final gate.

## Risks

- Adding top-level commands could duplicate lower-level runtime behavior. Avoid this by keeping command handlers thin and moving decisions into runtime application modules.
- Parsing waves from markdown can be brittle. Start with strict tables and fail closed when required columns are missing.
- Too many pause points can make Boss feel manual. Keep pauses reserved for irreversible or business-critical decisions.
- Codex-specific wording can creep into generic runtime docs. Keep Codex behavior in driver sections and shared behavior in runtime sections.

## Implementation Shape

A safe implementation sequence:

1. Add design and documentation contract tests for multi-driver behavior.
2. Add a runtime checkpoint model and `boss status`.
3. Add `boss continue` as a thin controller that emits checkpoints and blocks unsafe progression.
4. Add wave read model support.
5. Add `boss qa attack` structured findings.
6. Add `boss gate final`.
7. Update `SKILL.md` to describe platform driver selection.

This sequence keeps Claude Code behavior intact while making Codex progressively more deterministic.
