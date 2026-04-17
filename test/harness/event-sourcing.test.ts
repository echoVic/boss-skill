import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { execSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const APPEND_SCRIPT = path.join(import.meta.dirname, '..', '..', 'scripts', 'harness', 'append-event.sh');
const MATERIALIZE_SCRIPT = path.join(import.meta.dirname, '..', '..', 'scripts', 'harness', 'materialize-state.sh');
const REPLAY_SCRIPT = path.join(import.meta.dirname, '..', '..', 'scripts', 'harness', 'replay-events.sh');

function getExecError(error: unknown) {
  return error as Error & { status?: number; stdout?: string; stderr?: string };
}

describe('event-sourcing', () => {
  let tmpDir: string;
  let origCwd: string;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'boss-event-'));
    origCwd = process.cwd();
    process.chdir(tmpDir);

    const metaDir = path.join(tmpDir, '.boss', 'test-feat', '.meta');
    fs.mkdirSync(metaDir, { recursive: true });

    const initState = {
      schemaVersion: '0.2.0',
      feature: 'test-feat',
      createdAt: '2024-01-01T00:00:00Z',
      updatedAt: '2024-01-01T00:00:00Z',
      status: 'initialized',
      parameters: {},
      stages: {
        '1': { name: 'planning', status: 'pending', startTime: null, endTime: null, retryCount: 0, maxRetries: 2, failureReason: null, artifacts: [], gateResults: {} },
        '2': { name: 'review', status: 'pending', startTime: null, endTime: null, retryCount: 0, maxRetries: 2, failureReason: null, artifacts: [], gateResults: {} },
        '3': { name: 'development', status: 'pending', startTime: null, endTime: null, retryCount: 0, maxRetries: 2, failureReason: null, artifacts: [], gateResults: {} },
        '4': { name: 'deployment', status: 'pending', startTime: null, endTime: null, retryCount: 0, maxRetries: 2, failureReason: null, artifacts: [], gateResults: {} }
      },
      qualityGates: {
        gate0: { status: 'pending', passed: null, checks: [], executedAt: null },
        gate1: { status: 'pending', passed: null, checks: [], executedAt: null },
        gate2: { status: 'pending', passed: null, checks: [], executedAt: null }
      },
      metrics: { totalDuration: null, stageTimings: {}, gatePassRate: null, retryTotal: 0 },
      plugins: [],
      humanInterventions: [],
      revisionRequests: [],
      feedbackLoops: { maxRounds: 2, currentRound: 0 }
    };

    fs.writeFileSync(path.join(metaDir, 'execution.json'), JSON.stringify(initState, null, 2), 'utf8');
    fs.writeFileSync(
      path.join(metaDir, 'events.jsonl'),
      `${JSON.stringify({
        id: 1,
        type: 'PipelineInitialized',
        timestamp: '2024-01-01T00:00:00Z',
        data: { initialState: initState }
      })}\n`,
      'utf8'
    );
  });

  afterEach(() => {
    process.chdir(origCwd);
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  function runScript(script: string, args: string) {
    try {
      return execSync(`bash "${script}" ${args}`, {
        encoding: 'utf8',
        cwd: tmpDir,
        env: { ...process.env, PATH: process.env.PATH }
      }).trim();
    } catch (error) {
      const execError = getExecError(error);
      if (execError.status !== 0) {
        throw new Error(execError.stderr || execError.message);
      }
      return execError.stdout ? String(execError.stdout).trim() : '';
    }
  }

  it('append-event.sh adds event to events.jsonl', () => {
    runScript(APPEND_SCRIPT, 'test-feat StageStarted --stage 1');

    const lines = fs
      .readFileSync(path.join(tmpDir, '.boss', 'test-feat', '.meta', 'events.jsonl'), 'utf8')
      .trim()
      .split('\n');
    expect(lines).toHaveLength(2);

    const event = JSON.parse(lines[1] ?? '{}') as {
      type: string;
      id: number;
      data: { stage: number };
    };
    expect(event.type).toBe('StageStarted');
    expect(event.data.stage).toBe(1);
    expect(event.id).toBe(2);
  });

  it('materialize-state.sh rebuilds execution.json from events', () => {
    runScript(APPEND_SCRIPT, 'test-feat StageStarted --stage 1');
    runScript(APPEND_SCRIPT, 'test-feat ArtifactRecorded --artifact prd.md --stage 1');
    runScript(APPEND_SCRIPT, 'test-feat StageCompleted --stage 1');
    runScript(MATERIALIZE_SCRIPT, 'test-feat');

    const execJson = JSON.parse(
      fs.readFileSync(path.join(tmpDir, '.boss', 'test-feat', '.meta', 'execution.json'), 'utf8')
    ) as {
      stages: { '1': { status: string; artifacts: string[] } };
    };
    expect(execJson.stages['1'].status).toBe('completed');
    expect(execJson.stages['1'].artifacts).toContain('prd.md');
  });

  it('replay-events.sh --compact lists events', () => {
    runScript(APPEND_SCRIPT, 'test-feat StageStarted --stage 1');

    const output = runScript(REPLAY_SCRIPT, 'test-feat --compact');
    expect(output).toContain('PipelineInitialized');
    expect(output).toContain('StageStarted');
  });

  it('append-event.sh rejects invalid event type', () => {
    expect(() => {
      runScript(APPEND_SCRIPT, 'test-feat InvalidEvent --stage 1');
    }).toThrow();
  });

  it('append-event.sh accepts plugin lifecycle event types from the runtime catalog', () => {
    runScript(
      APPEND_SCRIPT,
      `test-feat PluginDiscovered --data '${JSON.stringify({
        plugin: { name: 'security-audit', version: '1.0.0', type: 'gate' }
      })}'`
    );
    runScript(
      APPEND_SCRIPT,
      `test-feat PluginActivated --data '${JSON.stringify({
        plugin: { name: 'security-audit', version: '1.0.0', type: 'gate' }
      })}'`
    );

    const eventTypes = fs
      .readFileSync(path.join(tmpDir, '.boss', 'test-feat', '.meta', 'events.jsonl'), 'utf8')
      .trim()
      .split('\n')
      .map((line) => (JSON.parse(line) as { type: string }).type);

    expect(eventTypes).toEqual(['PipelineInitialized', 'PluginDiscovered', 'PluginActivated']);
  });

  it('materialize handles GateEvaluated events', () => {
    runScript(APPEND_SCRIPT, 'test-feat StageStarted --stage 3');
    runScript(APPEND_SCRIPT, 'test-feat GateEvaluated --gate gate0 --passed true --stage 3');
    runScript(MATERIALIZE_SCRIPT, 'test-feat');

    const execJson = JSON.parse(
      fs.readFileSync(path.join(tmpDir, '.boss', 'test-feat', '.meta', 'execution.json'), 'utf8')
    ) as {
      qualityGates: { gate0: { status: string; passed: boolean } };
    };
    expect(execJson.qualityGates.gate0.status).toBe('completed');
    expect(execJson.qualityGates.gate0.passed).toBe(true);
  });

  it('materialize preserves gate checks and computes gate pass rate', () => {
    runScript(
      APPEND_SCRIPT,
      `test-feat GateEvaluated --gate gate0 --passed true --stage 3 --data '${JSON.stringify({
        checks: [{ name: 'lint', passed: true, detail: 'ok' }]
      })}'`
    );
    runScript(
      APPEND_SCRIPT,
      `test-feat GateEvaluated --gate gate1 --passed false --stage 3 --data '${JSON.stringify({
        checks: [{ name: 'unit-tests', passed: false, detail: 'failed' }]
      })}'`
    );
    runScript(MATERIALIZE_SCRIPT, 'test-feat');

    const execJson = JSON.parse(
      fs.readFileSync(path.join(tmpDir, '.boss', 'test-feat', '.meta', 'execution.json'), 'utf8')
    ) as {
      qualityGates: {
        gate0: { checks: Array<{ name: string; passed: boolean; detail: string }> };
        gate1: { checks: Array<{ name: string; passed: boolean; detail: string }> };
      };
      metrics: { gatePassRate: number };
    };
    expect(execJson.qualityGates.gate0.checks).toEqual([{ name: 'lint', passed: true, detail: 'ok' }]);
    expect(execJson.qualityGates.gate1.checks).toEqual([{ name: 'unit-tests', passed: false, detail: 'failed' }]);
    expect(execJson.metrics.gatePassRate).toBe(50);
  });

  it('materialize handles PluginsRegistered events', () => {
    runScript(
      APPEND_SCRIPT,
      `test-feat PluginsRegistered --data '${JSON.stringify({
        plugins: [{ name: 'security-audit', version: '1.0.0', type: 'gate' }]
      })}'`
    );
    runScript(MATERIALIZE_SCRIPT, 'test-feat');

    const execJson = JSON.parse(
      fs.readFileSync(path.join(tmpDir, '.boss', 'test-feat', '.meta', 'execution.json'), 'utf8')
    ) as {
      plugins: Array<{ name: string; version: string; type: string }>;
    };
    expect(execJson.plugins).toEqual([{ name: 'security-audit', version: '1.0.0', type: 'gate' }]);
  });

  it('materialize-state.sh rejects malformed ArtifactRecorded events', () => {
    const eventsFile = path.join(tmpDir, '.boss', 'test-feat', '.meta', 'events.jsonl');
    fs.appendFileSync(
      eventsFile,
      `${JSON.stringify({
        id: 2,
        type: 'ArtifactRecorded',
        timestamp: '2024-01-01T00:00:01Z',
        data: { artifact: 'prd.md' }
      })}\n`,
      'utf8'
    );

    expect(() => {
      runScript(MATERIALIZE_SCRIPT, 'test-feat');
    }).toThrow(/ArtifactRecorded.*stage/);
  });

  it('materialize-state.sh rejects malformed GateEvaluated events', () => {
    const eventsFile = path.join(tmpDir, '.boss', 'test-feat', '.meta', 'events.jsonl');
    fs.appendFileSync(
      eventsFile,
      `${JSON.stringify({
        id: 2,
        type: 'GateEvaluated',
        timestamp: '2024-01-01T00:00:01Z',
        data: { gate: 'gate0', stage: 3 }
      })}\n`,
      'utf8'
    );

    expect(() => {
      runScript(MATERIALIZE_SCRIPT, 'test-feat');
    }).toThrow(/GateEvaluated.*passed/);
  });
});
