# Agent Execution Conversation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add an execution-time conversation layer so any agent can ask, challenge, propose, request changes, or huddle during work, and every resolved conversation ends in executable todo work or a formal revision loop.

**Architecture:** Keep documents as the formal source of truth, extend the runtime event/state model with conversation threads/messages/todos, expose conversation lifecycle commands through the existing Boss runtime surface, and update agent protocols so execution-time coordination is short, anchored, and always materialized into follow-up work.

**Tech Stack:** TypeScript, Node.js standard library, JSON Schema, Vitest, existing Boss CLI runtime modules, Markdown skill docs.

---

## File Structure

- Create `packages/boss-cli/src/runtime/domain/conversation-types.ts`: shared TypeScript types for threads, messages, anchors, resolutions, and derived todos.
- Modify `packages/boss-cli/src/runtime/domain/event-types.ts`: add conversation lifecycle events.
- Modify `packages/boss-cli/src/runtime/projectors/materialize-state.ts`: materialize conversations, messages, resolutions, todos, and metrics into execution state.
- Modify `packages/boss-cli/src/runtime/schema/event-schema.json`: validate the new conversation events.
- Modify `packages/boss-cli/src/runtime/schema/execution-schema.json`: require conversation-aware execution-state sections.
- Create `packages/boss-cli/src/runtime/application/conversations.ts`: runtime service for open / append / resolve / materialize / list operations.
- Modify `packages/boss-cli/src/runtime/application/pipeline.ts`: keep revision loops separate from conversation-to-todo flow and reuse existing feedback paths when a conversation escalates into a formal revision.
- Create `packages/boss-cli/src/commands/runtime/conversation-command-utils.ts`: shared parsing and response helpers for the new runtime commands.
- Create `packages/boss-cli/src/commands/runtime/open-conversation.ts`
- Create `packages/boss-cli/src/commands/runtime/append-conversation-message.ts`
- Create `packages/boss-cli/src/commands/runtime/resolve-conversation.ts`
- Create `packages/boss-cli/src/commands/runtime/materialize-todo.ts`
- Create `packages/boss-cli/src/commands/runtime/list-conversations.ts`
- Create `packages/boss-cli/src/commands/runtime/list-todos.ts`
- Modify `packages/boss-cli/src/cli/registry.ts`: register the new runtime commands.
- Modify `packages/boss-cli/src/cli/dispatcher.ts`: route the new runtime commands.
- Modify `skill/agents/shared/protocol-manifest.md`: add the conversation protocol to the shared prefix/index.
- Modify `skill/agents/shared/agent-protocol.md`: define the generic conversation primitives and todo materialization rules.
- Modify `skill/agents/prompts/subagent-protocol.md`: define how conversation results must close with actionable output.
- Modify `skill/agents/boss-architect.md`
- Modify `skill/agents/boss-backend.md`
- Modify `skill/agents/boss-devops.md`
- Modify `skill/agents/boss-frontend.md`
- Modify `skill/agents/boss-pm.md`
- Modify `skill/agents/boss-qa.md`
- Modify `skill/agents/boss-scrum-master.md`
- Modify `skill/agents/boss-tech-lead.md`
- Modify `skill/agents/boss-ui-designer.md`
- Modify `skill/references/bmad-methodology.md`: describe the execution conversation layer in the workflow reference.
- Modify `README.md`: surface the new execution-time conversation behavior in the workflow summary.
- Modify `DESIGN.md`: document the new thread/message/todo model and the escalation policy.
- Modify `packages/boss-cli/src/runtime/application/memory.ts`: keep execution-conversation outcomes in memory refresh paths.
- Modify `packages/boss-cli/src/runtime/memory/extractor.ts`: extract repeated conversation friction patterns.
- Modify `packages/boss-cli/src/runtime/memory/summarizer.ts`: summarize conversation hotspots instead of raw chat.
- Modify `packages/boss-cli/src/runtime/memory/query.ts`: allow querying conversation-derived memory records.
- Modify `packages/boss-cli/src/runtime/report/summary-model.ts`: expose conversation metrics and derived todos.
- Modify `packages/boss-cli/src/runtime/report/render-markdown.ts`: render conversation metrics in the final report.
- Modify `packages/boss-cli/src/runtime/report/render-json.ts`: include the conversation summary in JSON reports.
- Modify `packages/boss-cli/src/runtime/report/render-html.ts`: surface conversation metrics in diagnostics.
- Modify `packages/boss-cli/src/commands/runtime/inspect-pipeline.ts`: show open threads, derived todos, and unresolved huddles.
- Add tests under `test/runtime/`, `test/bin/`, and `test/runtime/docs-contract.test.ts` as described below.

