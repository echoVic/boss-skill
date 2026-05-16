import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { replayEvents } from '../../packages/boss-cli/src/runtime/application/inspection.js';
import { evaluateGates } from '../../packages/boss-cli/src/runtime/application/gates.js';
import {
  recordArtifact,
  registerPlugins,
  updateStage
} from '../../packages/boss-cli/src/runtime/application/pipeline.js';
import { materializeState } from '../../packages/boss-cli/src/runtime/projectors/materialize-state.js';

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
    fs.rmSync(tmpDir, { recursive: true, force: true, maxRetries: 5, retryDelay: 200 });
  });

  it('runtime stage updates add events to events.jsonl', () => {
    updateStage('test-feat', '1', 'running', { cwd: tmpDir });

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

  it('materializeState rebuilds execution.json from events', () => {
    updateStage('test-feat', '1', 'running', { cwd: tmpDir });
    recordArtifact('test-feat', 'prd.md', '1', { cwd: tmpDir });
    updateStage('test-feat', '1', 'completed', { cwd: tmpDir });
    materializeState('test-feat', tmpDir);

    const execJson = JSON.parse(
      fs.readFileSync(path.join(tmpDir, '.boss', 'test-feat', '.meta', 'execution.json'), 'utf8')
    ) as {
      stages: { '1': { status: string; artifacts: string[] } };
    };
    expect(execJson.stages['1'].status).toBe('completed');
    expect(execJson.stages['1'].artifacts).toContain('prd.md');
  });

  it('replayEvents lists events', () => {
    updateStage('test-feat', '1', 'running', { cwd: tmpDir });

    const result = replayEvents('test-feat', { cwd: tmpDir, limit: 20 });
    const types = (result.events || []).map((e: { type: string }) => e.type);
    expect(types).toContain('PipelineInitialized');
    expect(types).toContain('StageStarted');
  });

  it('materializeState rejects invalid event type', () => {
    const eventsFile = path.join(tmpDir, '.boss', 'test-feat', '.meta', 'events.jsonl');
    fs.appendFileSync(
      eventsFile,
      `${JSON.stringify({
        id: 2,
        type: 'InvalidEvent',
        timestamp: '2024-01-01T00:00:01Z',
        data: { stage: 1 }
      })}\n`,
      'utf8'
    );

    expect(() => {
      materializeState('test-feat', tmpDir);
    }).toThrow();
  });

  it('registerPlugins records plugin lifecycle event types from the runtime catalog', () => {
    registerPlugins('test-feat', { cwd: tmpDir });

    const eventTypes = fs
      .readFileSync(path.join(tmpDir, '.boss', 'test-feat', '.meta', 'events.jsonl'), 'utf8')
      .trim()
      .split('\n')
      .map((line) => (JSON.parse(line) as { type: string }).type);

    expect(eventTypes).toContain('PluginDiscovered');
    expect(eventTypes).toContain('PluginActivated');
    expect(eventTypes).toContain('PluginsRegistered');
  });

  it('materialize handles GateEvaluated events', () => {
    updateStage('test-feat', '3', 'running', { cwd: tmpDir });
    evaluateGates('test-feat', 'gate1', { cwd: tmpDir });

    const execJson = JSON.parse(
      fs.readFileSync(path.join(tmpDir, '.boss', 'test-feat', '.meta', 'execution.json'), 'utf8')
    ) as {
      qualityGates: { gate0: { status: string; passed: boolean } };
    };
    expect(execJson.qualityGates.gate1.status).toBe('completed');
    expect(execJson.qualityGates.gate1.passed).toBe(true);
  });

  it('materialize preserves gate checks and computes gate pass rate', () => {
    const eventsFile = path.join(tmpDir, '.boss', 'test-feat', '.meta', 'events.jsonl');
    fs.appendFileSync(
      eventsFile,
      `${JSON.stringify({
        id: 2,
        type: 'GateEvaluated',
        timestamp: '2024-01-01T00:00:01Z',
        data: { gate: 'gate0', passed: true, stage: 3, checks: [{ name: 'lint', passed: true, detail: 'ok' }] }
      })}\n${JSON.stringify({
        id: 3,
        type: 'GateEvaluated',
        timestamp: '2024-01-01T00:00:02Z',
        data: { gate: 'gate1', passed: false, stage: 3, checks: [{ name: 'unit-tests', passed: false, detail: 'failed' }] }
      })}\n`,
      'utf8'
    );
    materializeState('test-feat', tmpDir);

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
    registerPlugins('test-feat', { cwd: tmpDir });
    materializeState('test-feat', tmpDir);

    const execJson = JSON.parse(
      fs.readFileSync(path.join(tmpDir, '.boss', 'test-feat', '.meta', 'execution.json'), 'utf8')
    ) as {
      plugins: Array<{ name: string; version: string; type: string }>;
    };
    expect(execJson.plugins.some((plugin) => plugin.name === 'security-audit')).toBe(true);
  });

  it('materializeState rejects malformed ArtifactRecorded events', () => {
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
      materializeState('test-feat', tmpDir);
    }).toThrow(/ArtifactRecorded.*stage/);
  });

  it('materializeState rejects malformed GateEvaluated events', () => {
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
      materializeState('test-feat', tmpDir);
    }).toThrow(/GateEvaluated.*passed/);
  });
});
