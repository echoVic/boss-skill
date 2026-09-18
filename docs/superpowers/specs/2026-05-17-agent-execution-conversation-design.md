# Agent Execution Conversation Design

## Summary

Boss should keep documents as the formal artifact layer while adding a lightweight execution conversation layer for agent-to-agent coordination during implementation. The new layer should allow point-to-point discussion and small huddles between any agents, without requiring user participation, and every resolved conversation must materialize into one or more executable todos or a formal revision loop.

The design goal is to make multi-agent execution feel more like a real engineering team: agents can question, challenge, propose, request changes, and align on implementation details while the orchestrator preserves auditability, bounded context, and deterministic follow-up.

## Goals

- Add a general execution conversation mechanism that is role-agnostic and available to any agent pair or small group.
- Preserve documents such as `prd.md`, `architecture.md`, `ui-spec.md`, `ui-design.json`, `tasks.md`, `qa-report.md`, and `deploy-report.md` as the formal source of truth.
- Support point-to-point and orchestrator-managed huddle conversations without exposing internal discussion to the user by default.
- Require every resolved conversation to produce an actionable outcome: derived todo(s), a formal revision request, or an explicit no-action resolution record.
- Keep conversation state auditable and replayable through runtime events and materialized state.
- Reuse the existing runtime-first architecture, especially `events.jsonl`, `execution.json`, `record-feedback`, memory refresh, and summary generation.

## Non-Goals

- No free-form persistent group chat system.
- No requirement for the user to participate in execution-time conversations.
- No replacement of `tasks.md` as the baseline delivery plan.
- No attempt to store full long-form chat transcripts in prompts or reports by default.
- No fully generic ticketing product or external collaboration UI in the first version.

## Problem Statement

The current Boss protocol is strong at artifact handoff and terminal status reporting. Agents can produce documents, code, reports, and formal end states such as `DONE`, `BLOCKED`, or `REVISION_NEEDED`. However, the execution phase lacks an explicit collaboration layer for in-flight coordination.

This causes two forms of rigidity:

- Coordination happens too late, after an artifact or agent run has already completed.
- The only structured correction path is the revision loop, which is useful but too narrow for many execution-time interactions.

Real engineering teams do not only hand off documents. They also ask quick questions, challenge assumptions, request targeted changes, and pull a small sync when evidence conflicts. Boss should support the same pattern while still ending in structured, executable outcomes.

## Design Principles

- Documents remain the formal medium of record.
- Conversations exist to improve execution, not replace artifacts.
- Any agent may initiate a conversation with any other agent.
- The orchestrator remains the message bus, scheduler, and policy boundary.
- Every conversation must be anchored to concrete work.
- Every resolved conversation must close with executable follow-up.
- Revision loops remain the formal path for source-of-truth changes.

## Two-Layer Model

Boss should operate with two distinct but connected layers:

### Artifact Layer

The artifact layer remains unchanged in purpose. It is responsible for durable deliverables and project truth:

```text
prd.md
architecture.md
ui-spec.md
ui-design.json
tech-review.md
tasks.md
qa-report.md
deploy-report.md
```

These files remain the authoritative project record.

### Conversation Layer

The conversation layer is a new execution-time coordination mechanism. It is responsible for:

- clarifying implementation ambiguity
- challenging a local decision
- proposing an alternative
- requesting a change
- aligning a multi-party disagreement
- converging to executable follow-up

The conversation layer should not be treated as a free-form side channel. It is a bounded runtime structure tied to concrete work and designed to collapse back into todos or revision requests.

## Conversation Primitives

The execution conversation protocol should be role-agnostic. Instead of hard-coding flows such as `QA -> Frontend`, Boss should support a small set of universal intents:

- `ask`
- `challenge`
- `propose`
- `request_change`
- `escalate`
- `huddle`
- `resolve`

Example mappings:

- Frontend asks Architect about API polling behavior.
- QA requests a Backend change for a failed acceptance path.
- Tech Lead challenges a database migration strategy.
- UI Designer proposes a different interaction model to Frontend.
- Backend escalates a cross-layer consistency problem into a huddle with Architect and QA.

These are all instances of the same protocol.

## Anchoring Rules

Every conversation must be anchored to at least one concrete target. Conversations without anchors are invalid.

Allowed anchor categories:

- `artifact`
- `task`
- `scope`
- `decision`

Examples:

- `artifact: ui-design.json`
- `task: T-004`
- `scope: src/app/checkout/page.tsx`
- `decision: payment callback idempotency`

Anchoring prevents drift, lets the orchestrator choose participants, and makes downstream memory and reporting useful.

## Conversation State Machine

Each conversation thread should follow this lightweight lifecycle:

```text
open -> discussing -> converged -> materialized -> closed
```

State meanings:

- `open`: the thread has been created with initiator, participants, kind, and anchor.
- `discussing`: one or more messages have been exchanged and the issue is still active.
- `converged`: a decision has been reached, but follow-up has not yet been materialized.
- `materialized`: one or more todos or a revision request have been generated from the decision.
- `closed`: the materialized outcome has been assigned into runtime execution flow.