## Task 1: Add Conversation State Primitives and Event Schema Support

**Files:**
- Create `packages/boss-cli/src/runtime/domain/conversation-types.ts`
- Modify `packages/boss-cli/src/runtime/domain/event-types.ts`
- Modify `packages/boss-cli/src/runtime/projectors/materialize-state.ts`
- Modify `packages/boss-cli/src/runtime/schema/event-schema.json`
- Modify `packages/boss-cli/src/runtime/schema/execution-schema.json`
- Modify `test/runtime/schema-contract.test.ts`
- Create `test/runtime/conversation-runtime.test.ts`

- [ ] **Step 1: Write the failing schema and state tests**

Add to `test/runtime/schema-contract.test.ts`:

```ts
it('documents the conversation event types and execution sections', () => {
  const eventSchema = loadJson('packages/boss-cli/src/runtime/schema/event-schema.json');
  const executionSchema = loadJson('packages/boss-cli/src/runtime/schema/execution-schema.json');

  expect(eventSchema.properties.type.enum).toEqual(
    expect.arrayContaining([
      'ConversationOpened',
      'ConversationMessageAppended',
      'ConversationResolved',
      'TodoMaterialized'
    ])
  );
  expect(executionSchema.required).toEqual(
    expect.arrayContaining(['conversations', 'derivedTodos', 'conversationMetrics'])
  );
});
```

Create `test/runtime/conversation-runtime.test.ts`:

```ts
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { initPipeline } from '../../packages/boss-cli/src/runtime/application/pipeline.js';
import { appendRuntimeEvent } from '../../packages/boss-cli/src/runtime/application/state.js';
import { EVENT_TYPES } from '../../packages/boss-cli/src/runtime/domain/event-types.js';
import { materializeState, defaultExecutionState } from '../../packages/boss-cli/src/runtime/projectors/materialize-state.js';
import { cleanupTempDir } from '../helpers/fixtures.js';

describe('conversation runtime model', () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'boss-conv-'));
  });

  afterEach(() => {
    cleanupTempDir(tmpDir);
  });

  it('includes empty conversation buckets in the default execution state', () => {
    expect(defaultExecutionState('test-feat')).toMatchObject({
      conversations: { threads: [], messages: [], resolutions: [] },
      derivedTodos: [],
      conversationMetrics: { opened: 0, resolved: 0, todos: 0, huddles: 0, unresolved: 0 }
    });
  });

  it('materializes opened threads, messages, resolutions, and todos from events', () => {
    initPipeline('test-feat', { cwd: tmpDir });
    appendRuntimeEvent(tmpDir, 'test-feat', EVENT_TYPES.CONVERSATION_OPENED, {
      thread: {
        id: 'conv-001',
        kind: 'request_change',
        anchor: { artifact: 'ui-design.json' },
        initiator: 'boss-qa',
        participants: ['boss-frontend'],
        status: 'open',
        priority: 'high',
        createdAt: '2026-05-18T00:00:00Z',
        updatedAt: '2026-05-18T00:00:00Z'
      }
    });
    appendRuntimeEvent(tmpDir, 'test-feat', EVENT_TYPES.CONVERSATION_MESSAGE_APPENDED, {
      message: {
        id: 'msg-001',
        threadId: 'conv-001',
        from: 'boss-qa',
        to: ['boss-frontend'],
        intent: 'objection',
        content: 'The loading state does not match the design contract.'
      }
    });
    appendRuntimeEvent(tmpDir, 'test-feat', EVENT_TYPES.CONVERSATION_RESOLVED, {
      resolution: {
        threadId: 'conv-001',
        summary: 'Agree to fix the loading state and keep the design contract intact',
        decision: 'request change',
        todos: [{ id: 'todo-001', owner: 'boss-frontend', title: 'Fix loading state' }]
      }
    });
    appendRuntimeEvent(tmpDir, 'test-feat', EVENT_TYPES.TODO_MATERIALIZED, {
      todo: { id: 'todo-001', owner: 'boss-frontend', title: 'Fix loading state', status: 'pending' }
    });

    const { state } = materializeState('test-feat', tmpDir);
    expect(state.conversations.threads).toHaveLength(1);
    expect(state.conversations.messages).toHaveLength(1);
    expect(state.conversations.resolutions).toHaveLength(1);
    expect(state.derivedTodos).toHaveLength(1);
    expect(state.conversationMetrics).toMatchObject({ opened: 1, resolved: 1, todos: 1 });
  });
});
```

