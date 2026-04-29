import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {
  initPipeline,
  updateStage,
  updateAgent,
  recordFeedback,
  retryAgent,
  retryStage
} from '../../src/runtime/cli/lib/pipeline-runtime.js';

describe('recordFeedback', () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'boss-fb-'));
    initPipeline('test-feat', { cwd: tmpDir });
    updateStage('test-feat', 1, 'running', { cwd: tmpDir });
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it('records a revision request and increments round', () => {
    const state = recordFeedback('test-feat', {
      from: 'boss-tech-lead', to: 'boss-architect',
      artifact: 'architecture.md', reason: '缺少缓存策略',
      cwd: tmpDir
    });
    expect(state.feedbackLoops.currentRound).toBe(1);
    expect(state.revisionRequests).toHaveLength(1);
    expect(state.revisionRequests[0].from).toBe('boss-tech-lead');
  });

  it('rejects when max rounds reached', () => {
    recordFeedback('test-feat', {
      from: 'boss-tech-lead', to: 'boss-architect',
      artifact: 'architecture.md', reason: 'round 1', cwd: tmpDir
    });
    recordFeedback('test-feat', {
      from: 'boss-qa', to: 'boss-backend',
      artifact: 'code', reason: 'round 2', cwd: tmpDir
    });
    expect(() => recordFeedback('test-feat', {
      from: 'boss-qa', to: 'boss-frontend',
      artifact: 'code', reason: 'round 3', cwd: tmpDir
    })).toThrow(/已达上限/);
  });

  it('event data includes priority field', () => {
    recordFeedback('test-feat', {
      from: 'boss-tech-lead', to: 'boss-architect',
      artifact: 'architecture.md', reason: '安全问题',
      priority: 'critical', cwd: tmpDir
    });
    const eventsPath = path.join(tmpDir, '.boss', 'test-feat', '.meta', 'events.jsonl');
    const events = fs.readFileSync(eventsPath, 'utf8').trim().split('\n')
      .map(line => JSON.parse(line))
      .filter(e => e.type === 'RevisionRequested');
    expect(events[0].data.priority).toBe('critical');
  });
});

describe('retryAgent', () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'boss-retry-a-'));
    initPipeline('test-feat', { cwd: tmpDir });
    updateStage('test-feat', 3, 'running', { cwd: tmpDir });
    updateAgent('test-feat', 3, 'boss-qa', 'running', { cwd: tmpDir });
    updateAgent('test-feat', 3, 'boss-qa', 'failed', { cwd: tmpDir, reason: 'test failure' });
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it('retries a failed agent and increments retryCount', () => {
    const state = retryAgent('test-feat', 3, 'boss-qa', { cwd: tmpDir });
    const agent = state.stages['3']?.agents?.['boss-qa'];
    expect(agent?.status).toBe('running');
    expect(agent?.retryCount).toBe(1);
  });

  it('rejects retry of non-failed agent', () => {
    retryAgent('test-feat', 3, 'boss-qa', { cwd: tmpDir }); // now running
    expect(() => retryAgent('test-feat', 3, 'boss-qa', { cwd: tmpDir }))
      .toThrow(/只有 failed 状态可以重试/);
  });

  it('rejects when max retries reached', () => {
    // retry 1
    retryAgent('test-feat', 3, 'boss-qa', { cwd: tmpDir });
    updateAgent('test-feat', 3, 'boss-qa', 'failed', { cwd: tmpDir });
    // retry 2
    retryAgent('test-feat', 3, 'boss-qa', { cwd: tmpDir });
    updateAgent('test-feat', 3, 'boss-qa', 'failed', { cwd: tmpDir });
    // retry 3 should fail (default maxRetries=2)
    expect(() => retryAgent('test-feat', 3, 'boss-qa', { cwd: tmpDir }))
      .toThrow(/已达最大重试次数/);
  });
});

describe('retryStage', () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'boss-retry-s-'));
    initPipeline('test-feat', { cwd: tmpDir });
    updateStage('test-feat', 3, 'running', { cwd: tmpDir });
    updateStage('test-feat', 3, 'failed', { cwd: tmpDir });
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it('retries a failed stage and increments retryCount', () => {
    const state = retryStage('test-feat', 3, { cwd: tmpDir });
    expect(state.stages['3']?.status).toBe('running');
    expect(state.stages['3']?.retryCount).toBe(1);
  });

  it('rejects retry of non-failed stage', () => {
    retryStage('test-feat', 3, { cwd: tmpDir }); // now running
    expect(() => retryStage('test-feat', 3, { cwd: tmpDir }))
      .toThrow(/只有 failed 状态可以重试/);
  });
});