Threads must not close directly from `discussing` to `closed`. A conversation without a materialized outcome is incomplete.

## Materialization Rule

Every resolved conversation must produce one of the following:

1. One or more derived todos.
2. A formal revision request against an upstream source-of-truth artifact.
3. An explicit no-action resolution record when the only result is confirmation that the current implementation should continue unchanged.

Even in the third case, the system should record a minimal follow-up action such as:

- continue implementation under the confirmed interpretation
- continue validation using the confirmed acceptance rule

This guarantees that no conversation evaporates without execution impact.

## Runtime Objects

The first version should introduce three first-class runtime objects: `Thread`, `Message`, and `Todo`.

### Thread

Suggested minimum shape:

```json
{
  "id": "conv-001",
  "kind": "challenge",
  "anchor": {
    "decision": "payment callback idempotency"
  },
  "initiator": "boss-backend",
  "participants": ["boss-architect"],
  "status": "open",
  "priority": "high",
  "createdAt": "2026-05-17T09:00:00Z",
  "updatedAt": "2026-05-17T09:00:00Z"
}
```

### Message

Suggested minimum shape:

```json
{
  "id": "msg-001",
  "threadId": "conv-001",
  "from": "boss-backend",
  "to": ["boss-architect"],
  "intent": "objection",
  "content": "Current callback contract can double-apply a successful payment.",
  "evidence": [
    {
      "type": "artifact",
      "ref": ".boss/checkout/architecture.md"
    }
  ],
  "createdAt": "2026-05-17T09:02:00Z"
}
```

Messages should remain short. Evidence should prefer references over copied long text.

### Todo

Suggested minimum shape:

```json
{
  "id": "todo-001",
  "sourceThreadId": "conv-001",
  "title": "Update payment callback contract with idempotency key and state guard",
  "owner": "boss-architect",
  "type": "doc_update",
  "status": "pending",
  "successCriteria": [
    "architecture.md defines idempotency key behavior",
    "callback state transitions are explicit",
    "downstream backend implementation can proceed without ambiguity"
  ],
  "impact": {
    "artifacts": ["architecture.md"],
    "scope": ["payment callback contract"]
  },
  "dispatchHint": {
    "stage": 1,
    "agent": "boss-architect"
  },
  "createdAt": "2026-05-17T09:10:00Z"
}
```

Todos must have a single owner. They may reference multiple impacted participants, but responsibility should not be shared.

## Resolution Model

Each converged thread should produce a structured resolution summary before materialization. Suggested fields:

- `summary`
- `decision`
- `todos`
- `impact`
- `sourceThreadId`

This resolution model is the bridge between lightweight discussion and deterministic execution.

## Runtime Event Model

The current runtime event set already supports formal revision loops through `RevisionRequested`. The new conversation layer should add four event types:

- `ConversationOpened`
- `ConversationMessageAppended`
- `ConversationResolved`
- `TodoMaterialized`

These events should live alongside existing runtime events such as:

- `AgentStarted`
- `AgentCompleted`
- `ArtifactRecorded`
- `RevisionRequested`

Expected flow:

```text
ConversationOpened
  -> ConversationMessageAppended*
  -> ConversationResolved
  -> TodoMaterialized+
  -> AgentStarted / RevisionRequested / downstream scheduling
```

This gives Boss a replayable collaboration trace without turning the event stream into an unbounded chat log.

## Materialized State Changes

`execution.json` should continue to represent the materialized control-plane view. The design should extend it with conversation-aware sections rather than overload `revisionRequests`.

Suggested additions:

- `conversations`: summary records for active and recent threads
- `derivedTodos`: pending and completed execution-time todos
- `conversationMetrics`: counts such as opened threads, huddles, derived todos, unresolved threads

`revisionRequests` should remain dedicated to formal source-of-truth revision loops.

The first version may also persist richer snapshots under:

```text
.boss/<feature>/.meta/conversations.json
.boss/<feature>/.meta/todos.json
```

This allows the event stream to stay append-only while keeping thread and todo retrieval simple.

## Relationship to `tasks.md`

`tasks.md` should remain the baseline implementation plan created by Scrum Master before code execution.

The new conversation layer introduces a second category of work:

- plan-time tasks in `tasks.md`
- execution-time derived todos in runtime state

The first version should not rewrite the main `tasks.md` body for every derived todo. Mixing baseline planning and runtime follow-up would blur the line between original plan and execution-time discoveries.

Instead:

- `tasks.md` remains the initial source of plan truth
- execution conversations generate derived todos in runtime metadata
- final reports and diagnostics should show both baseline tasks and derived todos

If later needed, Boss may add an optional appendix or generated view that references derived todos without mutating the authored task plan.

## Dispatch Rules

After a thread converges, the orchestrator should choose one of three exits:

### Exit A: Direct Todo Materialization

Use when:

- the action is clear
- a single owner is obvious
- no upstream contract must be formally revised

Examples:

- fix a UI bug
- add a missing test
- continue implementation under a clarified interpretation

