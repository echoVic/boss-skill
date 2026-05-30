import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import * as runtime from '../../packages/boss-cli/src/runtime/application/pipeline.js';
import { cleanupTempDir } from '../helpers/fixtures.js';

const BOSS_BIN = path.resolve(import.meta.dirname, '..', '..', 'packages', 'boss-cli', 'dist', 'bin', 'boss.js');

type RuntimeEvent = {
  type: string;
  data: Record<string, unknown>;
};

describe('stage/agent runtime updates', () => {
  let tmpDir: string;
  let cwd: string;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'boss-stage-agent-'));
    cwd = process.cwd();
    process.chdir(tmpDir);
    runtime.initPipeline('test-feat', { cwd: tmpDir });
  });

  afterEach(() => {
    process.chdir(cwd);
    cleanupTempDir(tmpDir);
  });

  function readEvents(): RuntimeEvent[] {
    const eventsPath = path.join(tmpDir, '.boss', 'test-feat', '.meta', 'events.jsonl');
    return fs.readFileSync(eventsPath, 'utf8').trim().split('\n').map((line) => JSON.parse(line) as RuntimeEvent);
  }

  function runRuntimeCommand(name: string, args: string[]) {
    return spawnSync(process.execPath, [BOSS_BIN, 'runtime', name, ...args], { cwd: tmpDir, encoding: 'utf8' });
  }

  it('updates stage then agent status', () => {
    const stageExecution = runtime.updateStage('test-feat', 1, 'running', { cwd: tmpDir });
    expect(stageExecution.stages['1']?.status).toBe('running');

    const agentExecution = runtime.updateAgent('test-feat', 1, 'boss-pm', 'running', { cwd: tmpDir });
    expect(agentExecution.stages['1']?.agents?.['boss-pm']?.status).toBe('running');
  });

  it('records artifact DAG fingerprint in PipelineInitialized', () => {
    const initEvent = readEvents()[0]!;
    const artifactDag = initEvent.data.artifactDag as {
      path: string;
      version: string;
      hash: { algorithm: string; value: string };
    };
    expect(artifactDag.path).toContain('artifact-dag.json');
    expect(artifactDag.hash.algorithm).toBe('sha256');
    expect(artifactDag.hash.value).toMatch(/^[a-f0-9]{64}$/);
    const initialState = initEvent.data.initialState as { parameters?: { runId?: string } };
    expect(initialState.parameters?.runId).toMatch(/^[a-f0-9]{64}$/);
  });

  it('returns a stable handle from launch and attach commands', () => {
    const launch = runRuntimeCommand('launch', ['test-feat', '--json']);
    expect(launch.status, launch.stderr).toBe(0);
    const launched = JSON.parse(launch.stdout) as { feature: string; runId: string; handle: string };
    expect(launched.feature).toBe('test-feat');
    expect(launched.runId).toMatch(/^[a-f0-9]{64}$/);
    expect(launched.handle).toBe(`test-feat:${launched.runId}`);

    const attach = runRuntimeCommand('attach', ['test-feat', '--json']);
    expect(attach.status, attach.stderr).toBe(0);
    const attached = JSON.parse(attach.stdout) as { feature: string; runId: string; handle: string };
    expect(attached.feature).toBe('test-feat');
    expect(attached.runId).toBe(launched.runId);
    expect(attached.handle).toBe(launched.handle);
  });

  it('keeps launch idempotent after pause', () => {
    const first = runRuntimeCommand('launch', ['test-feat', '--json']);
    expect(first.status, first.stderr).toBe(0);
    const firstPayload = JSON.parse(first.stdout) as { runId: string; status: string };

    runtime.pausePipeline('test-feat', { cwd: tmpDir, reason: 'wait' });

    const second = runRuntimeCommand('launch', ['test-feat', '--json']);
    expect(second.status, second.stderr).toBe(0);
    const secondPayload = JSON.parse(second.stdout) as { runId: string; status: string };
    expect(secondPayload.runId).toBe(firstPayload.runId);
    expect(secondPayload.status).toBe('paused');
  });

  it('does not hide corrupted execution files during launch', () => {
    const metaDir = path.join(tmpDir, '.boss', 'broken-feat', '.meta');
    fs.mkdirSync(metaDir, { recursive: true });
    fs.writeFileSync(path.join(metaDir, 'execution.json'), 'not-json\n', 'utf8');

    const result = runRuntimeCommand('launch', ['broken-feat', '--json']);
    expect(result.status).not.toBe(0);
    expect(result.stderr).toMatch(/not valid JSON|Unexpected token/);
  });

  it('pauses pipeline through a first-class event', () => {
    const execution = runtime.pausePipeline('test-feat', {
      cwd: tmpDir,
      reason: 'checkpoint',
      requestedBy: 'test'
    });
    expect(execution.status).toBe('paused');
    expect(execution.pause?.reason).toBe('checkpoint');
    expect(readEvents().map((event) => event.type)).toContain('PipelinePaused');
  });

  it('rejects duplicate and terminal pauses', () => {
    runtime.pausePipeline('test-feat', { cwd: tmpDir });
    expect(() => runtime.pausePipeline('test-feat', { cwd: tmpDir })).toThrow(/已处于暂停状态/);

    runtime.initPipeline('done-feat', { cwd: tmpDir });
    for (const stage of [1, 2, 3, 4]) {
      runtime.updateStage('done-feat', stage, 'running', { cwd: tmpDir });
      runtime.updateStage('done-feat', stage, 'completed', { cwd: tmpDir });
    }
    expect(() => runtime.pausePipeline('done-feat', { cwd: tmpDir })).toThrow(/已终止/);
  });

  it('records PipelineResumed before StageStarted when running after pause', () => {
    runtime.pausePipeline('test-feat', { cwd: tmpDir, requestedBy: 'test' });
    const execution = runtime.updateStage('test-feat', 1, 'running', { cwd: tmpDir });
    expect(execution.status).toBe('running');
    expect(execution.pause).toBeNull();

    const types = readEvents().map((event) => event.type);
    expect(types).toContain('PipelineResumed');
    expect(types.indexOf('PipelineResumed')).toBeLessThan(types.indexOf('StageStarted'));
  });

  it('rejects pending as a target status', () => {
    expect(() => {
      runtime.updateStage('test-feat', 1, 'pending', { cwd: tmpDir });
    }).toThrow(/无效状态/);

    expect(() => {
      runtime.updateAgent('test-feat', 1, 'boss-pm', 'pending', { cwd: tmpDir });
    }).toThrow(/无效状态/);
  });

  it('rejects invalid stage transitions', () => {
    expect(() => {
      runtime.updateStage('test-feat', 1, 'completed', { cwd: tmpDir });
    }).toThrow(/无效的状态转换/);
  });

  it('records artifacts and gate results for stage completion', () => {
    runtime.updateStage('test-feat', 1, 'running', { cwd: tmpDir });
    const execution = runtime.updateStage('test-feat', 1, 'completed', {
      cwd: tmpDir,
      artifacts: ['prd.md'],
      gate: 'gate1',
      gatePassed: true
    });

    expect(execution.stages['1']?.artifacts.includes('prd.md')).toBe(true);
    expect(execution.stages['1']?.gateResults?.gate1?.passed).toBe(true);

    const types = readEvents().map((event) => event.type);
    expect(types).toContain('ArtifactRecorded');
    expect(types).toContain('GateEvaluated');
  });

  it('records prompt and input digests for reusable agent completions', () => {
    runtime.updateStage('test-feat', 1, 'running', { cwd: tmpDir });
    fs.writeFileSync(path.join(tmpDir, '.boss', 'test-feat', 'prd.md'), 'requirements\n', 'utf8');

    runtime.updateAgent('test-feat', 1, 'boss-pm', 'completed', {
      cwd: tmpDir,
      prompt: 'review auth',
      dependencyArtifacts: ['prd.md'],
      opts: { temperature: 0 }
    });

    const completed = readEvents().find((event) => event.type === 'AgentCompleted')!;
    expect(completed.data.promptFingerprint).toMatch(/^[a-f0-9]{64}$/);
    expect(completed.data.inputDigest).toMatch(/^[a-f0-9]{64}$/);

    const reusable = runtime.evaluateAgentReuse('test-feat', 1, 'boss-pm', {
      cwd: tmpDir,
      prompt: 'review auth',
      dependencyArtifacts: ['prd.md'],
      opts: { temperature: 0 }
    });
    expect(reusable.reusable).toBe(true);

    const changedPrompt = runtime.evaluateAgentReuse('test-feat', 1, 'boss-pm', {
      cwd: tmpDir,
      prompt: 'review auth differently',
      dependencyArtifacts: ['prd.md'],
      opts: { temperature: 0 }
    });
    expect(changedPrompt.reusable).toBe(false);
    expect(changedPrompt.reason).toBe('prompt-fingerprint-changed');

    fs.writeFileSync(path.join(tmpDir, '.boss', 'test-feat', 'prd.md'), 'changed\n', 'utf8');
    const changedInput = runtime.evaluateAgentReuse('test-feat', 1, 'boss-pm', {
      cwd: tmpDir,
      prompt: 'review auth',
      dependencyArtifacts: ['prd.md'],
      opts: { temperature: 0 }
    });
    expect(changedInput.reusable).toBe(false);
    expect(changedInput.reason).toBe('input-digest-changed');
  });

  it('marks agent cache stale when the DAG changed after pause', () => {
    runtime.updateAgent('test-feat', 1, 'boss-pm', 'completed', {
      cwd: tmpDir,
      prompt: 'review auth'
    });
    runtime.pausePipeline('test-feat', { cwd: tmpDir });

    fs.mkdirSync(path.join(tmpDir, '.boss'), { recursive: true });
    fs.writeFileSync(
      path.join(tmpDir, '.boss', 'artifact-dag.json'),
      JSON.stringify({ version: 'changed', artifacts: {} }, null, 2) + '\n',
      'utf8'
    );

    const decision = runtime.evaluateAgentReuse('test-feat', 1, 'boss-pm', {
      cwd: tmpDir,
      prompt: 'review auth'
    });
    expect(decision.dagStale).toBe(true);
    expect(decision.reusable).toBe(false);
    expect(decision.reason).toBe('artifact-dag-stale');
  });

  it('checks agent cache through the CLI', () => {
    fs.writeFileSync(path.join(tmpDir, '.boss', 'test-feat', 'prd.md'), 'requirements\n', 'utf8');
    runtime.updateAgent('test-feat', 1, 'boss-pm', 'completed', {
      cwd: tmpDir,
      prompt: 'review auth',
      dependencyArtifacts: ['prd.md'],
      opts: { temperature: 0 }
    });

    const result = runRuntimeCommand('agent-cache', [
      'test-feat',
      '1',
      'boss-pm',
      '--prompt',
      'review auth',
      '--depends-on',
      'prd.md',
      '--opts',
      '{"temperature":0}',
      '--json'
    ]);
    expect(result.status, result.stderr).toBe(0);
    const payload = JSON.parse(result.stdout) as { reusable: boolean; dagStale: boolean };
    expect(payload.reusable).toBe(true);
    expect(payload.dagStale).toBe(false);

    const invalid = runRuntimeCommand('agent-cache', [
      'test-feat',
      '1',
      'boss-pm',
      '--opts',
      '{bad',
      '--json'
    ]);
    expect(invalid.status).not.toBe(0);
    expect(invalid.stderr).toContain('--opts 不是有效的 JSON');
  });

  it('fails CLI when option value is missing', () => {
    const stageResult = runRuntimeCommand('update-stage', ['test-feat', '1', 'running', '--reason']);
    expect(stageResult.status).not.toBe(0);
    expect(stageResult.stderr).toMatch(/--reason/);

    const agentResult = runRuntimeCommand('update-agent', ['test-feat', '1', 'boss-pm', 'running', '--reason', '--artifact']);
    expect(agentResult.status).not.toBe(0);
    expect(agentResult.stderr).toMatch(/--reason/);
  });

  it('supports machine-readable JSON output for stage and agent updates', () => {
    const stageResult = runRuntimeCommand('update-stage', ['test-feat', '1', 'running', '--json']);
    expect(stageResult.status, stageResult.stderr).toBe(0);
    const stagePayload = JSON.parse(stageResult.stdout) as {
      feature: string;
      stage: number;
      previousStatus: string;
      status: string;
    };
    expect(stagePayload.feature).toBe('test-feat');
    expect(stagePayload.stage).toBe(1);
    expect(stagePayload.previousStatus).toBe('pending');
    expect(stagePayload.status).toBe('running');

    const agentResult = runRuntimeCommand('update-agent', ['test-feat', '1', 'boss-pm', 'running', '--json']);
    expect(agentResult.status, agentResult.stderr).toBe(0);
    const agentPayload = JSON.parse(agentResult.stdout) as {
      feature: string;
      stage: number;
      agent: string;
      status: string;
    };
    expect(agentPayload.feature).toBe('test-feat');
    expect(agentPayload.stage).toBe(1);
    expect(agentPayload.agent).toBe('boss-pm');
    expect(agentPayload.status).toBe('running');
  });
});
