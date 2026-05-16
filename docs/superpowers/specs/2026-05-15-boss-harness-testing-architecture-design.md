# Boss Harness Testing Architecture Design

**Date:** 2026-05-15  
**Status:** Draft for implementation planning  
**Owner:** Boss Skill maintainers

## Summary

Boss currently has many tests, but most are narrow contract or unit checks. They catch schema drift, CLI regressions, prompt wording regressions, and some runtime edge cases, but they do not yet prove the central product promise:

> A user can run Boss Skill during development and get a traceable, recoverable, evidence-backed delivery flow.

This design upgrades the test system into a real harness. The goal is not only to test functions, but to verify full AI engineering workflows: skill discovery, agent prompting, artifact DAG execution, event sourcing, recovery from failure, quality gates, QA evidence, installation across platforms, and slow end-to-end agent behavior when real Codex or Claude sessions are available.

The resulting system should make Boss Skill more stable for users in development by turning its core promises into executable invariants:

- Artifacts are produced in the right order.
- Runtime state can be rebuilt from events.
- Gates cannot be silently bypassed.
- QA must mark unverified critical paths honestly.
- Methodology skills are discoverable and used where expected.
- Failed agents, plugins, and gates can be retried or surfaced cleanly.
- Codex / Claude / Hermes / OpenClaw / Antigravity installation paths remain valid.

## References

This design borrows patterns from several projects and ecosystems:

- Superpowers local test suite: skill-triggering tests, explicit skill request tests, Claude Code headless transcript parsing, integration workflows, token analysis.
  - Local reference: `/Users/qingyun/.codex/superpowers/docs/testing.md`
  - Local reference: `/Users/qingyun/.codex/superpowers/tests/claude-code/README.md`
- gstack: specialist skill roles, office-hours / review / ship workflows, repo-local skill wiring, operational learnings.
  - https://github.com/garrytan/gstack/blob/main/AGENTS.md
  - https://github.com/garrytan/gstack/blob/main/CONTRIBUTING.md
- gstack-codex: Codex-oriented install modes, repo-local `.agents/skills`, managed `AGENTS.md` block, install-state tracking.
  - https://github.com/phd-peter/gstack-codex
- gh-stack skill integration: agent skill support for specialized CLI workflows.
  - https://github.com/github/gh-stack
- Harness Evals / OpenAI Evals style: named eval cases, metrics, thresholds, and repeatable scoring for slower non-CI checks.
  - https://github.com/harness/harness-evals
  - https://github.com/openai/evals

## Current Gaps

The existing suite is valuable, but it is thin in the places users care about most.

### What Exists

- CLI contract tests for help, JSON output, describe metadata, runtime command behavior.
- Runtime application tests for gates, plugins, memory, knowledge, events, artifacts, inspection, retries, reports.
- Hook tests for pre/post tool and session events.
- Documentation and prompt contract tests.
- Basic install tests for copy-installed skill bundles.

### What Is Missing

1. **Scenario-level proof**
   There is no standard scenario DSL that says “given this project fixture and these runtime commands, the final state and artifacts must look like this.”

2. **Trace-level invariants**
   Event sourcing is tested in pieces, but there is no central invariant checker for event traces across realistic scenarios.

3. **Fault injection**
   We do not systematically simulate bad subagent statuses, gate failures, plugin failures, missing artifacts, stale state, path traversal, unexpected lockfile diffs, or retry exhaustion.

4. **Skill behavior tests**
   We have static prompt/skill contracts, but not Superpowers-style transcript tests that verify a real agent session invoked the expected skill before acting.

5. **Agent workflow evals**
   We do not yet have slow tests that run a real Codex or Claude session through Boss workflows and inspect the transcript, artifacts, and token/cost behavior.

6. **Install matrix**
   Installation is tested for some copy flows, but not as a first-class matrix that covers all supported platforms and packed release artifacts.

## Design Goals

### Primary Goals