- [ ] **Step 2: Run the RED tests**

Run:

```bash
npm test -- test/runtime/schema-contract.test.ts test/runtime/conversation-runtime.test.ts -t "conversation"
```

Expected: FAIL because the conversation event types and execution-state sections do not exist yet.

- [ ] **Step 3: Implement the shared conversation types and projector updates**

Create `packages/boss-cli/src/runtime/domain/conversation-types.ts`:

```ts
export interface ConversationAnchor {
  artifact?: string;
  task?: string;
  scope?: string;
  decision?: string;
}

export interface ConversationThread {
  id: string;
  kind: 'ask' | 'challenge' | 'propose' | 'request_change' | 'escalate' | 'huddle';
  anchor: ConversationAnchor;
  initiator: string;
  participants: string[];
  status: 'open' | 'discussing' | 'converged' | 'materialized' | 'closed';
  priority: 'low' | 'medium' | 'high' | 'critical';
  createdAt: string;
  updatedAt: string;
}

export interface ConversationMessage {
  id: string;
  threadId: string;
  from: string;
  to: string[];
  intent: 'question' | 'objection' | 'proposal' | 'evidence' | 'decision';
  content: string;
  evidence?: Array<{ type: 'artifact' | 'file' | 'test'; ref: string }>;
  createdAt: string;
}

export interface ConversationResolution {
  threadId: string;
  summary: string;
  decision: string;
  todos: Array<{ id: string; owner: string; title: string; status: 'pending' | 'queued' | 'in_progress' }>;
  createdAt: string;
}

export interface DerivedTodo {
  id: string;
  sourceThreadId: string;
  title: string;
  owner: string;
  type: 'change' | 'clarify' | 'verify' | 'doc_update' | 'followup';
  status: 'pending' | 'queued' | 'in_progress' | 'done' | 'blocked' | 'cancelled';
  successCriteria: string[];
  impact: { artifacts: string[]; scope: string[] };
  dispatchHint: { stage: number; agent: string };
  createdAt: string;
}
```

Update `packages/boss-cli/src/runtime/domain/event-types.ts` with the four new event names.

Update `packages/boss-cli/src/runtime/projectors/materialize-state.ts` to add reducer cases such as:

```ts
case EVENT_TYPES.CONVERSATION_OPENED: {
  state.conversations.threads = upsertThread(state.conversations.threads, event.data.thread);
  state.conversationMetrics.opened += 1;
  return state;
}

case EVENT_TYPES.CONVERSATION_MESSAGE_APPENDED: {
  state.conversations.messages = state.conversations.messages.concat(event.data.message);
  return state;
}

case EVENT_TYPES.CONVERSATION_RESOLVED: {
  state.conversations.resolutions = state.conversations.resolutions.concat(event.data.resolution);
  state.conversations.threads = closeThread(state.conversations.threads, event.data.resolution.threadId);
  state.conversationMetrics.resolved += 1;
  return state;
}

case EVENT_TYPES.TODO_MATERIALIZED: {
  state.derivedTodos = state.derivedTodos.concat(event.data.todo);
  state.conversationMetrics.todos += 1;
  return state;
}
```

Extend the execution-state defaults so `conversations`, `derivedTodos`, and `conversationMetrics` are always present.

Update the JSON schemas so the execution file requires those sections and the event schema validates the new event types.

- [ ] **Step 4: Re-run the schema and runtime tests**

Run:

```bash
npm test -- test/runtime/schema-contract.test.ts test/runtime/conversation-runtime.test.ts -t "conversation"
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add packages/boss-cli/src/runtime/domain/conversation-types.ts \
  packages/boss-cli/src/runtime/domain/event-types.ts \
  packages/boss-cli/src/runtime/projectors/materialize-state.ts \
  packages/boss-cli/src/runtime/schema/event-schema.json \
  packages/boss-cli/src/runtime/schema/execution-schema.json \
  test/runtime/schema-contract.test.ts \
  test/runtime/conversation-runtime.test.ts
git commit -m "feat(runtime): add conversation state primitives"
```

## Task 2: Build the Conversation Runtime Service

**Files:**
- Create `packages/boss-cli/src/runtime/application/conversations.ts`
- Modify `packages/boss-cli/src/runtime/application/pipeline.ts`
- Modify `packages/boss-cli/src/runtime/application/state.ts` if new helper exports are needed
- Modify `test/runtime/conversation-runtime.test.ts`

- [ ] **Step 1: Add failing service tests**

Extend `test/runtime/conversation-runtime.test.ts` with:

