import { describe, expect, it } from 'vitest';
import path from 'node:path';

import { evaluateEvalCase, loadEvalCase } from './eval-runner.js';

const FIXTURES = path.resolve(import.meta.dirname, 'fixtures');

describe('Boss deterministic eval runner', () => {
  it('loads eval case manifests with required artifacts and behavior checks', () => {
    const evalCase = loadEvalCase(path.join(FIXTURES, 'smoke-success', 'case.json'));

    expect(evalCase.id).toBe('smoke-success');
    expect(evalCase.feature).toBe('todo-app');
    expect(evalCase.requiredArtifacts).toContain('qa-report.md');
    expect(evalCase.requiredBehaviors).toContain('uses-boss-skill');
  });

  it('scores a completed smoke eval without an LLM judge', () => {
    const report = evaluateEvalCase(path.join(FIXTURES, 'smoke-success', 'case.json'));

    expect(report).toEqual({
      id: 'smoke-success',
      passed: true,
      artifactCompleteness: 1,
      requiredArtifactsPresent: ['prd.md', 'architecture.md', 'tasks.md', 'qa-report.md'],
      missingArtifacts: [],
      behaviorResults: {
        'uses-boss-skill': true,
        'runs-tests': true,
        'records-qa-evidence': true
      },
      usage: {
        inputTokens: 1000,
        outputTokens: 500,
        cacheCreationInputTokens: 0,
        cacheReadInputTokens: 0
      },
      estimatedCostUsd: 0.0105,
      durationSeconds: 120,
      failures: []
    });
  });

  it('scores pipeline-compliance eval for runtime-first orchestration evidence', () => {
    const report = evaluateEvalCase(path.join(FIXTURES, 'pipeline-compliance', 'case.json'));

    expect(report.passed).toBe(true);
    expect(report.behaviorResults).toEqual({
      'uses-boss-skill': true,
      'uses-runtime-cli': true,
      'records-artifacts-via-runtime': true,
      'avoids-direct-execution-write': true,
      'has-workflow-scheduler': true,
      'runs-tests': true,
      'records-qa-evidence': true
    });
  });

  it('fails when QA evidence and required test execution are missing', () => {
    const report = evaluateEvalCase(path.join(FIXTURES, 'missing-qa', 'case.json'));

    expect(report.passed).toBe(false);
    expect(report.artifactCompleteness).toBe(0.75);
    expect(report.missingArtifacts).toEqual(['qa-report.md']);
    expect(report.behaviorResults['uses-boss-skill']).toBe(true);
    expect(report.behaviorResults['runs-tests']).toBe(false);
    expect(report.behaviorResults['records-qa-evidence']).toBe(false);
    expect(report.failures).toContain('missing artifact: qa-report.md');
    expect(report.failures).toContain('behavior failed: runs-tests');
    expect(report.failures).toContain('behavior failed: records-qa-evidence');
  });
});