- Make Boss development delivery more stable by verifying workflow behavior, not just isolated functions.
- Keep normal CI fast and deterministic.
- Put slow and expensive agent evals behind explicit commands.
- Reuse existing Vitest infrastructure where possible.
- Avoid introducing a fragile “LLM judge required” dependency for ordinary tests.
- Make failures explainable: every failed harness check should say which invariant failed and which event/artifact caused it.

### Non-Goals

- Guarantee that an LLM always makes the best product or architecture decision.
- Replace human review for large product decisions.
- Run full real-agent Boss flows in every PR.
- Couple tests to exact prose beyond intentional prompt/skill contracts.
- Introduce browser or model dependencies into the default `npm test`.

## Test Taxonomy

Boss should have five explicit test tiers.

| Tier | Command | Runtime | Purpose | CI |
|------|---------|---------|---------|----|
| Static Contract | `npm test` | Fast | Schemas, CLI, prompts, install metadata, skill layout | Required |
| Runtime Scenario | `npm run test:harness` | Medium | Deterministic Boss scenarios in temp workspaces | Required after Phase 2 |
| Fault Injection | `npm run test:faults` | Medium | Broken agents/plugins/gates/artifacts/retries | Required after Phase 2 |
| Skill Behavior | `npm run test:skills` | Slow | Headless Codex/Claude transcript checks | Optional / nightly |
| Agent Workflow Evals | `npm run evals` | Slow/expensive | End-to-end agent workflow quality and cost | Manual / nightly |

## Proposed Directory Structure

```text
test/
├── harness/
│   ├── scenario-runner.ts
│   ├── trace-invariants.ts
│   ├── artifact-assertions.ts
│   ├── workspace-fixtures.ts
│   ├── scenarios/
│   │   ├── api-only-basic/
│   │   │   ├── scenario.json
│   │   │   ├── fixture/
│   │   │   └── expected/
│   │   ├── web-app-ui-design/
│   │   ├── plugin-gate-failure/
│   │   ├── feedback-revision-loop/
│   │   ├── checkpoint-resume/
│   │   └── install-matrix/
│   └── fixtures/
│       ├── plugins/
│       │   ├── gate-pass/
│       │   ├── gate-fail/
│       │   └── malformed-plugin/
│       └── projects/
│           ├── node-api/
│           ├── vite-react/
│           └── static-html/
├── faults/
│   ├── fault-runner.ts
│   ├── malformed-status.test.ts
│   ├── retry-exhaustion.test.ts
│   ├── unexpected-diff.test.ts
│   └── path-traversal.test.ts
├── skills/
│   ├── prompts/
│   │   ├── boss-trigger.txt
│   │   ├── explicit-boss-skill.txt
│   │   ├── qa-attack.txt
│   │   └── methodology-skill-load.txt
│   ├── run-skill-test.sh
│   ├── transcript-parser.ts
│   └── skill-behavior.test.ts
└── evals/
    ├── eval-runner.ts
    ├── cases/
    │   ├── todo-web-app.json
    │   ├── api-auth-feature.json
    │   └── existing-project-change.json
    ├── metrics.ts
    └── reports/
```

This keeps the existing `test/runtime`, `test/cli`, `test/hooks`, and `test/bin` suites intact. The new harness tests compose them into product-level guarantees.

## Scenario Harness

### Scenario Manifest

Each scenario has a `scenario.json` file:

```json
{
  "name": "api-only-basic",
  "description": "Initializes an API-only pipeline and records core artifacts through stage 3.",
  "fixture": "fixture",
  "feature": "api-auth",
  "commands": [
    ["boss", "project", "init", "api-auth", "--json"],
    ["boss", "packs", "detect", ".", "--json"],
    ["boss", "runtime", "update-stage", "api-auth", "1", "running", "--json"],
    ["boss", "runtime", "record-artifact", "api-auth", "prd.md", "1", "--json"]
  ],
  "expect": {
    "artifacts": [
      ".boss/api-auth/prd.md",
      ".boss/api-auth/.meta/execution.json",
      ".boss/api-auth/.meta/events.jsonl"
    ],
    "state": {
      "feature": "api-auth",
      "stages.1.status": "running"
    },
    "events": [
      "PipelineInitialized",
      "StageStarted",
      "ArtifactRecorded"
    ],
    "forbidPaths": [
      "package.json",
      "node_modules"
    ]
  }
}
```

