import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import {
  initPipeline,
  recordArtifact
} from '../../packages/boss-cli/src/runtime/application/pipeline.js';
import { runQaAttack } from '../../packages/boss-cli/src/runtime/application/qa-attack.js';

describe('qa attack runtime', () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'boss-qa-attack-'));
    initPipeline('test-feat', { cwd: tmpDir });
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true, maxRetries: 5, retryDelay: 200 });
  });

  it('marks missing QA report evidence as an open critical finding', () => {
    const result = runQaAttack('test-feat', { cwd: tmpDir });

    expect(result.status).toBe('failed');
    expect(result.findings).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: 'qa-report-missing',
          severity: 'critical',
          status: 'open'
        })
      ])
    );
  });

  it('passes when recorded QA evidence contains required neutral sections', () => {
    const featureDir = path.join(tmpDir, '.boss', 'test-feat');
    fs.writeFileSync(
      path.join(featureDir, 'qa-report.md'),
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
        '- none',
        '',
        '## QA Attack Checks',
        '- none',
        '',
        '## Known Failures',
        '- none',
        ''
      ].join('\n')
    );
    recordArtifact('test-feat', 'qa-report.md', 4, { cwd: tmpDir });

    const result = runQaAttack('test-feat', { cwd: tmpDir });

    expect(result).toEqual({
      feature: 'test-feat',
      status: 'passed',
      findings: []
    });
  });

  it('accepts the built-in QA report template headings', () => {
    const template = fs.readFileSync(
      path.join(process.cwd(), 'skill', 'templates', 'qa-report.md.template'),
      'utf8'
    );
    fs.writeFileSync(path.join(tmpDir, '.boss', 'test-feat', 'qa-report.md'), template);
    recordArtifact('test-feat', 'qa-report.md', 4, { cwd: tmpDir });

    const result = runQaAttack('test-feat', { cwd: tmpDir });

    expect(result.findings.filter((finding) => finding.id.endsWith('-missing'))).toEqual([]);
  });

  it('fails when a required evidence group is absent', () => {
    const featureDir = path.join(tmpDir, '.boss', 'test-feat');
    fs.writeFileSync(
      path.join(featureDir, 'qa-report.md'),
      [
        '# QA Report',
        '',
        '## Verification',
        '- npm test',
        '',
        '## Findings',
        '- none',
        ''
      ].join('\n')
    );
    recordArtifact('test-feat', 'qa-report.md', 4, { cwd: tmpDir });

    const result = runQaAttack('test-feat', { cwd: tmpDir });

    expect(result.status).toBe('failed');
    expect(result.findings).toContainEqual(
      expect.objectContaining({
        id: 'qa-report-evidence-missing',
        severity: 'high',
        status: 'open'
      })
    );
  });

  it('fails when the QA report records an open critical finding', () => {
    const featureDir = path.join(tmpDir, '.boss', 'test-feat');
    fs.writeFileSync(
      path.join(featureDir, 'qa-report.md'),
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
        '- [open] critical: final gate was not executed',
        '',
        '## QA Attack Checks',
        '- none',
        '',
        '## Known Failures',
        '- none',
        ''
      ].join('\n')
    );
    recordArtifact('test-feat', 'qa-report.md', 4, { cwd: tmpDir });

    const result = runQaAttack('test-feat', { cwd: tmpDir });

    expect(result.status).toBe('failed');
    expect(result.findings).toContainEqual(
      expect.objectContaining({
        id: 'qa-report-open-critical',
        severity: 'critical',
        status: 'open'
      })
    );
  });

  it('does not fail closed critical findings', () => {
    const featureDir = path.join(tmpDir, '.boss', 'test-feat');
    fs.writeFileSync(
      path.join(featureDir, 'qa-report.md'),
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
        '- critical: closed after mitigation',
        '',
        '## QA Attack Checks',
        '- none',
        '',
        '## Known Failures',
        '- none',
        ''
      ].join('\n')
    );
    recordArtifact('test-feat', 'qa-report.md', 4, { cwd: tmpDir });

    const result = runQaAttack('test-feat', { cwd: tmpDir });

    expect(result.status).toBe('passed');
    expect(result.findings).toEqual([]);
  });
});
