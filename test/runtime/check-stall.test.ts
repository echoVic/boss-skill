import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

let pipelineRuntime: typeof import('../../src/runtime/cli/lib/pipeline-runtime.js');

describe('checkStall', () => {
  let tmpDir: string;

  beforeEach(async () => {
    pipelineRuntime = await import('../../src/runtime/cli/lib/pipeline-runtime.js');
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'boss-stall-'));
    // Initialize a pipeline
    pipelineRuntime.initPipeline('test-feat', { cwd: tmpDir });
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it('returns empty array when no agents are running', () => {
    const result = pipelineRuntime.checkStall('test-feat', { cwd: tmpDir });
    expect(result.stalled).toEqual([]);
  });

  it('returns empty when running agent is within threshold', () => {
    pipelineRuntime.updateStage('test-feat', 1, 'running', { cwd: tmpDir });
    pipelineRuntime.updateAgent('test-feat', 1, 'boss-pm', 'running', { cwd: tmpDir });
    // Agent just started, so with a large threshold it shouldn't be stalled
    const result = pipelineRuntime.checkStall('test-feat', { cwd: tmpDir, maxDurationMs: 60 * 60 * 1000 });
    expect(result.stalled).toEqual([]);
  });

  it('detects stalled agent beyond threshold', () => {
    pipelineRuntime.updateStage('test-feat', 1, 'running', { cwd: tmpDir });
    pipelineRuntime.updateAgent('test-feat', 1, 'boss-pm', 'running', { cwd: tmpDir });

    // Backdate the agent startTime in execution.json
    const execPath = path.join(tmpDir, '.boss', 'test-feat', '.meta', 'execution.json');
    const exec = JSON.parse(fs.readFileSync(execPath, 'utf8'));
    exec.stages['1'].agents['boss-pm'].startTime = new Date(Date.now() - 120000).toISOString();
    fs.writeFileSync(execPath, JSON.stringify(exec, null, 2), 'utf8');

    const result = pipelineRuntime.checkStall('test-feat', { cwd: tmpDir, maxDurationMs: 60000 });
    expect(result.stalled).toHaveLength(1);
    expect(result.stalled[0].agent).toBe('boss-pm');
    expect(result.stalled[0].stage).toBe(1);
  });

  it('emits AgentFailed with reason timeout when autoFail is true', () => {
    pipelineRuntime.updateStage('test-feat', 1, 'running', { cwd: tmpDir });
    pipelineRuntime.updateAgent('test-feat', 1, 'boss-pm', 'running', { cwd: tmpDir });

    // Backdate
    const execPath = path.join(tmpDir, '.boss', 'test-feat', '.meta', 'execution.json');
    const exec = JSON.parse(fs.readFileSync(execPath, 'utf8'));
    exec.stages['1'].agents['boss-pm'].startTime = new Date(Date.now() - 120000).toISOString();
    fs.writeFileSync(execPath, JSON.stringify(exec, null, 2), 'utf8');

    const result = pipelineRuntime.checkStall('test-feat', { cwd: tmpDir, maxDurationMs: 60000, autoFail: true });
    expect(result.stalled[0].failed).toBe(true);

    // Verify AgentFailed event was emitted
    const eventsPath = path.join(tmpDir, '.boss', 'test-feat', '.meta', 'events.jsonl');
    const events = fs.readFileSync(eventsPath, 'utf8').trim().split('\n').map(l => JSON.parse(l));
    const failEvent = events.find((e: { type: string; data?: { reason?: string } }) =>
      e.type === 'AgentFailed' && e.data?.reason === 'timeout'
    );
    expect(failEvent).toBeTruthy();
    expect(failEvent.data.agent).toBe('boss-pm');
  });
});
