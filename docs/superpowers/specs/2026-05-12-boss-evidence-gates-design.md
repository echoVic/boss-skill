# Boss Evidence Gates Design

## Context

Boss currently produces convincing planning artifacts, but its delivery confidence is too dependent on checklist completeness and agent self-reporting. Recent failures showed the weak points:

- Core user paths can remain broken even when PRD, architecture, tasks, and QA documents exist.
- TDD is present as a principle, but not enforced as a wave-level execution constraint.
- Frontend payloads, backend schemas, user-facing copy, pricing, permissions, and publish/remix policy can drift apart.
- Existing project facts are sometimes guessed instead of discovered before planning.
- High blast radius work can be planned as one large implementation batch.
- QA can verify file presence and mocked tests without attacking realistic user journeys.
- Final reports emphasize generated documents more than executable evidence.

This design upgrades Boss at the skill, agent prompt, template, and final report layers. It intentionally does not add new runtime gate code in this wave; programmatic gates can follow once the process contract is stable.

## Goals

1. Make repo fact discovery a mandatory preflight before implementation planning.
2. Require high blast radius work to be split into independently verifiable waves.
3. Add explicit cross-layer contract checks for UI, request payloads, schemas, business rules, permissions, pricing, and copy.
4. Make QA simulate core user paths with real browser/API/schema behavior instead of relying on mocked happy paths.
5. Put executable evidence before document inventory in final Boss reports.

## Non-Goals

- No new runtime CLI command in this pass.
- No automatic parser for every framework's schema or route conventions in this pass.
- No replacement of the existing DAG, event stream, or quality gate engine.
- No change to the public `/boss` command contract beyond stronger required outputs.

## Approach

Use the existing Boss skill structure as the enforcement surface:

- `skill/SKILL.md` defines orchestrator behavior.
- `skill/agents/boss-scrum-master.md` defines task and wave planning.
- `skill/agents/boss-qa.md` defines QA attack behavior and evidence requirements.
- `skill/references/testing-standards.md` defines test quality rules.
- `skill/templates/tasks.md.template` records planning outputs required by implementation agents.
- `skill/templates/qa-report.md.template` records QA evidence and residual risk.
- `packages/boss-cli/src/runtime/report/render-markdown.ts` renders final reports with evidence first.

The implementation should remain mostly documentation/template driven, with one small code change to reorder and enrich the final Markdown summary.

## Required Behavior

### 1. Repo Preflight

Before code-stage planning, Boss must gather project facts and pass them to downstream agents. The preflight should record:

- Git default branch and current branch.
- CI files and actual commands configured in CI.
- Package manager and install/test/build/lint/typecheck scripts.
- Whether `npm test` or equivalent includes integration and E2E suites.
- Existing E2E/browser tooling.
- Schema validators and enum sources, such as Zod, Yup, OpenAPI, Prisma, Drizzle, Pydantic, or JSON Schema.
- Pricing, credit, quota, or billing constants.
- Auth and authorization entry points.
- Route conventions, including async route params where relevant.
- Migration files and any silent limit, truncation, backfill, or destructive operation.

If a fact cannot be discovered, Boss must write `unknown` with the commands/files checked. It must not silently guess.

### 2. Evidence-Driven Waves

Scrum Master must split high blast radius work into waves that can each pass their own verification. A wave must include:

- Scope and purpose.
- Files owned by the wave.
- Red tests to write before implementation.
- Green gate commands to run after implementation.
- Cross-layer contract checks relevant to the wave.
- Stop conditions that block the next wave.

High blast radius triggers include data model changes, migrations, auth/permission changes, pricing/credit logic, global state, route entry points, publish/remix policy, dependency or CI changes, and large write sets.

### 3. Contract Matrix

`tasks.md` must include a contract matrix whenever a feature crosses frontend, backend, storage, or business-rule boundaries. Each row should map one user-visible or API-facing promise across layers:

| Contract | UI / Copy | Client Payload | Server Schema | Persistence | Business Rule | Test Evidence |
|----------|-----------|----------------|---------------|-------------|---------------|---------------|

Examples:

