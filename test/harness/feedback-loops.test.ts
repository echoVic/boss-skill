import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {
  initPipeline,
  updateStage,
  recordFeedback
} from '../../src/runtime/cli/lib/pipeline-runtime.js';
import { materializeState } from '../../src/runtime/projectors/materialize-state.js';

describe('feedback-loops', () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'boss-feedback-'));
    initPipeline('test-feat', { cwd: tmpDir });
    updateStage('test-feat', 1, 'running', { cwd: tmpDir });
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  function readExecJson() {
    return JSON.parse(
      fs.readFileSync(path.join(tmpDir, '.boss', 'test-feat', '.meta', 'execution.json'), 'utf8')
    ) as {
      feedbackLoops: { currentRound: number };
      revisionRequests: Array<{
        from: string;
        to: string;
        artifact: string;
        resolved: boolean;
        priority?: string;
      }>;
    };
  }

  it('records a revision request and increments round', () => {
    recordFeedback('test-feat', {
      from: 'boss-tech-lead', to: 'boss-architect',
      artifact: 'architecture.md', reason: '缺少缓存策略', cwd: tmpDir
    });

    const exec = readExecJson();
    expect(exec.feedbackLoops.currentRound).toBe(1);
    expect(exec.revisionRequests).toHaveLength(1);
    expect(exec.revisionRequests[0]?.from).toBe('boss-tech-lead');
    expect(exec.revisionRequests[0]?.to).toBe('boss-architect');
    expect(exec.revisionRequests[0]?.artifact).toBe('architecture.md');
    expect(exec.revisionRequests[0]?.resolved).toBe(false);
  });

  it('allows second round', () => {
    recordFeedback('test-feat', {
      from: 'boss-tech-lead', to: 'boss-architect',
      artifact: 'architecture.md', reason: 'round 1', cwd: tmpDir
    });
    recordFeedback('test-feat', {
      from: 'boss-qa', to: 'boss-backend',
      artifact: 'code', reason: 'round 2', cwd: tmpDir
    });

    const exec = readExecJson();
    expect(exec.feedbackLoops.currentRound).toBe(2);
    expect(exec.revisionRequests).toHaveLength(2);
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

  it('records priority field', () => {
    recordFeedback('test-feat', {
      from: 'boss-tech-lead', to: 'boss-architect',
      artifact: 'architecture.md', reason: '安全问题',
      priority: 'critical', cwd: tmpDir
    });

    const exec = readExecJson();
    expect(exec.revisionRequests[0]?.priority).toBe('critical');
  });

  it('appends event to events.jsonl', () => {
    recordFeedback('test-feat', {
      from: 'boss-tech-lead', to: 'boss-architect',
      artifact: 'architecture.md', reason: 'test', cwd: tmpDir
    });

    const lines = fs
      .readFileSync(path.join(tmpDir, '.boss', 'test-feat', '.meta', 'events.jsonl'), 'utf8')
      .trim()
      .split('\n');
    expect(lines.length).toBeGreaterThanOrEqual(2);

    const lastEvent = JSON.parse(lines[lines.length - 1] ?? '{}') as {
      type: string;
      data: { from: string; to: string };
    };
    expect(lastEvent.type).toBe('RevisionRequested');
    expect(lastEvent.data.from).toBe('boss-tech-lead');
    expect(lastEvent.data.to).toBe('boss-architect');
  });

  it('rebuilds revision requests from events', () => {
    recordFeedback('test-feat', {
      from: 'boss-tech-lead', to: 'boss-architect',
      artifact: 'architecture.md', reason: 'test',
      priority: 'critical', cwd: tmpDir
    });
    recordFeedback('test-feat', {
      from: 'boss-qa', to: 'boss-backend',
      artifact: 'code', reason: 'round 2', cwd: tmpDir
    });

    // Re-materialize from events to verify rebuild
    materializeState('test-feat', tmpDir);

    const exec = readExecJson();
    expect(exec.feedbackLoops.currentRound).toBe(2);
    expect(exec.revisionRequests).toHaveLength(2);
    expect(exec.revisionRequests[0]?.priority).toBe('critical');
    expect(exec.revisionRequests[1]?.to).toBe('boss-backend');
  });

  it('requires all mandatory parameters', () => {
    expect(() => recordFeedback('test-feat', {
      from: 'boss-tech-lead', to: 'boss-architect',
      artifact: 'architecture.md', reason: '', cwd: tmpDir
    })).toThrow(/缺少 reason 参数/);
  });
});