```ts
import {
  openConversation,
  appendConversationMessage,
  resolveConversation,
  listConversations,
  listTodos
} from '../../packages/boss-cli/src/runtime/application/conversations.js';

it('opens, resolves, and materializes a conversation thread', () => {
  initPipeline('test-feat', { cwd: tmpDir });

  const opened = openConversation('test-feat', {
    kind: 'request_change',
    anchor: { scope: 'src/app/checkout/page.tsx' },
    initiator: 'boss-qa',
    participants: ['boss-frontend'],
    priority: 'high'
  }, { cwd: tmpDir });

  appendConversationMessage('test-feat', {
    threadId: opened.threadId,
    from: 'boss-qa',
    to: ['boss-frontend'],
    intent: 'objection',
    content: 'The loading state leaks a second click.'
  }, { cwd: tmpDir });

  const resolved = resolveConversation('test-feat', {
    threadId: opened.threadId,
    summary: 'Fix the loading state and keep the UI locked until the request finishes',
    decision: 'request change',
    todos: [
      {
        title: 'Disable the checkout button while loading',
        owner: 'boss-frontend',
        type: 'change',
        successCriteria: ['button stays disabled during loading', 'existing tests still pass']
      }
    ]
  }, { cwd: tmpDir });

  expect(resolved.todos).toHaveLength(1);
  expect(listConversations('test-feat', { cwd: tmpDir })).toHaveLength(1);
  expect(listTodos('test-feat', { cwd: tmpDir })).toHaveLength(1);
});
```

- [ ] **Step 2: Run the RED test**

Run:

```bash
npm test -- test/runtime/conversation-runtime.test.ts -t "opens, resolves, and materializes"
```

Expected: FAIL because `packages/boss-cli/src/runtime/application/conversations.ts` does not exist yet.

- [ ] **Step 3: Implement the runtime service**

Create `packages/boss-cli/src/runtime/application/conversations.ts`:

```ts
export function openConversation(feature: string, input: OpenConversationInput, { cwd = process.cwd() } = {}) {
  const thread = buildThread(feature, input);
  appendRuntimeEvent(cwd, feature, EVENT_TYPES.CONVERSATION_OPENED, { thread });
  const { state } = materializeState(feature, cwd);
  refreshMemory(feature, cwd);
  return { feature, threadId: thread.id, status: state.conversations.threads.at(-1)?.status ?? 'open' };
}

export function appendConversationMessage(feature: string, input: AppendMessageInput, { cwd = process.cwd() } = {}) {
  appendRuntimeEvent(cwd, feature, EVENT_TYPES.CONVERSATION_MESSAGE_APPENDED, { message: buildMessage(input) });
  const { state } = materializeState(feature, cwd);
  refreshMemory(feature, cwd);
  return { feature, threadId: input.threadId, messageCount: state.conversations.messages.length };
}

export function resolveConversation(feature: string, input: ResolveConversationInput, { cwd = process.cwd() } = {}) {
  const resolution = buildResolution(input);
  appendRuntimeEvent(cwd, feature, EVENT_TYPES.CONVERSATION_RESOLVED, { resolution });
  for (const todo of resolution.todos) {
    appendRuntimeEvent(cwd, feature, EVENT_TYPES.TODO_MATERIALIZED, { todo: buildTodo(input.threadId, todo) });
  }
  const { state } = materializeState(feature, cwd);
  refreshMemory(feature, cwd);
  return { feature, threadId: input.threadId, todos: state.derivedTodos.filter((todo) => todo.sourceThreadId === input.threadId) };
}
```

When the resolution needs a formal source-of-truth change, call the existing `recordFeedback` path from `packages/boss-cli/src/runtime/application/pipeline.ts` instead of inventing a second revision system.

Keep the orchestrator policy in this module simple:

- direct todo materialization when the action is clear
- huddle recommendation when the thread is still conflicted and has multiple owners
- revision escalation when the source of truth itself must change

Implement `listConversations` and `listTodos` as thin readers over the materialized execution state so the runtime commands can emit stable JSON and text output.

- [ ] **Step 4: Re-run the runtime service tests**

Run:

```bash
npm test -- test/runtime/conversation-runtime.test.ts -t "opens, resolves, and materializes"
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add packages/boss-cli/src/runtime/application/conversations.ts \
  packages/boss-cli/src/runtime/application/pipeline.ts \
  packages/boss-cli/src/runtime/application/state.ts \
  test/runtime/conversation-runtime.test.ts
git commit -m "feat(runtime): add conversation service"
```

## Task 3: Expose Conversation Lifecycle Commands in the Runtime CLI

