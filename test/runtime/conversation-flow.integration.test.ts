import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import {
  appendConversationMessage,
  materializeTodo,
  openConversation,
  resolveConversation
} from '../../packages/boss-cli/src/runtime/application/conversations.js';
import { initPipeline } from '../../packages/boss-cli/src/runtime/application/pipeline.js';
import { materializeState } from '../../packages/boss-cli/src/runtime/projectors/materialize-state.js';
import { cleanupTempDir } from '../helpers/fixtures.js';

describe('conversation flow integration', () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'boss-conv-flow-'));
  });

  afterEach(() => {
    cleanupTempDir(tmpDir);
  });

  it('opens a conversation, materializes todos, and exposes the resulting execution state', () => {
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

    materializeTodo('checkout-flow', {
      threadId: opened.threadId,
      title: 'Update checkout error copy',
      owner: 'boss-frontend',
      type: 'doc_update',
      successCriteria: ['copy matches the design contract', 'existing tests pass']
    }, { cwd: tmpDir });

    resolveConversation('checkout-flow', {
      threadId: opened.threadId,
      summary: 'Update the error copy and keep the current layout',
      decision: 'request change',
      todos: [
        {
          title: 'Verify checkout error copy in QA',
          owner: 'boss-qa',
          type: 'verify',
          successCriteria: ['qa confirms the updated copy']
        }
      ]
    }, { cwd: tmpDir });

    const { state } = materializeState('checkout-flow', tmpDir);
    expect(state.conversations.threads[0]?.status).toBe('closed');
    expect(state.conversationMetrics).toMatchObject({
      opened: 1,
      resolved: 1,
      todos: 2
    });
    expect(state.derivedTodos.map((todo) => todo.owner)).toEqual(
      expect.arrayContaining(['boss-frontend', 'boss-qa'])
    );
  });
});
