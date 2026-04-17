import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { initPipeline } from '../../src/runtime/cli/lib/pipeline-runtime.js';
import { materializeState } from '../../src/runtime/projectors/materialize-state.js';

describe('initPipeline pack application', () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'boss-pack-init-'));
    fs.writeFileSync(path.join(tmpDir, 'package.json'), '{"name":"api-only-app"}\n', 'utf8');
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it('records detected pack configuration into runtime state truth', () => {
    const state = initPipeline('test-feat', { cwd: tmpDir });

    expect(state.parameters.pipelinePack).toBe('api-only');
    expect(state.parameters.skipUI).toBe(true);
    expect(state.parameters.skipFrontend).toBe(true);
    expect(state.parameters.enabledGates).toEqual(['gate0', 'gate1', 'gate2']);
    expect(state.parameters.enabledStages).toEqual([1, 2, 3, 4]);
    expect(Array.isArray(state.parameters.activeAgents)).toBe(true);
    expect(state.parameters.activeAgents).toContain('boss-backend');

    const rematerialized = materializeState('test-feat', tmpDir).state;
    expect(rematerialized.parameters.pipelinePack).toBe('api-only');
    expect(rematerialized.parameters.skipUI).toBe(true);
    expect(rematerialized.parameters.enabledGates).toEqual(['gate0', 'gate1', 'gate2']);

    const eventsFile = path.join(tmpDir, '.boss', 'test-feat', '.meta', 'events.jsonl');
    const events = fs
      .readFileSync(eventsFile, 'utf8')
      .trim()
      .split('\n')
      .filter(Boolean)
      .map((line) => JSON.parse(line) as { type: string });

    expect(events.some((event) => event.type === 'PackApplied')).toBe(true);
  });

  it('rejects partial legacy execution-only state', () => {
    const metaDir = path.join(tmpDir, '.boss', 'test-feat', '.meta');
    fs.mkdirSync(metaDir, { recursive: true });

    const legacyState = {
      schemaVersion: '0.2.0',
      feature: 'test-feat',
      createdAt: '2026-04-12T00:00:00.000Z',
      updatedAt: '2026-04-12T00:00:00.000Z',
      status: 'initialized',
      parameters: {
        skipUI: false,
        skipDeploy: false,
        quick: false,
        hitlLevel: 'auto',
        roles: 'full'
      },
      stages: {},
      qualityGates: {},
      metrics: {
        totalDuration: null,
        stageTimings: {},
        gatePassRate: null,
        retryTotal: 0
      },
      plugins: [],
      humanInterventions: [],
      revisionRequests: [],
      feedbackLoops: { maxRounds: 2, currentRound: 0 }
    };

    fs.writeFileSync(
      path.join(metaDir, 'execution.json'),
      `${JSON.stringify(legacyState, null, 2)}\n`,
      'utf8'
    );

    expect(() => initPipeline('test-feat', { cwd: tmpDir })).toThrow(/检测到不完整的流水线状态/);
  });

  it('rejects already initialized pipelines instead of backfilling pack truth', () => {
    const metaDir = path.join(tmpDir, '.boss', 'test-feat', '.meta');
    fs.mkdirSync(metaDir, { recursive: true });

    const legacyState = {
      schemaVersion: '0.2.0',
      feature: 'test-feat',
      createdAt: '2026-04-12T00:00:00.000Z',
      updatedAt: '2026-04-12T00:00:00.000Z',
      status: 'initialized',
      parameters: {
        skipUI: false,
        skipDeploy: false,
        quick: false,
        hitlLevel: 'auto',
        roles: 'full'
      },
      stages: {},
      qualityGates: {},
      metrics: {
        totalDuration: null,
        stageTimings: {},
        gatePassRate: null,
        retryTotal: 0
      },
      plugins: [],
      humanInterventions: [],
      revisionRequests: [],
      feedbackLoops: { maxRounds: 2, currentRound: 0 }
    };
    fs.writeFileSync(
      path.join(metaDir, 'execution.json'),
      `${JSON.stringify(legacyState, null, 2)}\n`,
      'utf8'
    );

    const initEvent = {
      id: 1,
      type: 'PipelineInitialized',
      timestamp: '2026-04-12T00:00:00.000Z',
      data: {
        initialState: legacyState
      }
    };
    fs.writeFileSync(path.join(metaDir, 'events.jsonl'), `${JSON.stringify(initEvent)}\n`, 'utf8');

    expect(() => initPipeline('test-feat', { cwd: tmpDir })).toThrow(/流水线已存在/);
  });

  it('rejects already initialized default-pack pipelines instead of backfilling truth', () => {
    const metaDir = path.join(tmpDir, '.boss', 'test-feat', '.meta');
    fs.mkdirSync(metaDir, { recursive: true });
    fs.rmSync(path.join(tmpDir, 'package.json'));

    const legacyState = {
      schemaVersion: '0.2.0',
      feature: 'test-feat',
      createdAt: '2026-04-12T00:00:00.000Z',
      updatedAt: '2026-04-12T00:00:00.000Z',
      status: 'initialized',
      parameters: {
        skipUI: false,
        skipDeploy: false,
        quick: false,
        hitlLevel: 'auto',
        roles: 'full'
      },
      stages: {},
      qualityGates: {},
      metrics: {
        totalDuration: null,
        stageTimings: {},
        gatePassRate: null,
        retryTotal: 0
      },
      plugins: [],
      humanInterventions: [],
      revisionRequests: [],
      feedbackLoops: { maxRounds: 2, currentRound: 0 }
    };
    fs.writeFileSync(
      path.join(metaDir, 'execution.json'),
      `${JSON.stringify(legacyState, null, 2)}\n`,
      'utf8'
    );

    const initEvent = {
      id: 1,
      type: 'PipelineInitialized',
      timestamp: '2026-04-12T00:00:00.000Z',
      data: {
        initialState: legacyState
      }
    };
    fs.writeFileSync(path.join(metaDir, 'events.jsonl'), `${JSON.stringify(initEvent)}\n`, 'utf8');

    expect(() => initPipeline('test-feat', { cwd: tmpDir })).toThrow(/流水线已存在/);
  });
});