**Files:**
- Create `packages/boss-cli/src/commands/runtime/conversation-command-utils.ts`
- Create `packages/boss-cli/src/commands/runtime/open-conversation.ts`
- Create `packages/boss-cli/src/commands/runtime/append-conversation-message.ts`
- Create `packages/boss-cli/src/commands/runtime/resolve-conversation.ts`
- Create `packages/boss-cli/src/commands/runtime/materialize-todo.ts`
- Create `packages/boss-cli/src/commands/runtime/list-conversations.ts`
- Create `packages/boss-cli/src/commands/runtime/list-todos.ts`
- Modify `packages/boss-cli/src/cli/registry.ts`
- Modify `packages/boss-cli/src/cli/dispatcher.ts`
- Modify `test/runtime/runtime-cli-contract.test.ts`
- Modify `test/bin/boss-skill.test.ts`

- [ ] **Step 1: Write the failing CLI contract tests**

Add to `test/runtime/runtime-cli-contract.test.ts`:

```ts
it('conversation runtime commands expose describe metadata', () => {
  for (const name of [
    'open-conversation',
    'append-conversation-message',
    'resolve-conversation',
    'materialize-todo',
    'list-conversations',
    'list-todos'
  ]) {
    const result = runCli(name, ['--describe']);
    expect(result.status, name).toBe(0);

    const payload = JSON.parse(result.stdout) as {
      command: string;
      options: Array<{ name: string }>;
    };
    expect(payload.command).toBe(`boss runtime ${name}`);
    expect(payload.options.map((option) => option.name)).toContain('json');
  }
});
```

Add to `test/bin/boss-skill.test.ts`:

```ts
it('shows the new conversation runtime commands in built help', () => {
  const result = runCli(['packages/boss-cli/dist/bin/boss.js', 'runtime', '--help']);
  expect(result.status).toBe(0);
  expect(result.stdout).toContain('open-conversation');
  expect(result.stdout).toContain('resolve-conversation');
  expect(result.stdout).toContain('list-todos');
});
```

- [ ] **Step 2: Run the RED CLI tests**

Run:

```bash
npm test -- test/runtime/runtime-cli-contract.test.ts test/bin/boss-skill.test.ts -t "conversation"
```

Expected: FAIL because the runtime command registry does not know about the conversation commands yet.

- [ ] **Step 3: Implement the command helpers and thin wrappers**

Create `packages/boss-cli/src/commands/runtime/conversation-command-utils.ts` with shared parsing for anchors, participants, and JSON-input payloads. Keep the helpers small so the six commands can share one parser style.

Implement the command files as thin adapters. Each command should:

- parse `--json`, `--describe`, `--dry-run`, and `--json-input`
- validate feature, thread ID, and anchor fields
- call the corresponding function from `packages/boss-cli/src/runtime/application/conversations.ts`
- write either a human-readable summary or a stable JSON payload

Use this command shape for `open-conversation.ts`:

```ts
export function main(argv: string[] = process.argv.slice(2), { cwd = process.cwd() } = {}): number {
  const context = createCliContext(argv, { command: 'boss runtime open-conversation' });
  const input = resolveOpenConversationInput(argv, context);
  if (context.values.dryRun) {
    writeActionPlan([{ type: 'open_conversation', feature: input.feature, writes_event: true }], context, 'medium');
    return 0;
  }

  const payload = openConversation(input.feature, input, { cwd });
  writeOutput(payload, context, () => `${JSON.stringify(payload, null, 2)}\n`);
  return 0;
}
```

Add the new command names to `packages/boss-cli/src/cli/registry.ts`, then route them from `packages/boss-cli/src/cli/dispatcher.ts` into the new command modules.

- [ ] **Step 4: Re-run the CLI tests**

Run:

```bash
npm test -- test/runtime/runtime-cli-contract.test.ts test/bin/boss-skill.test.ts -t "conversation"
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add packages/boss-cli/src/commands/runtime/conversation-command-utils.ts \
  packages/boss-cli/src/commands/runtime/open-conversation.ts \
  packages/boss-cli/src/commands/runtime/append-conversation-message.ts \
  packages/boss-cli/src/commands/runtime/resolve-conversation.ts \
  packages/boss-cli/src/commands/runtime/materialize-todo.ts \
  packages/boss-cli/src/commands/runtime/list-conversations.ts \
  packages/boss-cli/src/commands/runtime/list-todos.ts \
  packages/boss-cli/src/cli/registry.ts \
  packages/boss-cli/src/cli/dispatcher.ts \
  test/runtime/runtime-cli-contract.test.ts \
  test/bin/boss-skill.test.ts
git commit -m "feat(cli): expose conversation runtime commands"
```