### Runner Responsibilities

`scenario-runner.ts` should:

1. Create an isolated temp workspace.
2. Copy the fixture into that workspace.
3. Resolve `boss` to the local dist or source CLI under test.
4. Run commands in order.
5. Capture stdout, stderr, exit codes, and duration.
6. Load `.boss/<feature>/.meta/events.jsonl`.
7. Rebuild state from events.
8. Assert expected artifacts, event types, state paths, and forbidden side effects.
9. Emit a compact failure report with command index and trace context.

### First Scenarios

1. `project-init-default`
   - Ensures `.boss/<feature>` scaffold, DAG, placeholder artifacts, and execution metadata are created.

2. `api-only-pack-detection`
   - Fixture: `package.json` with API-only structure.
   - Ensures API-only pack selected and UI artifacts skipped.

3. `web-app-ui-design-contract`
   - Fixture: Vite/React or Next-like layout.
   - Ensures UI artifacts remain in DAG and `ui-design.json` schema validates.

4. `feedback-revision-loop`
   - Simulates Tech Lead / QA `REVISION_NEEDED`.
   - Ensures `RevisionRequested` event and retry path are materialized correctly.

5. `plugin-gate-failure-recovery`
   - Fixture plugin fails once, then passes after a state change.
   - Ensures gate failure is visible and recovery is traceable.

6. `checkpoint-resume`
   - Creates checkpoint, mutates state, resumes.
   - Ensures replay and resumed state are consistent.

## Trace Invariant Checker

`trace-invariants.ts` should be the central source of truth for event-level promises.

### Core Invariants

- Every event has a valid schema.
- Event timestamps are parseable ISO strings.
- Event sequence numbers, if present, are monotonic.
- `PipelineInitialized` appears before stage/artifact events for a feature.
- A stage cannot complete before it starts unless explicitly skipped.
- An artifact cannot be recorded before its dependencies are satisfied.
- Retry events reference a failed stage or failed agent.
- Feedback events reference known source and target agents.
- Gate evaluation events reference a known gate.
- Projector replay from events produces the same `execution.json` state.
- Replaying the same event stream twice is idempotent.

### Output

Failures should look like:

```text
Trace invariant failed: ArtifactRecordedBeforeDependency
feature: api-auth
artifact: architecture.md
missing dependency: prd.md
event index: 12
event type: ArtifactRecorded
```

This makes debugging much faster than a generic deep equality failure.

## Fault Injection

Fault injection should use deterministic fake agents, fake gates, and fake plugins. It should not require real LLM sessions.

### Fault Matrix

| Fault | Expected Harness Behavior |
|-------|---------------------------|
| Agent returns malformed `BOSS_STATUS` | Mark agent failed with parse reason; do not mark artifact complete |
| Agent times out | Emit timeout failure; retry only the failed agent |
| Agent writes missing artifact | Fail artifact recording with actionable message |
| QA requests revision | Emit feedback event; route target agent; cap revision rounds |
| Plugin exits non-zero | Record plugin failure; keep runtime inspectable |
| Gate fails | Block downstream completion; preserve gate evidence |
| Gate passes after retry | Record both failure and pass events |
| Unexpected lockfile diff | Force orchestrator review path; do not auto-complete wave |
| Path traversal artifact path | Reject before reading/writing outside `.boss` |
| Stale `execution.json` | Rebuild from events or report recovery guidance |

### Fault Fixtures

Fake components should live under `test/harness/fixtures`:

```text
test/harness/fixtures/plugins/gate-fail/plugin.json
test/harness/fixtures/plugins/gate-fail/gate.js
test/harness/fixtures/plugins/malformed-plugin/plugin.json
test/harness/fixtures/agents/malformed-status.md
```

