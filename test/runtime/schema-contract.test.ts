import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  EVENT_TYPES,
  EVENT_TYPE_VALUES
} from '../../packages/boss-cli/src/runtime/domain/event-types.js';
import {
  AGENT_STATUS,
  DEFAULT_SCHEMA_VERSION,
  PIPELINE_STATUS,
  STAGE_STATUS
} from '../../packages/boss-cli/src/runtime/domain/state-constants.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const REPO_ROOT = path.resolve(__dirname, '..', '..');

function loadJson(relativePath: string) {
  return JSON.parse(fs.readFileSync(path.join(REPO_ROOT, relativePath), 'utf8')) as Record<string, any>;
}

describe('runtime schema contract', () => {
  it('exports the runtime event catalog and status constants used by the schemas', () => {
    const schema = loadJson('packages/boss-cli/src/runtime/schema/event-schema.json');

    expect(EVENT_TYPES.ARTIFACT_RECORDED).toBe('ArtifactRecorded');
    expect(EVENT_TYPES.PLUGIN_HOOK_FAILED).toBe('PluginHookFailed');
    expect(new Set(EVENT_TYPE_VALUES).size).toBe(EVENT_TYPE_VALUES.length);
    expect([...EVENT_TYPE_VALUES].sort()).toEqual([...(schema.properties.type.enum as string[])].sort());

    expect(PIPELINE_STATUS).toEqual({
      INITIALIZED: 'initialized',
      RUNNING: 'running',
      PAUSED: 'paused',
      COMPLETED: 'completed',
      FAILED: 'failed'
    });
    expect(STAGE_STATUS.RETRYING).toBe('retrying');
    expect(AGENT_STATUS.FAILED).toBe('failed');
    expect(DEFAULT_SCHEMA_VERSION).toBe('0.2.0');
  });

  it('event schema documents ArtifactRecorded and GateEvaluated payload requirements', () => {
    const schema = loadJson('packages/boss-cli/src/runtime/schema/event-schema.json');
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
    const schema = loadJson('packages/boss-cli/src/runtime/schema/execution-schema.json');

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

  it('documents the conversation event types and execution sections', () => {
    const eventSchema = loadJson('packages/boss-cli/src/runtime/schema/event-schema.json');
    const executionSchema = loadJson('packages/boss-cli/src/runtime/schema/execution-schema.json');

    expect(eventSchema.properties.type.enum).toEqual(
      expect.arrayContaining([
        'ConversationOpened',
        'ConversationMessageAppended',
        'ConversationResolved',
        'TodoMaterialized'
      ])
    );
    expect(executionSchema.required).toEqual(
      expect.arrayContaining(['conversations', 'derivedTodos', 'conversationMetrics'])
    );
  });

  it('progress schema requires feature on emitted progress events', () => {
    const schema = loadJson('packages/boss-cli/src/runtime/schema/progress-schema.json');

    expect(Array.isArray(schema.required)).toBe(true);
    expect(schema.required.includes('feature')).toBe(true);
  });

  it('event schema documents plugin hook lifecycle payload requirements', () => {
    const schema = loadJson('packages/boss-cli/src/runtime/schema/event-schema.json');
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
    const recordSchema = loadJson('packages/boss-cli/src/runtime/schema/memory-record-schema.json');
    const summarySchema = loadJson('packages/boss-cli/src/runtime/schema/memory-summary-schema.json');

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

  it('ui design schema requires the renderable design artifact shape', () => {
    const schema = loadJson('packages/boss-cli/src/runtime/schema/ui-design-schema.json');

    expect(schema.properties.artifact.const).toBe('ui-design');
    expect(schema.properties.mode.enum).toEqual(['wireframe', 'hifi']);
    expect(schema.required).toEqual([
      'schemaVersion',
      'artifact',
      'mode',
      'feature',
      'updatedAt',
      'tokens',
      'pages',
      'components',
      'prototype',
      'implementationHints'
    ]);
  });

  it('artifact html schema constrains the runtime render model', () => {
    const schema = loadJson('packages/boss-cli/src/runtime/schema/artifact-html-schema.json');

    expect(schema.properties.artifact.const).toBe('artifact-html');
    expect(schema.additionalProperties).toBe(false);
    expect(schema.required.slice().sort()).toEqual([
      'artifact',
      'bodyHtml',
      'feature',
      'generatedAt',
      'schemaVersion',
      'sourceArtifact',
      'summaryItems',
      'title',
      'toc'
    ]);
    expect(new RegExp(schema.properties.sourceArtifact.pattern).test('prd.md')).toBe(true);
    expect(new RegExp(schema.properties.sourceArtifact.pattern).test('prd.html')).toBe(false);
    expect(schema.properties.toc.items.additionalProperties).toBe(false);
    expect(schema.properties.toc.items.properties.level.minimum).toBe(1);
    expect(schema.properties.toc.items.properties.level.maximum).toBe(6);
  });

  it('artifact html template includes required render placeholders', () => {
    const template = fs.readFileSync(
      path.join(REPO_ROOT, 'skill/templates/artifact.html.template'),
      'utf8'
    );

    for (const token of [
      '{{FEATURE}}',
      '{{TITLE}}',
      '{{SOURCE_ARTIFACT}}',
      '{{GENERATED_AT}}',
      '{{SUMMARY_HTML}}',
      '{{TOC_HTML}}',
      '{{BODY_HTML}}'
    ]) {
      expect(template).toContain(token);
    }
    expect(template).toMatch(/<!doctype html>/i);
    expect(template).toContain('<html lang="zh-CN">');
  });
});
