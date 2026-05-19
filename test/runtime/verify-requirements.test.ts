import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { initPipeline } from '../../packages/boss-cli/src/runtime/application/pipeline.js';
import {
  verifyRequirements,
  parseAcceptanceCriteria
} from '../../packages/boss-cli/src/runtime/application/requirements-verification.js';
import { cleanupTempDir } from '../helpers/fixtures.js';

function writePrd(tmpDir: string, feature: string, content: string): void {
  const featureDir = path.join(tmpDir, '.boss', feature);
  fs.mkdirSync(featureDir, { recursive: true });
  fs.writeFileSync(path.join(featureDir, 'prd.md'), content);
}

function writeTestFile(tmpDir: string, relativePath: string, content: string): void {
  const fullPath = path.join(tmpDir, relativePath);
  fs.mkdirSync(path.dirname(fullPath), { recursive: true });
  fs.writeFileSync(fullPath, content);
}

describe('verify-requirements', () => {
  let tmpDir: string;
  const feature = 'test-feat';

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'boss-verify-req-'));
    initPipeline(feature, { cwd: tmpDir });
  });

  afterEach(() => {
    cleanupTempDir(tmpDir);
  });

  describe('parseAcceptanceCriteria', () => {
    it('parses AC-N with Chinese colon', () => {
      const criteria = parseAcceptanceCriteria('- [ ] AC-1：用户可以登录');
      expect(criteria).toHaveLength(1);
      expect(criteria[0]).toMatchObject({
        id: 'AC-1',
        description: '用户可以登录',
        section: ''
      });
    });

    it('parses AC-N with English colon', () => {
      const criteria = parseAcceptanceCriteria('- [ ] AC-2: Password encrypted');
      expect(criteria).toHaveLength(1);
      expect(criteria[0]).toMatchObject({
        id: 'AC-2',
        description: 'Password encrypted'
      });
    });

    it('tracks section context from headers (FR-xxx)', () => {
      const content = [
        '## FR-001 Authentication',
        '- [ ] AC-1：Login works',
        '- [ ] AC-2：Logout works',
        '## FR-002 Dashboard',
        '- [ ] AC-3：Shows stats'
      ].join('\n');
      const criteria = parseAcceptanceCriteria(content);
      expect(criteria[0]!.section).toBe('FR-001');
      expect(criteria[1]!.section).toBe('FR-001');
      expect(criteria[2]!.section).toBe('FR-002');
    });

    it('tracks US-xxx section format', () => {
      const content = [
        '### US-010 User Story',
        '- [ ] AC-1：Acceptance'
      ].join('\n');
      const criteria = parseAcceptanceCriteria(content);
      expect(criteria[0]!.section).toBe('US-010');
    });

    it('handles checked checkboxes', () => {
      const criteria = parseAcceptanceCriteria('- [x] AC-1：Already done');
      expect(criteria).toHaveLength(1);
      expect(criteria[0]!.id).toBe('AC-1');
    });

    it('handles bullet with asterisk', () => {
      const criteria = parseAcceptanceCriteria('* [ ] AC-5：Star bullet');
      expect(criteria).toHaveLength(1);
      expect(criteria[0]!.id).toBe('AC-5');
    });

    it('returns empty for content without AC patterns', () => {
      const criteria = parseAcceptanceCriteria('# No criteria here\nJust text.');
      expect(criteria).toHaveLength(0);
    });
  });

  describe('verifyRequirements', () => {
    it('throws when PRD file does not exist', () => {
      expect(() => verifyRequirements(feature, { cwd: tmpDir })).toThrow('未找到 PRD 文件');
    });

    it('throws when PRD has no AC patterns', () => {
      writePrd(tmpDir, feature, '# PRD\nNo acceptance criteria here.');
      expect(() => verifyRequirements(feature, { cwd: tmpDir })).toThrow('未找到验收标准');
    });

    it('verified=true when all ACs are covered by test files', () => {
      writePrd(tmpDir, feature, [
        '## FR-001 Auth',
        '- [ ] AC-1：Login',
        '- [ ] AC-2：Logout'
      ].join('\n'));
      writeTestFile(tmpDir, 'src/auth.test.ts', '// AC-1 AC-2 coverage');

      const result = verifyRequirements(feature, { cwd: tmpDir, dryRun: true });
      expect(result.verified).toBe(true);
      expect(result.totalACs).toBe(2);
      expect(result.coveredACs).toBe(2);
      expect(result.uncoveredACs).toBe(0);
      expect(result.coveragePercent).toBe(100);
    });

    it('verified=false when some ACs are not covered', () => {
      writePrd(tmpDir, feature, [
        '- [ ] AC-1：Covered',
        '- [ ] AC-2：Not covered'
      ].join('\n'));
      writeTestFile(tmpDir, 'src/auth.test.ts', '// Tests for AC-1');

      const result = verifyRequirements(feature, { cwd: tmpDir, dryRun: true });
      expect(result.verified).toBe(false);
      expect(result.coveredACs).toBe(1);
      expect(result.uncoveredACs).toBe(1);
      expect(result.coveragePercent).toBe(50);
    });

    it('matrix rows contain correct data', () => {
      writePrd(tmpDir, feature, [
        '## FR-001 Auth',
        '- [ ] AC-1：Login'
      ].join('\n'));
      writeTestFile(tmpDir, 'src/login.test.ts', 'describe("AC-1 login flow", () => {});');

      const result = verifyRequirements(feature, { cwd: tmpDir, dryRun: true });
      expect(result.matrix[0]).toMatchObject({
        ac: 'AC-1',
        description: 'Login',
        section: 'FR-001',
        covered: true
      });
      expect(result.matrix[0]!.testFiles).toContain('src/login.test.ts');
    });

    it('respects --test-dir to limit search scope', () => {
      writePrd(tmpDir, feature, '- [ ] AC-1：Feature');
      writeTestFile(tmpDir, 'src/a.test.ts', '// AC-1 here');
      writeTestFile(tmpDir, 'other/b.test.ts', '// AC-1 also here');

      const result = verifyRequirements(feature, { cwd: tmpDir, testDir: 'other', dryRun: true });
      expect(result.verified).toBe(true);
      expect(result.matrix[0]!.testFiles).toHaveLength(1);
      expect(result.matrix[0]!.testFiles[0]).toContain('other');
    });

    it('excludes node_modules from scan', () => {
      writePrd(tmpDir, feature, '- [ ] AC-1：Feature');
      writeTestFile(tmpDir, 'node_modules/pkg/index.test.ts', '// AC-1');

      const result = verifyRequirements(feature, { cwd: tmpDir, dryRun: true });
      expect(result.verified).toBe(false);
      expect(result.matrix[0]!.testFiles).toHaveLength(0);
    });

    it('excludes .boss directory from scan', () => {
      writePrd(tmpDir, feature, '- [ ] AC-1：Feature');
      writeTestFile(tmpDir, '.boss/test-feat/some.test.ts', '// AC-1');

      const result = verifyRequirements(feature, { cwd: tmpDir, dryRun: true });
      expect(result.verified).toBe(false);
    });

    it('excludes dist directory from scan', () => {
      writePrd(tmpDir, feature, '- [ ] AC-1：Feature');
      writeTestFile(tmpDir, 'dist/compiled.test.js', '// AC-1');

      const result = verifyRequirements(feature, { cwd: tmpDir, dryRun: true });
      expect(result.verified).toBe(false);
    });

    it('scans multiple test file extensions', () => {
      writePrd(tmpDir, feature, [
        '- [ ] AC-1：Feature A',
        '- [ ] AC-2：Feature B',
        '- [ ] AC-3：Feature C'
      ].join('\n'));
      writeTestFile(tmpDir, 'test/a.spec.ts', '// AC-1');
      writeTestFile(tmpDir, 'test/b.test.js', '// AC-2');
      writeTestFile(tmpDir, 'test/c.spec.jsx', '// AC-3');

      const result = verifyRequirements(feature, { cwd: tmpDir, dryRun: true });
      expect(result.verified).toBe(true);
      expect(result.coveredACs).toBe(3);
    });
  });

  describe('event recording', () => {
    it('appends RequirementsVerified event to events.jsonl', () => {
      writePrd(tmpDir, feature, '- [ ] AC-1：Feature');
      writeTestFile(tmpDir, 'src/a.test.ts', '// AC-1');

      const result = verifyRequirements(feature, { cwd: tmpDir });
      expect(result.event).toBeDefined();
      expect(result.event!.type).toBe('RequirementsVerified');

      const eventsPath = path.join(tmpDir, '.boss', feature, '.meta', 'events.jsonl');
      const events = fs
        .readFileSync(eventsPath, 'utf8')
        .trim()
        .split('\n')
        .map((line) => JSON.parse(line) as { type: string; data: Record<string, unknown> });
      const reqEvent = events.find((e) => e.type === 'RequirementsVerified');
      expect(reqEvent).toBeDefined();
      expect(reqEvent!.data.verified).toBe(true);
      expect(reqEvent!.data.totalACs).toBe(1);
    });

    it('dry-run does not write event', () => {
      writePrd(tmpDir, feature, '- [ ] AC-1：Feature');
      writeTestFile(tmpDir, 'src/a.test.ts', '// AC-1');

      const result = verifyRequirements(feature, { cwd: tmpDir, dryRun: true });
      expect(result.event).toBeUndefined();

      const eventsPath = path.join(tmpDir, '.boss', feature, '.meta', 'events.jsonl');
      const events = fs
        .readFileSync(eventsPath, 'utf8')
        .trim()
        .split('\n')
        .map((line) => JSON.parse(line) as { type: string });
      const reqEvent = events.find((e) => e.type === 'RequirementsVerified');
      expect(reqEvent).toBeUndefined();
    });
  });

  it('throws when feature name is empty', () => {
    expect(() => verifyRequirements('', { cwd: tmpDir })).toThrow('缺少 feature');
  });
});