## Skill Behavior Tests

This layer follows the Superpowers pattern: run a real agent in headless mode, capture stream JSON or session JSONL, then inspect tool calls.

### Fast Skill Behavior Tests

These should be optional in local development but cheap enough for nightly.

Test cases:

1. Natural prompt triggers Boss.
   - Prompt: “帮我做一个任务看板应用”
   - Expect: Boss skill loaded before implementation actions.

2. Explicit Boss request triggers Boss.
   - Prompt: “Use boss to plan this feature…”
   - Expect: `Skill` invocation for Boss.

3. Methodology skill discovery.
   - Prompt asks PM/Architect/QA style task inside Boss context.
   - Expect: relevant methodology skill referenced or loaded.

4. No premature action.
   - For explicit skill requests, ensure no write/edit/bash action happens before skill invocation.

5. QA attack behavior.
   - Prompt asks QA to evaluate a mocked critical path.
   - Expect: answer marks critical path as unverified, not passed.

### Transcript Parser

`transcript-parser.ts` should support:

- Claude stream JSON.
- Claude session JSONL.
- Codex session logs if available.
- Tool invocation extraction.
- First action before skill invocation detection.
- Token/cost summary fields when present.

The tests should not rely on exact prose. They should inspect tool names, skill names, file writes, commands, and artifact paths.

## Agent Workflow Evals

This tier is intentionally slow and opt-in.

### Eval Case Format

```json
{
  "id": "todo-web-app",
  "prompt": "Build a small todo web app with add, complete, filter, and persistence.",
  "fixture": "empty-vite-react",
  "timeoutSeconds": 1800,
  "requiredArtifacts": [
    "prd.md",
    "architecture.md",
    "ui-spec.md",
    "tasks.md",
    "qa-report.md"
  ],
  "requiredBehaviors": [
    "uses-boss-skill",
    "produces-evidence-wave",
    "runs-tests",
    "records-qa-evidence"
  ],
  "metrics": {
    "maxCostUsd": 10,
    "maxDurationSeconds": 1800,
    "minArtifactCompleteness": 0.85
  }
}
```

### Metrics

Eval reports should include:

- Skill invocations.
- Agent/subagent dispatch count.
- Tool call sequence.
- Artifact completeness score.
- Gate pass/fail status.
- QA evidence score.
- Retry/feedback loop count.
- Token and cost estimate when available.
- Wall-clock duration.

### Scoring Without LLM Judge

Initial scoring should be deterministic:

- Required files exist.
- Markdown sections exist.
- JSON schemas validate.
- Test commands ran.
- Event trace invariants pass.
- QA report contains core path replay evidence or explicit `未验证`.
- `tasks.md` contains Evidence Wave and Contract Matrix when applicable.

LLM-as-judge can be added later, but should not block the first implementation.

## Install Matrix

The install matrix should verify both copy-install and plugin mode.

| Platform | Expected Path / Registration |
|----------|------------------------------|
| Codex | `~/.codex/skills/boss` contains `SKILL.md`, agents, commands, templates, hooks, skills |
| Hermes | `~/.hermes/skills/boss` contains same bundle with Hermes metadata |
| OpenClaw | `~/.openclaw/skills/boss` contains same bundle with OpenClaw metadata |
| Antigravity | `~/.gemini/antigravity/skills/boss` contains same bundle |
| Claude Code | `.claude-plugin/plugin.json` declares `./skill/` and `./skill/skills/` |
| npm package | Packed tarball includes `skill/`, `.claude-plugin/`, dist CLI, assets, schemas |

Representative methodology bundles must be checked, not just `brainstorming`.

## CI Strategy

### Default PR CI

Run:

```bash
npm run typecheck
npm test
```

Includes:

- Existing unit/runtime tests.
- Static contracts.
- Scenario harness tests that do not require external tools.
- Fault injection tests that do not require external tools.

### Nightly CI

Run:

