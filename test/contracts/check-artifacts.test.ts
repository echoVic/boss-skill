import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';

const ROOT = path.resolve(import.meta.dirname, '..', '..');
const SCRIPT = path.join(ROOT, 'skill', 'scripts', 'check-artifacts.mjs');

const GOOD_PRD = `# PRD: Todo CLI

## Summary

- A local todo CLI for one user.
- Stores tasks in a JSON file.

## Requirements

### R1 Add a task (explicit, P0 — core value, low cost)

- Given an empty list
- When the user runs \`todo add "buy milk"\`
- Then the list contains one open task named "buy milk"

## Out of scope

- Sync between devices.
`;

const GOOD_PRD_ZH = `# PRD：待办 CLI

## 摘要

- 面向单人的本地待办工具。

## 功能需求

### R1 新增任务（显性，P0）

- 假设列表为空
- 当用户执行 \`todo add "买牛奶"\`
- 那么列表里有一条未完成任务

## 不做什么

- 多设备同步。
`;

const GOOD_QA = `# QA Report

## Summary

- Verified: unit tests. Unverified: none.

## Test runs

| Command | Exit code | Passed/Failed/Skipped | Failures |
| --- | --- | --- | --- |
| \`npm test\` | 0 | 12/0/0 | none |
`;

let workdir = '';

function feature(files: Record<string, string>): string {
  workdir = fs.mkdtempSync(path.join(os.tmpdir(), 'boss-contracts-'));
  const dir = path.join(workdir, '.boss', 'todo-cli');
  fs.mkdirSync(dir, { recursive: true });
  for (const [name, content] of Object.entries(files)) {
    fs.writeFileSync(path.join(dir, name), content);
  }
  return dir;
}

function check(dir: string, ...args: string[]) {
  const result = spawnSync(process.execPath, [SCRIPT, dir, ...args], { encoding: 'utf8' });
  return { status: result.status, out: `${result.stdout}\n${result.stderr}` };
}

describe('check-artifacts', () => {
  afterEach(() => {
    if (workdir) fs.rmSync(workdir, { recursive: true, force: true });
    workdir = '';
  });

  it('passes a PRD that meets the mechanical contract, in English or Chinese', () => {
    for (const prd of [GOOD_PRD, GOOD_PRD_ZH]) {
      const result = check(feature({ 'prd.md': prd }));
      expect(result.status, result.out).toBe(0);
      expect(result.out).toContain('PASS prd.md given-when-then');
    }
  });

  it.each(['## Out-of-scope', '## Not in scope', '### Non-goals', '## 不做什么'])(
    'accepts "%s" as the out-of-scope section',
    (heading) => {
      const result = check(feature({ 'prd.md': GOOD_PRD.replace('## Out of scope', heading) }));
      expect(result.status, result.out).toBe(0);
    },
  );

  it('fails a PRD with no acceptance scenario and names the rule', () => {
    const prd = GOOD_PRD.replace(/- Given[\s\S]*?"buy milk"\n\n/, '- The user can add tasks.\n\n');
    const result = check(feature({ 'prd.md': prd }));
    expect(result.status, result.out).toBe(1);
    expect(result.out).toContain('FAIL prd.md given-when-then');
  });

  it('fails on leftover placeholders but ignores them inside code', () => {
    const withPlaceholder = check(
      feature({ 'prd.md': `${GOOD_PRD}\n## Open questions\n\nStorage path: TBD\n` }),
    );
    expect(withPlaceholder.status, withPlaceholder.out).toBe(1);
    expect(withPlaceholder.out).toContain('FAIL prd.md no-placeholders');

    const quoted = check(
      feature({ 'prd.md': `${GOOD_PRD}\nThe CLI prints \`TBD\` for unset dates.\n` }),
    );
    expect(quoted.status, quoted.out).toBe(0);
  });

  it('fails when the summary is not the first section', () => {
    const prd = GOOD_PRD.replace('## Summary', '## Overview');
    const result = check(feature({ 'prd.md': prd }));
    expect(result.status, result.out).toBe(1);
    expect(result.out).toContain('FAIL prd.md summary-first');
  });

  it('requires a QA report to record a command with an exit code and result counts', () => {
    const good = check(feature({ 'qa-report.md': GOOD_QA }));
    expect(good.status, good.out).toBe(0);

    const claimsOnly = check(
      feature({ 'qa-report.md': '# QA Report\n\n## Summary\n\n- All tests should pass.\n' }),
    );
    expect(claimsOnly.status, claimsOnly.out).toBe(1);
    expect(claimsOnly.out).toContain('FAIL qa-report.md exit-code');
    expect(claimsOnly.out).toContain('FAIL qa-report.md no-speculation');
  });

  it('rejects a review whose verdict line still lists every option', () => {
    const template =
      '# Tech Review\n\n## 摘要\n\n- **评审结论**：✅ 通过 / ⚠️ 有条件通过 / ❌ 不通过\n';
    const undecided = check(feature({ 'tech-review.md': template }));
    expect(undecided.status, undecided.out).toBe(1);
    expect(undecided.out).toContain('FAIL tech-review.md single-verdict');

    const decided = check(
      feature({ 'tech-review.md': '# Tech Review\n\n## Summary\n\n- **Verdict**: Approved\n' }),
    );
    expect(decided.status, decided.out).toBe(0);
  });

  it('accepts a code review whose findings cite path:line inside inline code', () => {
    const review =
      '# Code review\n\n## Summary\n\n**Verdict: Changes required**\n\n## Findings\n\n' +
      '### 1. [blocker] Discount applied twice — `src/cart.js:10-11`\n';
    const cited = check(feature({ 'code-review.md': review }));
    expect(cited.status, cited.out).toBe(0);

    const vague = check(
      feature({ 'code-review.md': review.replace(' — `src/cart.js:10-11`', '') }),
    );
    expect(vague.status, vague.out).toBe(1);
    expect(vague.out).toContain('FAIL code-review.md findings-cite-lines');
  });

  it.each([
    '- **结论**：需要修改',
    '**Conclusion: needs changes**',
    'Verdict — Changes requested',
    '- 评审结论：⚠️ 有条件通过',
    '**Verdict: Approve**',
  ])('recognises the verdict wording "%s"', (line) => {
    const result = check(feature({ 'tech-review.md': `# Review\n\n## Summary\n\n${line}\n` }));
    expect(result.status, result.out).toBe(0);
  });

  it('fails when an artifact a stage must produce is missing', () => {
    const dir = feature({ 'prd.md': GOOD_PRD });
    const result = check(dir, '--require', 'prd.md,architecture.md');
    expect(result.status, result.out).toBe(1);
    expect(result.out).toContain('FAIL architecture.md exists');
  });

  it('prints machine-readable results with --json', () => {
    const result = spawnSync(
      process.execPath,
      [SCRIPT, feature({ 'prd.md': GOOD_PRD }), '--json'],
      {
        encoding: 'utf8',
      },
    );
    const report = JSON.parse(result.stdout) as {
      ok: boolean;
      results: { file: string; rule: string; ok: boolean }[];
    };
    expect(report.ok).toBe(true);
    expect(report.results.some((r) => r.file === 'prd.md' && r.rule === 'out-of-scope')).toBe(true);
  });

  it('exits 2 with usage when the feature directory does not exist', () => {
    const result = check(path.join(os.tmpdir(), 'boss-contracts-missing-dir'));
    expect(result.status).toBe(2);
  });
});
