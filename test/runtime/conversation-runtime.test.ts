import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import {
  appendConversationMessage,
  listConversations,
  listTodos,
  openConversation,
  resolveConversation
} from '../../packages/boss-cli/src/runtime/application/conversations.js';
import { initPipeline } from '../../packages/boss-cli/src/runtime/application/pipeline.js';
import { appendRuntimeEvent } from '../../packages/boss-cli/src/runtime/application/state.js';
import { EVENT_TYPES } from '../../packages/boss-cli/src/runtime/domain/event-types.js';
import {
  materializeState,
  defaultExecutionState
} from '../../packages/boss-cli/src/runtime/projectors/materialize-state.js';
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

  it('opens, resolves, and materializes a conversation thread', () => {
    initPipeline('test-feat', { cwd: tmpDir });

    const opened = openConversation('test-feat', {
      kind: 'request_change',
      anchor: { scope: 'src/app/checkout/page.tsx' },
      initiator: 'boss-qa',
      participants: ['boss-frontend'],
      priority: 'high'
    }, { cwd: tmpDir });

    const appended = appendConversationMessage('test-feat', {
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

    expect(opened.status).toBe('open');
    expect(appended.messageCount).toBe(1);
    expect(resolved.todos).toHaveLength(1);
    expect(resolved.todos[0]).toMatchObject({
      owner: 'boss-frontend',
      sourceThreadId: opened.threadId,
      title: 'Disable the checkout button while loading'
    });
    expect(listConversations('test-feat', { cwd: tmpDir })).toHaveLength(1);
    expect(listTodos('test-feat', { cwd: tmpDir })).toHaveLength(1);
  });

  it('escalates formal source-of-truth changes through revision requests', () => {
    initPipeline('test-feat', { cwd: tmpDir });

    const opened = openConversation('test-feat', {
      kind: 'challenge',
      anchor: { artifact: 'architecture.md' },
      initiator: 'boss-backend',
      participants: ['boss-architect'],
      priority: 'high'
    }, { cwd: tmpDir });

    const resolved = resolveConversation('test-feat', {
      threadId: opened.threadId,
      summary: 'The architecture contract must be updated before implementation continues',
      decision: 'revise architecture doc',
      escalation: {
        artifact: 'architecture.md',
        from: 'boss-backend',
        to: 'boss-architect',
        reason: 'The callback contract needs a formal source-of-truth update.',
        priority: 'critical'
      }
    }, { cwd: tmpDir });

    const { state } = materializeState('test-feat', tmpDir);
    expect(resolved.escalation).toMatchObject({
      artifact: 'architecture.md',
      from: 'boss-backend',
      to: 'boss-architect',
      priority: 'critical'
    });
    expect(resolved.todos).toHaveLength(0);
    expect(state.revisionRequests).toHaveLength(1);
    expect(state.revisionRequests[0]).toMatchObject({
      artifact: 'architecture.md',
      from: 'boss-backend',
      to: 'boss-architect',
      reason: 'The callback contract needs a formal source-of-truth update.',
      priority: 'critical'
    });
    expect(state.derivedTodos).toHaveLength(0);
    expect(listTodos('test-feat', { cwd: tmpDir })).toHaveLength(0);
  });
});
