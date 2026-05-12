import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { evaluateFinalGate } from '../../packages/boss-cli/src/runtime/application/final-gate.js';
import {
  initPipeline,
  recordArtifact,
  updateAgent
} from '../../packages/boss-cli/src/runtime/application/pipeline.js';

describe('final gate runtime', () => {
  let tmpDir: string;
  let cwd: string;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'boss-final-gate-'));
    cwd = process.cwd();
    process.chdir(tmpDir);
    initPipeline('test-feat', { cwd: tmpDir });
  });

  afterEach(() => {
    process.chdir(cwd);
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it('fails when required artifacts are missing from recorded execution state', () => {
    const result = evaluateFinalGate('test-feat', { cwd: tmpDir });

    expect(result.passed).toBe(false);
    expect(result.checks).toContainEqual({
      name: 'required-artifacts',
      passed: false,
      required: ['prd.md', 'architecture.md', 'tasks.md', 'qa-report.md'],
      recorded: [],
      missing: ['prd.md', 'architecture.md', 'tasks.md', 'qa-report.md']
    });
  });

  it('passes the required-artifacts check when required artifacts are recorded', () => {
    recordArtifact('test-feat', 'prd.md', 1, { cwd: tmpDir });
    recordArtifact('test-feat', 'architecture.md', 2, { cwd: tmpDir });
    recordArtifact('test-feat', 'tasks.md', 2, { cwd: tmpDir });
    recordArtifact('test-feat', 'qa-report.md', 4, { cwd: tmpDir });

    const result = evaluateFinalGate('test-feat', { cwd: tmpDir });

    expect(result.checks.find((check) => check.name === 'required-artifacts')).toMatchObject({
      name: 'required-artifacts',
      passed: true,
      missing: []
    });
  });

  it('fails when an agent is active or failed', () => {
    recordArtifact('test-feat', 'prd.md', 1, { cwd: tmpDir });
    recordArtifact('test-feat', 'architecture.md', 2, { cwd: tmpDir });
    recordArtifact('test-feat', 'tasks.md', 2, { cwd: tmpDir });
    recordArtifact('test-feat', 'qa-report.md', 4, { cwd: tmpDir });
    updateAgent('test-feat', 3, 'boss-backend', 'running', { cwd: tmpDir });
    updateAgent('test-feat', 3, 'boss-qa', 'failed', { cwd: tmpDir, reason: 'tests failed' });

    const result = evaluateFinalGate('test-feat', { cwd: tmpDir });

    expect(result.passed).toBe(false);
    expect(result.checks.find((check) => check.name === 'no-active-agents')).toMatchObject({
      passed: false,
      activeAgents: [{ stage: 3, agent: 'boss-backend', status: 'running' }]
    });
    expect(result.checks.find((check) => check.name === 'no-recent-failures')).toMatchObject({
      passed: false,
      recentFailures: [{ scope: 'agent', stage: 3, agent: 'boss-qa', reason: 'tests failed' }]
    });
  });

  it('fails when QA attack findings are open', () => {
    recordArtifact('test-feat', 'prd.md', 1, { cwd: tmpDir });
    recordArtifact('test-feat', 'architecture.md', 2, { cwd: tmpDir });
    recordArtifact('test-feat', 'tasks.md', 2, { cwd: tmpDir });
    recordArtifact('test-feat', 'qa-report.md', 4, { cwd: tmpDir });
    fs.writeFileSync(
      path.join(tmpDir, '.boss', 'test-feat', 'qa-report.md'),
      [
        '# QA Report',
        '',
        '## Verification',
        '- npm test',
        '',
        '## Evidence',
        '- Captured command output and artifact references.',
        '',
        '## Findings',
        '- [open] critical: final evidence is incomplete',
        '',
        '## QA Attack Checks',
        '- none',
        '',
        '## Known Failures',
        '- none',
        ''
      ].join('\n')
    );

    const result = evaluateFinalGate('test-feat', { cwd: tmpDir });

    expect(result.passed).toBe(false);
    expect(result.checks.find((check) => check.name === 'qa-attack-findings')).toMatchObject({
      passed: false,
      findings: [
        expect.objectContaining({
          id: 'qa-report-open-critical',
          severity: 'critical',
          status: 'open'
        })
      ]
    });
  });
});