## Task 4: Update Agent Protocols and Role Prompts

**Files:**
- Modify `skill/agents/shared/protocol-manifest.md`
- Modify `skill/agents/shared/agent-protocol.md`
- Modify `skill/agents/prompts/subagent-protocol.md`
- Modify `skill/agents/boss-architect.md`
- Modify `skill/agents/boss-backend.md`
- Modify `skill/agents/boss-devops.md`
- Modify `skill/agents/boss-frontend.md`
- Modify `skill/agents/boss-pm.md`
- Modify `skill/agents/boss-qa.md`
- Modify `skill/agents/boss-scrum-master.md`
- Modify `skill/agents/boss-tech-lead.md`
- Modify `skill/agents/boss-ui-designer.md`
- Modify `skill/references/bmad-methodology.md`
- Modify `README.md`
- Modify `DESIGN.md`
- Modify `test/runtime/docs-contract.test.ts`

- [ ] **Step 1: Write the failing documentation contract tests**

Add to `test/runtime/docs-contract.test.ts`:

```ts
it('documents execution conversation primitives in the shared agent protocol', () => {
  expect(sharedAgentProtocol).toContain('ask');
  expect(sharedAgentProtocol).toContain('challenge');
  expect(sharedAgentProtocol).toContain('request_change');
  expect(sharedAgentProtocol).toContain('single owner');
  expect(sharedAgentProtocol).toContain('Todo');
});

it('documents conversation anchoring and materialization in the subagent protocol', () => {
  expect(subagentProtocol).toContain('anchor');
  expect(subagentProtocol).toContain('materialized');
  expect(subagentProtocol).toContain('REVISION_REQUESTED');
  expect(subagentProtocol).toContain('todo');
});
```

Add one prompt-level contract per representative role prompt:

```ts
it('documents conversation escalation behavior in the QA prompt', () => {
  expect(qaAgent).toContain('request_change');
  expect(qaAgent).toContain('huddle');
  expect(qaAgent).toContain('todo');
});
```

- [ ] **Step 2: Run the RED docs tests**

Run:

```bash
npm test -- test/runtime/docs-contract.test.ts -t "conversation"
```

Expected: FAIL because the shared protocol and agent prompts do not mention the execution conversation layer yet.

- [ ] **Step 3: Update the shared protocol and the agent prompts**

Extend `skill/agents/shared/agent-protocol.md` with three rules:

```md
- Any agent may open an execution conversation with any other agent.
- Every conversation must be anchored to an artifact, task, scope, or decision.
- Every resolved conversation must end in at least one executable todo or a formal revision loop.
```

Extend `skill/agents/prompts/subagent-protocol.md` so final reports include:

```md
- conversation_id
- resolution_summary
- todo_ids
- revision_target when the thread escalates to a formal revision
```

Update the role prompts that most often need execution-time coordination so they reference the same conversation primitives and the same single-owner todo rule. Keep the changes short and consistent across roles.

Update `skill/references/bmad-methodology.md`, `README.md`, and `DESIGN.md` to describe the execution conversation layer in the workflow and artifact sections.

- [ ] **Step 4: Re-run the docs contract tests**

Run:

```bash
npm test -- test/runtime/docs-contract.test.ts -t "conversation"
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add skill/agents/shared/protocol-manifest.md \
  skill/agents/shared/agent-protocol.md \
  skill/agents/prompts/subagent-protocol.md \
  skill/agents/boss-architect.md \
  skill/agents/boss-backend.md \
  skill/agents/boss-devops.md \
  skill/agents/boss-frontend.md \
  skill/agents/boss-pm.md \
  skill/agents/boss-qa.md \
  skill/agents/boss-scrum-master.md \
  skill/agents/boss-tech-lead.md \
  skill/agents/boss-ui-designer.md \
  skill/references/bmad-methodology.md \
  README.md \
  DESIGN.md \
  test/runtime/docs-contract.test.ts
git commit -m "docs(skill): add execution conversation protocol"
```

## Task 5: Surface Conversation Metrics in Memory and Reports

**Files:**
- Modify `packages/boss-cli/src/runtime/application/memory.ts`
- Modify `packages/boss-cli/src/runtime/memory/extractor.ts`
- Modify `packages/boss-cli/src/runtime/memory/summarizer.ts`
- Modify `packages/boss-cli/src/runtime/memory/query.ts`
- Modify `packages/boss-cli/src/runtime/report/summary-model.ts`
- Modify `packages/boss-cli/src/runtime/report/render-markdown.ts`
- Modify `packages/boss-cli/src/runtime/report/render-json.ts`
- Modify `packages/boss-cli/src/runtime/report/render-html.ts`
- Modify `packages/boss-cli/src/commands/runtime/inspect-pipeline.ts`
- Modify `test/runtime/memory-runtime.integration.test.ts`
- Modify `test/runtime/report-runtime.test.ts`

