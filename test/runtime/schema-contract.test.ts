import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  EVENT_TYPES,
  EVENT_TYPE_VALUES
} from '../../src/runtime/domain/event-types.js';
import {
  AGENT_STATUS,
  DEFAULT_SCHEMA_VERSION,
  PIPELINE_STATUS,
  STAGE_STATUS
} from '../../src/runtime/domain/state-constants.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const REPO_ROOT = path.resolve(__dirname, '..', '..');

function loadJson(relativePath: string) {
  return JSON.parse(fs.readFileSync(path.join(REPO_ROOT, relativePath), 'utf8')) as Record<string, any>;
}

describe('runtime schema contract', () => {
  it('exports the runtime event catalog and status constants used by the schemas', () => {
    const schema = loadJson('runtime/schema/event-schema.json');

    expect(EVENT_TYPES.ARTIFACT_RECORDED).toBe('ArtifactRecorded');
    expect(EVENT_TYPES.PLUGIN_HOOK_FAILED).toBe('PluginHookFailed');
    expect(new Set(EVENT_TYPE_VALUES).size).toBe(EVENT_TYPE_VALUES.length);
    expect([...EVENT_TYPE_VALUES].sort()).toEqual([...(schema.properties.type.enum as string[])].sort());

    expect(PIPELINE_STATUS).toEqual({
      INITIALIZED: 'initialized',
      RUNNING: 'running',
      COMPLETED: 'completed',
      FAILED: 'failed'
    });
    expect(STAGE_STATUS.RETRYING).toBe('retrying');
    expect(AGENT_STATUS.FAILED).toBe('failed');
    expect(DEFAULT_SCHEMA_VERSION).toBe('0.2.0');
  });

  it('event schema documents ArtifactRecorded and GateEvaluated payload requirements', () => {
    const schema = loadJson('runtime/schema/event-schema.json');
    const clauses = Array.isArray(schema.allOf) ? schema.allOf : [];

    const artifactClause = clauses.find(
      (clause) => clause?.if?.properties?.type?.const === 'ArtifactRecorded'
    );
    const gateClause = clauses.find(
      (clause) => clause?.if?.properties?.type?.const === 'GateEvaluated'
    );

    expect(artifactClause).toBeTruthy();
    expect(artifactClause.then.properties.data.required.slice().sort()).toEqual(['artifact', 'stage']);

    expect(gateClause).toBeTruthy();
    expect(gateClause.then.properties.data.required.slice().sort()).toEqual([
      'gate',
      'passed',
      'stage'
    ]);
  });

  it('execution schema requires plugin lifecycle and expanded metrics fields', () => {
    const schema = loadJson('runtime/schema/execution-schema.json');

    expect(Array.isArray(schema.required) && schema.required.includes('pluginLifecycle')).toBe(true);
    expect(schema.properties.pluginLifecycle.required.slice().sort()).toEqual([
      'activated',
      'discovered',
      'executed',
      'failed'
    ]);
    expect(schema.properties.metrics.required.slice().sort()).toEqual([
      'agentFailureCount',
      'agentSuccessCount',
      'gatePassRate',
      'meanRetriesPerStage',
      'pluginFailureCount',
      'retryTotal',
      'revisionLoopCount',
      'stageTimings',
      'totalDuration'
    ]);
  });

  it('progress schema requires feature on emitted progress events', () => {
    const schema = loadJson('runtime/schema/progress-schema.json');

    expect(Array.isArray(schema.required)).toBe(true);
    expect(schema.required.includes('feature')).toBe(true);
  });

  it('event schema documents plugin hook lifecycle payload requirements', () => {
    const schema = loadJson('runtime/schema/event-schema.json');
    const clauses = Array.isArray(schema.allOf) ? schema.allOf : [];

    const executedClause = clauses.find(
      (clause) => clause?.if?.properties?.type?.const === 'PluginHookExecuted'
    );
    const failedClause = clauses.find(
      (clause) => clause?.if?.properties?.type?.const === 'PluginHookFailed'
    );

    expect(executedClause).toBeTruthy();
    expect(executedClause.then.properties.data.required.slice().sort()).toEqual([
      'exitCode',
      'hook',
      'plugin'
    ]);

    expect(failedClause).toBeTruthy();
    expect(failedClause.then.properties.data.required.slice().sort()).toEqual([
      'exitCode',
      'hook',
      'plugin'
    ]);
  });

  it('memory schemas require traceable records and injected summary views', () => {
    const recordSchema = loadJson('runtime/schema/memory-record-schema.json');
    const summarySchema = loadJson('runtime/schema/memory-summary-schema.json');

    expect(recordSchema.required.slice().sort()).toEqual([
      'category',
      'confidence',
      'createdAt',
      'decayScore',
      'evidence',
      'expiresAt',
      'id',
      'influence',
      'kind',
      'lastSeenAt',
      'scope',
      'source',
      'summary',
      'tags'
    ]);
    expect(recordSchema.properties.scope.enum).toEqual(['global', 'feature']);
    expect(recordSchema.properties.kind.enum).toEqual(['execution', 'long_term']);
    expect(recordSchema.properties.influence.enum).toEqual(['preference']);

    expect(summarySchema.required.slice().sort()).toEqual([
      'agentSections',
      'feature',
      'generatedAt',
      'startupSummary'
    ]);
    expect(summarySchema.properties.startupSummary.type).toBe('array');
    expect(summarySchema.properties.agentSections.type).toBe('object');
  });
});