### Exit B: Huddle

Use when:

- discussion exceeds two back-and-forth turns without convergence
- the issue affects multiple owners
- evidence conflicts across artifacts, code, or tests
- the decision affects current wave boundaries or integration timing

The orchestrator should invite only the minimum necessary set of agents. Huddles must still end in todo materialization or revision escalation.

### Exit C: Revision Loop

Use when the conclusion changes a formal source-of-truth artifact such as:

- `prd.md`
- `architecture.md`
- `ui-spec.md`
- `ui-design.json`
- `tech-review.md`
- `tasks.md`

This path should reuse the existing `record-feedback` and `RevisionRequested` machinery.

## Default Authority Rules

Any agent may ask, challenge, propose, or escalate. Final authority should default to the owner of the relevant source of truth:

- PM for requirement and acceptance intent
- Architect for architecture, API, and data contract decisions
- UI Designer for interaction and visual design decisions
- Scrum Master for task decomposition, write sets, and wave boundaries
- Tech Lead or QA for validation quality and release-readiness judgments, depending on the anchor

This keeps the system collaborative without letting every disagreement become endless arbitration.

## Agent Contract Changes

The shared agent protocol should be extended so that agents:

- may initiate execution conversations during active work
- must anchor each conversation to concrete work
- should prefer short evidence-backed messages
- must not treat a conversation as complete until follow-up is materialized
- should use revision loops only when the source of truth itself must change

The existing terminal status protocol remains necessary. Conversation output is additive, not a replacement for `DONE`, `BLOCKED`, `NEEDS_CONTEXT`, `DONE_WITH_CONCERNS`, or `REVISION_NEEDED`.

## CLI Surface

The runtime-first contract should expose conversation operations as first-class commands. Exact naming can change during implementation, but the design should support at least:

```bash
boss runtime open-conversation <feature> ...
boss runtime append-conversation-message <feature> ...
boss runtime resolve-conversation <feature> ...
boss runtime materialize-todo <feature> ...
boss runtime list-conversations <feature> ...
boss runtime list-todos <feature> ...
```

All commands should follow the existing Boss CLI contract:

- `--json`
- `--describe`
- `--dry-run`
- bounded output fields where appropriate

The first implementation should remain compatible with non-interactive orchestration and append-only event materialization.

## Memory and Reporting

Conversation outcomes are valuable operational memory. The memory layer should prefer storing:

- repeated conflict patterns
- recurring cross-role clarification needs
- unstable decision hotspots
- common derived todo categories

It should not prioritize verbatim message history.

Summary and diagnostics should surface:

- number of conversations opened
- number of huddles
- number of derived todos
- number of revision escalations
- unresolved threads at pipeline end

This would make multi-agent execution quality visible without flooding reports with low-signal chatter.

## Example Flows

### Example 1: QA Requests a Frontend Fix

1. QA opens a `request_change` thread anchored to a failing interaction path.
2. QA attaches test evidence and expected behavior.
3. Frontend replies with either acceptance or a challenge.
4. If they agree, the orchestrator materializes a frontend todo.
5. If the expected behavior conflicts with `ui-design.json`, the thread escalates into a revision request for the design artifact.

### Example 2: Frontend Challenges a UI Design Ambiguity

1. Frontend opens a `challenge` thread anchored to `decision: checkout error state`.
2. UI Designer responds with intent and constraints.
3. If the answer only clarifies interpretation, a frontend continuation todo is created.
4. If the clarification changes formal UI guidance, create:
   - a `boss-ui-designer` todo or revision to update `ui-spec.md` / `ui-design.json`
   - a `boss-frontend` follow-up todo to implement the updated decision

### Example 3: Backend Escalates into a Huddle

1. Backend challenges a contract that affects persistence and retry behavior.
2. Architect and QA disagree on whether the issue is architectural or purely validation-related.
3. Orchestrator auto-creates a small huddle with Backend, Architect, and QA.
4. The huddle resolves into:
   - one architecture update todo
   - one backend implementation todo
   - one QA verification todo

## Rollout Plan

The first implementation should be incremental:

1. Add runtime event types and schema support.
2. Materialize thread and todo state into feature metadata.
3. Add minimal runtime CLI commands for thread and todo operations.
4. Extend shared agent protocol and selected role prompts.
5. Update reporting and memory summarization.
6. Introduce orchestrator policies for direct todo materialization, huddle creation, and revision-loop escalation.

## Risks

- Too much transcript retention can blow up context and reports.
- Too little structure can turn conversations into untraceable side effects.
- Auto-huddle policies can become noisy if thresholds are too low.
- Derived todos can become a shadow backlog if they are not scheduled back into the main execution flow.

The design intentionally minimizes these risks by keeping messages short, anchoring every thread, and requiring materialized follow-up.

## Success Criteria

The design is successful when:

- agents can coordinate during execution without jumping directly to user intervention
- conversations feel more like real engineering teamwork
- every resolved discussion produces a deterministic execution outcome
- formal artifacts remain authoritative
- runtime inspection, replay, memory, and reports can explain what happened
