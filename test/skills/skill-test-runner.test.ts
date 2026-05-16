import { describe, expect, it } from 'vitest';
import path from 'node:path';

import { evaluateTranscriptFile } from './skill-test-runner.js';

const FIXTURES = path.resolve(import.meta.dirname, 'fixtures');

describe('Boss skill behavior runner', () => {
  it('produces a passing report when boss skill loads before actions', () => {
    const report = evaluateTranscriptFile({
      id: 'explicit-boss-good',
      transcriptPath: path.join(FIXTURES, 'claude-good.jsonl'),
      requiredSkill: 'boss',
      requiredMethodologySkills: ['pm/requirement-penetration']
    });

    expect(report).toEqual({
      id: 'explicit-boss-good',
      passed: true,
      requiredSkill: 'boss',
      skillLoaded: true,
      noPrematureAction: true,
      methodologySkillsLoaded: ['pm/requirement-penetration'],
      missingMethodologySkills: [],
      firstSkillIndex: 0,
      firstActionIndex: 2,
      toolNames: ['Skill', 'Write'],
      usage: {
        inputTokens: 20,
        outputTokens: 5,
        cacheCreationInputTokens: 3,
        cacheReadInputTokens: 7
      },
      failures: []
    });
  });

  it('fails when a write action happens before boss skill load', () => {
    const report = evaluateTranscriptFile({
      id: 'explicit-boss-premature',
      transcriptPath: path.join(FIXTURES, 'codex-premature-action.jsonl'),
      requiredSkill: 'boss'
    });

    expect(report.passed).toBe(false);
    expect(report.skillLoaded).toBe(true);
    expect(report.noPrematureAction).toBe(false);
    expect(report.failures).toContain('tool apply_patch ran before Skill(boss)');
  });

  it('reports missing methodology skills separately from boss loading', () => {
    const report = evaluateTranscriptFile({
      id: 'missing-methodology',
      transcriptPath: path.join(FIXTURES, 'claude-good.jsonl'),
      requiredSkill: 'boss',
      requiredMethodologySkills: ['qa/test-strategy']
    });

    expect(report.passed).toBe(false);
    expect(report.skillLoaded).toBe(true);
    expect(report.missingMethodologySkills).toEqual(['qa/test-strategy']);
    expect(report.failures).toContain('missing methodology skill: qa/test-strategy');
  });
});
