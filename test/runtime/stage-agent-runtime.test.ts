import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import * as runtime from '../../runtime/cli/lib/pipeline-runtime.js';

type RuntimeEvent = {
  type: string;
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
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  function readEvents(): RuntimeEvent[] {
    const eventsPath = path.join(tmpDir, '.boss', 'test-feat', '.meta', 'events.jsonl');
    return fs.readFileSync(eventsPath, 'utf8').trim().split('\n').map((line) => JSON.parse(line) as RuntimeEvent);
  }

  function runCli(script: string, args: string[]) {
    return spawnSync(process.execPath, [script, ...args], { cwd: tmpDir, encoding: 'utf8' });
  }

  it('updates stage then agent status', () => {
    const stageExecution = runtime.updateStage('test-feat', 1, 'running', { cwd: tmpDir });
    expect(stageExecution.stages['1']?.status).toBe('running');

    const agentExecution = runtime.updateAgent('test-feat', 1, 'boss-pm', 'running', { cwd: tmpDir });
    expect(agentExecution.stages['1']?.agents?.['boss-pm']?.status).toBe('running');
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

  it('fails CLI when option value is missing', () => {
    const updateStageCli = path.resolve(import.meta.dirname, '..', '..', 'runtime', 'cli', 'update-stage.js');
    const updateAgentCli = path.resolve(import.meta.dirname, '..', '..', 'runtime', 'cli', 'update-agent.js');

    const stageResult = runCli(updateStageCli, ['test-feat', '1', 'running', '--reason']);
    expect(stageResult.status).not.toBe(0);
    expect(stageResult.stderr).toMatch(/--reason/);

    const agentResult = runCli(updateAgentCli, ['test-feat', '1', 'boss-pm', 'running', '--reason', '--artifact']);
    expect(agentResult.status).not.toBe(0);
    expect(agentResult.stderr).toMatch(/--reason/);
  });

  it('supports machine-readable JSON output for stage and agent updates', () => {
    const updateStageCli = path.resolve(import.meta.dirname, '..', '..', 'runtime', 'cli', 'update-stage.js');
    const updateAgentCli = path.resolve(import.meta.dirname, '..', '..', 'runtime', 'cli', 'update-agent.js');

    const stageResult = runCli(updateStageCli, ['test-feat', '1', 'running', '--json']);
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

    const agentResult = runCli(updateAgentCli, ['test-feat', '1', 'boss-pm', 'running', '--json']);
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