```bash
npm run test:skills
npm run evals -- --smoke
```

Requires:

- Configured Codex or Claude test account.
- Bounded timeouts.
- Cost budget.
- Transcript artifact upload.

### Manual Release Gate

Before release:

```bash
npm run build
npm run test:install-matrix
npm run evals -- --release
npm pack --dry-run
```

This confirms the shipped package contains all skill bundles and platform metadata.

## Implementation Plan Outline

This spec should be implemented in phases.

### Phase 1: Harness Core

- Add `test/harness/scenario-runner.ts`.
- Add `test/harness/trace-invariants.ts`.
- Add `test/harness/artifact-assertions.ts`.
- Convert or add three deterministic scenarios:
  - `project-init-default`
  - `api-only-pack-detection`
  - `plugin-gate-failure`
- Add `npm run test:harness` script.

Exit criteria:

- Scenario runner can create temp workspace, run CLI commands, load events, replay state, assert artifacts and invariants.
- At least three scenarios pass in CI.

### Phase 2: Fault Injection

- Add fake plugin and fake agent fixtures.
- Add deterministic tests for malformed status, gate failure/recovery, missing artifact, path traversal, retry exhaustion.
- Add `npm run test:faults`.

Exit criteria:

- Common failure modes produce clear runtime events or actionable errors.
- Fault tests run without real LLM or network dependencies.

### Phase 3: Install Matrix

- Extend existing install tests into a platform matrix.
- Add npm tarball content check.
- Ensure methodology bundles are checked in every copy-install target.

Exit criteria:

- Every supported platform has at least one install test.
- Release package contents are covered.

### Phase 4: Skill Behavior Tests

- Add `test/skills/run-skill-test.sh`.
- Add transcript parser.
- Add prompt fixtures for Boss triggering, explicit skill request, QA attack, methodology skill usage.
- Add `npm run test:skills`.

Exit criteria:

- Skill behavior tests can run locally when Claude or Codex CLI is configured.
- Tests parse transcripts and detect premature tool use before skill load.

### Phase 5: Agent Workflow Evals

- Add eval runner and case format.
- Add one smoke eval and one richer release eval.
- Add token/cost summary.

Exit criteria:

- Maintainers can run smoke evals before releases.
- Eval reports are machine-readable and human-readable.

## Risks and Mitigations

| Risk | Mitigation |
|------|------------|
| Slow tests make CI painful | Keep real-agent tests out of default CI |
| Transcript formats differ by platform | Use adapter interface per platform |
| Tests become brittle prose checks | Prefer tool calls, artifacts, schemas, events, and section presence |
| Evals become expensive | Add timeouts, max cost budgets, smoke/release tiers |
| Scenario DSL becomes too abstract | Start with explicit command arrays and small assertion vocabulary |
| Real agent behavior is nondeterministic | Use deterministic scenarios for CI; reserve real-agent runs for nightly/release |
| Harness duplicates runtime logic | Keep invariant checker focused on externally visible event/state promises |

## Success Criteria

The architecture is successful when:

- A maintainer can add a new Boss runtime behavior and write a scenario test in one file.
- A broken event sequence fails with a clear invariant error.
- A missing methodology skill or broken install path fails before release.
- A gate/plugin/agent failure is tested without real LLM dependencies.
- A nightly real-agent run can show skill usage, artifact quality, test execution, token/cost, and QA evidence.
- Users see fewer “Boss said done but the project was not actually verified” failures.

## Open Questions

1. Should `npm test` include `test:harness` immediately after Phase 1, or should it remain a separate CI job until stable?
2. Should skill behavior tests target Claude first, Codex first, or support both from the beginning?
3. Where should transcript artifacts be stored in CI: GitHub Actions artifacts, `.boss/<feature>/.meta/evals/`, or both?
4. Should eval case fixtures live under `test/evals/fixtures` or reuse `test/harness/fixtures`?
5. Do we want to add a `boss eval` CLI command later, or keep evals as test-only infrastructure?