- [ ] **Step 1: Write the failing memory and report tests**

Add to `test/runtime/memory-runtime.integration.test.ts`:

```ts
it('promotes repeated conversation friction into memory', () => {
  const { memoryRuntime } = await loadModules();

  memoryRuntime.writeFeatureMemory('feat-a', [
    { category: 'conversation_pattern', scope: 'feature', summary: 'QA challenged frontend loading state', ...baseRecord }
  ]);
  memoryRuntime.writeFeatureMemory('feat-b', [
    { category: 'conversation_pattern', scope: 'feature', summary: 'QA challenged frontend loading state again', ...baseRecord }
  ]);

  memoryRuntime.rebuildGlobalMemory({ cwd: tmpDir });
  const globalMemory = memoryRuntime.readGlobalMemory({ cwd: tmpDir });
  expect(globalMemory.records.some((record) => record.category === 'conversation_pattern')).toBe(true);
});
```

Add to `test/runtime/report-runtime.test.ts`:

```ts
it('includes conversation metrics in the summary model and markdown output', () => {
  const model = buildSummaryModel('test-feat', { cwd: tmpDir });
  expect(model.conversationMetrics.opened).toBeGreaterThanOrEqual(0);
  expect(model.derivedTodos).toBeDefined();

  const markdown = renderMarkdown(model);
  expect(markdown).toContain('执行协作');
  expect(markdown).toContain('conversation');
});
```

- [ ] **Step 2: Run the RED memory and report tests**

Run:

```bash
npm test -- test/runtime/memory-runtime.integration.test.ts test/runtime/report-runtime.test.ts -t "conversation"
```

Expected: FAIL because the memory layer and summary model do not track execution conversation outcomes yet.

- [ ] **Step 3: Implement memory and report integration**

Teach `packages/boss-cli/src/runtime/memory/extractor.ts` and `packages/boss-cli/src/runtime/memory/summarizer.ts` to prefer conversation patterns such as repeated `challenge` / `request_change` conflicts, huddle frequency, and unresolved thread hotspots.

Update `packages/boss-cli/src/runtime/application/memory.ts` so rebuilding feature memory can read the conversation-aware execution state and surface those records without copying full transcript text.

Extend `packages/boss-cli/src/runtime/report/summary-model.ts` with fields like:

```ts
conversationMetrics: {
  opened: number;
  resolved: number;
  todos: number;
  huddles: number;
  unresolved: number;
};
derivedTodos: Array<{ id: string; owner: string; status: string; title: string }>;
```

Render those fields in `render-markdown.ts`, `render-json.ts`, and `render-html.ts`, and expose the same numbers in `inspect-pipeline.ts`.

- [ ] **Step 4: Re-run the memory and report tests**

Run:

```bash
npm test -- test/runtime/memory-runtime.integration.test.ts test/runtime/report-runtime.test.ts -t "conversation"
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add packages/boss-cli/src/runtime/application/memory.ts \
  packages/boss-cli/src/runtime/memory/extractor.ts \
  packages/boss-cli/src/runtime/memory/summarizer.ts \
  packages/boss-cli/src/runtime/memory/query.ts \
  packages/boss-cli/src/runtime/report/summary-model.ts \
  packages/boss-cli/src/runtime/report/render-markdown.ts \
  packages/boss-cli/src/runtime/report/render-json.ts \
  packages/boss-cli/src/runtime/report/render-html.ts \
  packages/boss-cli/src/commands/runtime/inspect-pipeline.ts \
  test/runtime/memory-runtime.integration.test.ts \
  test/runtime/report-runtime.test.ts
git commit -m "feat(report): surface conversation metrics"
```

## Task 6: Add End-to-End Coverage and Final Regression Checks

**Files:**
- Create `test/runtime/conversation-flow.integration.test.ts`
- Modify `test/runtime/runtime-cli-contract.test.ts`
- Modify `test/bin/boss-skill.test.ts`
- Modify `test/runtime/docs-contract.test.ts` if any final string pins are still missing

- [ ] **Step 1: Write the end-to-end flow test**

Create `test/runtime/conversation-flow.integration.test.ts`:

