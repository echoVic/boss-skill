import { describe, expect, it } from 'vitest';
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

const REPO_ROOT = path.resolve(import.meta.dirname, '..', '..');
const BOSS_BIN = path.join(REPO_ROOT, 'packages', 'boss-cli', 'dist', 'bin', 'boss.js');

function read(relativePath: string) {
  return fs.readFileSync(path.join(REPO_ROOT, relativePath), 'utf8');
}

describe('phase-1 direct-write guard', () => {
  it('keeps critical writer paths free of direct execution.json mutations', () => {
    const criticalFiles = [
      'scripts/hooks/post-tool-write.js',
      'scripts/gates/gate-runner.sh',
      'packages/boss-cli/src/runtime/cli/evaluate-gates.ts',
      'packages/boss-cli/src/runtime/cli/lib/pipeline-runtime.ts',
      'packages/boss-cli/src/runtime/cli/register-plugins.ts',
      'scripts/harness/load-plugins.sh'
    ];

    const forbiddenPatterns = [
      /writeFileSync\([^\n]*execution\.json/,
      /appendFileSync\([^\n]*execution\.json/,
      /jq[^\n]*execution\.json/,
      /\b(?:cat|echo|printf|jq)[^\n>]*>\s*[^\n]*execution\.json/,
      /\btee\b[^\n]*execution\.json/
    ];

    for (const relativePath of criticalFiles) {
      const source = read(relativePath);
      for (const pattern of forbiddenPatterns) {
        expect(source, `${relativePath} should not directly mutate execution.json`).not.toMatch(pattern);
      }
    }
  });

  it('keeps runtime-first writer paths free of shell wrapper orchestration', () => {
    const runtimeFirstFiles = [
      'scripts/hooks/post-tool-write.js',
      'packages/boss-cli/src/runtime/cli/lib/pipeline-runtime.ts',
      'scripts/hooks/subagent-start.js',
      'scripts/hooks/subagent-stop.js'
    ];

    const wrapperPatterns = [
      /append-event\.sh/,
      /materialize-state\.sh/,
      /update-stage\.sh/,
      /update-agent\.sh/
    ];

    for (const relativePath of runtimeFirstFiles) {
      const source = read(relativePath);
      for (const pattern of wrapperPatterns) {
        expect(
          source,
          `${relativePath} should use runtime APIs directly instead of shell wrappers`
        ).not.toMatch(pattern);
      }
    }
  });

  it('plugin registration help describes event-sourced read-model semantics', () => {
    const registerResult = spawnSync(process.execPath, [BOSS_BIN, 'runtime', 'register-plugins', '--help'], {
      cwd: REPO_ROOT,
      encoding: 'utf8'
    });

    expect(registerResult.status, registerResult.stderr).toBe(0);
    expect(registerResult.stdout).toMatch(/事件/);
    expect(registerResult.stdout).toMatch(/read model/);
  });
});