- Form option label maps to a legal server enum value.
- Displayed credit cost matches server charge.
- Publish copy matches remix policy.
- Create flow produces the promised generated asset.
- Anonymous, owner, and non-owner permissions match API behavior.

Rows without test evidence are not considered verified.

### 4. TDD Enforcement Per Wave

Tasks must make test-first behavior observable:

- Each wave lists at least one red test or explicit reason why no code behavior changes in that wave.
- The implementation report must state which tests failed before implementation and then passed after implementation.
- Tests that mock the critical path cannot be used as sole evidence for that path.
- UI submit payloads must be validated against the real server schema or an imported shared schema.

### 5. QA Attack Protocol

QA must verify as an attacker, not a paperwork reviewer. The QA report must include:

- Core user journey replay with concrete steps and evidence.
- Real browser or API execution where the project supports it.
- Actual request payload and actual server response for critical submits.
- Schema validation evidence for payloads.
- Authorization checks for anonymous users, owners, and non-owners.
- Empty state, pagination beyond first page, old migrated data, and failure states.
- User-visible numeric/copy consistency with backend business logic.
- Generated asset existence and usability for creation/generation features.

If the only available test mocks the critical backend response, QA must mark the core path unverified.

### 6. Final Evidence Report

Final Boss reports should start with evidence, then documents:

1. Core user paths and pass/fail status.
2. Gate commands actually executed.
3. Red-to-green test evidence.
4. Contract matrix status.
5. Known failures, skipped checks, and residual risks.
6. Stage and artifact inventory.

This makes the report useful as an engineering handoff, not just a document index.

## File-Level Changes

### `skill/SKILL.md`

Add a required repo preflight step before code artifact dispatch. Add orchestration language that blocks code dispatch when preflight, wave gates, or contract matrix sections are missing for cross-layer features.

### `skill/agents/boss-scrum-master.md`

Require wave planning and contract matrix generation. Make the Scrum Master decompose large tasks by acceptance wave rather than by role alone.

### `skill/agents/boss-qa.md`

Add the QA attack protocol and make real-path evidence mandatory. Clarify that mocked critical paths cannot prove the MVP path works.

### `skill/references/testing-standards.md`

Add rules for schema-backed submit tests, red-to-green evidence, and mock boundaries for critical paths.

### `skill/templates/tasks.md.template`

Add sections for repo preflight summary, evidence-driven waves, contract matrix, and red/green gates.

### `skill/templates/qa-report.md.template`

Add sections for core journey replay, command evidence, payload/schema evidence, attack checks, and residual risk.

### `packages/boss-cli/src/runtime/report/render-markdown.ts`

Reorder the generated final report so quality evidence appears before artifact lists. Because the current summary model only has execution state and gate checks, this pass should render available gate/stage evidence and add placeholders that point to `qa-report.md` and `tasks.md` for detailed journey and contract evidence. Rich extraction can be added in a later runtime-gate wave.

## Acceptance Criteria

- Boss skill requires repo preflight before code-stage dispatch.
- Scrum Master prompt and tasks template require waves with red tests, green gates, and stop conditions.
- Tasks template includes a contract matrix with UI, payload, schema, persistence, business rule, and test evidence columns.
- QA prompt and QA template require core journey replay and real payload/schema evidence.
- Testing standards forbid mocked critical-path tests as the sole proof for a core flow.
- Final Markdown report leads with evidence and residual risks before artifact inventory.
- Existing tests continue to pass, or any failures are reported with exact commands and failure output.

## Risks

- Prompt-only enforcement is still weaker than runtime enforcement. This is accepted for this wave because the user chose template/report enhancement rather than new runtime gates.
- Agents may overproduce documentation if templates are too large. Keep added sections concise and evidence-oriented.
- Summary rendering cannot infer detailed journey evidence until runtime stores it structurally. The first version should clearly point to the QA and tasks artifacts.

## Future Runtime Gate Wave

A later wave can add programmatic checks:

- `boss runtime preflight <feature> --json`
- Contract matrix schema validation.
- Gate that fails when QA reports critical paths as unverified.
- Extraction of evidence rows from `tasks.md` and `qa-report.md` into `execution.json`.