```ts
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { initPipeline } from '../../packages/boss-cli/src/runtime/application/pipeline.js';
import { openConversation, appendConversationMessage, resolveConversation } from '../../packages/boss-cli/src/runtime/application/conversations.js';
import { materializeState } from '../../packages/boss-cli/src/runtime/projectors/materialize-state.js';
import { cleanupTempDir } from '../helpers/fixtures.js';

describe('conversation flow integration', () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'boss-conv-flow-'));
  });

  afterEach(() => cleanupTempDir(tmpDir));

  it('opens a conversation, resolves it, and exposes the resulting todo', () => {
    initPipeline('checkout-flow', { cwd: tmpDir });

    const opened = openConversation('checkout-flow', {
      kind: 'challenge',
      anchor: { decision: 'checkout error state' },
      initiator: 'boss-qa',
      participants: ['boss-frontend', 'boss-tech-lead'],
      priority: 'high'
    }, { cwd: tmpDir });

    appendConversationMessage('checkout-flow', {
      threadId: opened.threadId,
      from: 'boss-frontend',
      to: ['boss-qa', 'boss-tech-lead'],
      intent: 'proposal',
      content: 'Keep the current layout and only adjust the error message copy.'
    }, { cwd: tmpDir });

    resolveConversation('checkout-flow', {
      threadId: opened.threadId,
      summary: 'Update the error copy and keep the current layout',
      decision: 'request change',
      todos: [
        {
          title: 'Update checkout error copy',
          owner: 'boss-frontend',
          type: 'doc_update',
          successCriteria: ['copy matches the design contract', 'existing tests pass']
        }
      ]
    }, { cwd: tmpDir });

    const { state } = materializeState('checkout-flow', tmpDir);
    expect(state.conversations.threads[0]?.status).toBe('closed');
    expect(state.derivedTodos[0]?.owner).toBe('boss-frontend');
  });
});
```

- [ ] **Step 2: Run the integration test**

Run:

```bash
npm test -- test/runtime/conversation-flow.integration.test.ts -t "opens a conversation"
```

Expected: FAIL until the runtime service and CLI surface are fully wired together.

- [ ] **Step 3: Tighten the final command and docs regressions**

Add any last contract pins needed in `test/runtime/runtime-cli-contract.test.ts`, `test/bin/boss-skill.test.ts`, and `test/runtime/docs-contract.test.ts` so the final build clearly exposes:

- the runtime command names
- the conversation protocol language
- the conversation metrics in reports
- the single-owner todo rule

- [ ] **Step 4: Run the full targeted suite**

Run:

```bash
npm run build && npm test -- \
  test/runtime/schema-contract.test.ts \
  test/runtime/conversation-runtime.test.ts \
  test/runtime/conversation-flow.integration.test.ts \
  test/runtime/runtime-cli-contract.test.ts \
  test/runtime/docs-contract.test.ts \
  test/runtime/memory-runtime.integration.test.ts \
  test/runtime/report-runtime.test.ts \
  test/bin/boss-skill.test.ts
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add test/runtime/conversation-flow.integration.test.ts \
  test/runtime/runtime-cli-contract.test.ts \
  test/runtime/docs-contract.test.ts \
  test/runtime/memory-runtime.integration.test.ts \
  test/runtime/report-runtime.test.ts \
  test/bin/boss-skill.test.ts
git commit -m "test(runtime): cover execution conversation flow"
```

## Spec Coverage Check

- Conversation primitives, anchors, state machine, and derived todo model: Tasks 1-2.
- Runtime events, execution state, and materialization flow: Tasks 1-2.
- CLI commands, registry, and dispatch surface: Task 3.
- Shared protocol, subagent protocol, and role prompt updates: Task 4.
- Memory, summary, diagnostics, and reporting: Task 5.
- End-to-end integration, docs pins, and final regression coverage: Task 6.

## Risks and Guardrails

- Keep messages short and anchored; do not copy full transcripts into memory or reports.
- Keep `revisionRequests` reserved for formal source-of-truth changes; do not overload it with every conversation.
- Keep todos single-owner so the runtime queue stays deterministic.
- Use huddles only when the disagreement affects multiple owners or the current wave boundary.
- If the implementation starts to feel like a ticketing product, stop and trim scope back to the minimal runtime state and CLI surface.

## Execution Handoff

Plan complete and saved to `docs/superpowers/plans/2026-05-18-agent-execution-conversation.md`. Two execution options:

**1. Subagent-Driven (recommended)** - I dispatch a fresh subagent per task, review between tasks, fast iteration

**2. Inline Execution** - Execute tasks in this session using executing-plans, batch execution with checkpoints

Which approach?
