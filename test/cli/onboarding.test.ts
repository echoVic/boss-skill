import { spawnSync } from 'node:child_process';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';

import { afterEach, describe, expect, it } from 'vitest';

import { ensureBuilt } from '../helpers/run-cli.js';

const BOSS_ENTRYPOINT = 'packages/boss-cli/dist/bin/boss.js';
const REPO_ROOT = path.resolve(import.meta.dirname, '..', '..');

let tmpDir: string | null = null;

function run(args: string[]): { stdout: string; stderr: string; status: number | null } {
  ensureBuilt(BOSS_ENTRYPOINT);
  tmpDir ??= fs.mkdtempSync(path.join(os.tmpdir(), 'boss-onboarding-'));
  const result = spawnSync(process.execPath, [path.join(REPO_ROOT, BOSS_ENTRYPOINT), ...args], {
    cwd: tmpDir,
    encoding: 'utf8',
  });
  return { stdout: result.stdout, stderr: result.stderr, status: result.status };
}

afterEach(() => {
  if (tmpDir) {
    fs.rmSync(tmpDir, { recursive: true, force: true });
    tmpDir = null;
  }
});

/**
 * `boss --help` 是新用户敲下的第一条命令，它必须回答「这是什么、我下一步做什么」。
 *
 * 此前它先列 --json / --describe / --fields 这些给 agent 用的全局选项，再列 15 个
 * 没有任何描述的命令，且完全没提这个 CLI 是给 skill 当运行时的——用户该去自己的
 * coding agent 里敲 `/boss`。注册表里其实已经有 65 条 summary，只是没被 help 用上。
 */
describe('boss --help orients a first-time reader', () => {
  it('says what to type in the coding agent before listing CLI commands', () => {
    const { stdout } = run(['--help']);
    const gettingStarted = stdout.indexOf('/boss');
    const commands = stdout.indexOf('Commands:');

    expect(gettingStarted).toBeGreaterThanOrEqual(0);
    expect(gettingStarted).toBeLessThan(commands);
  });

  it('describes every command instead of listing bare names', () => {
    const { stdout } = run(['--help']);
    const commandBlock = stdout.slice(stdout.indexOf('Commands:'));

    for (const [command, hint] of [
      ['doctor', 'diagnose'],
      ['status', 'state'],
      ['gate', 'gate'],
    ] as const) {
      const line = commandBlock.split('\n').find((item) => item.trim().startsWith(command));
      expect(line, `missing description for ${command}`).toBeDefined();
      expect(line!.toLowerCase()).toContain(hint);
    }
  });

  it('keeps agent-facing flags out of the first screen', () => {
    const { stdout } = run(['--help']);
    // --json / --fields 是给调用方 agent 用的；人类第一屏不需要它们
    expect(stdout.indexOf('Commands:')).toBeLessThan(stdout.indexOf('--fields'));
  });
});

/**
 * 用法错误不是内部故障：调用方有明确的处置动作，错误码必须能区分。
 */
describe('usage errors are typed', () => {
  it('reports a missing required argument as invalid_usage', () => {
    const { stderr, status } = run(['status', '--json']);
    const payload = JSON.parse(stderr) as { error: { code: string; suggestion?: string } };

    expect(status).toBe(1);
    expect(payload.error.code).toBe('invalid_usage');
    expect(payload.error.suggestion).toBeTruthy();
  });
});

/**
 * `init` 是任何人想开始时的第一直觉，真正的命令却是 `project init`。
 * 未知命令应当给出最接近的候选，而不是让用户回去翻文档。
 */
describe('unknown commands suggest the closest real one', () => {
  it('points init at project init', () => {
    const { stderr } = run(['init', '--json']);
    const payload = JSON.parse(stderr) as { error: { code: string; suggestion?: string } };

    expect(payload.error.code).toBe('unknown_command');
    expect(payload.error.suggestion).toContain('project init');
  });

  it('still suggests something for a typo', () => {
    const { stderr } = run(['docter', '--json']);
    const payload = JSON.parse(stderr) as { error: { suggestion?: string } };

    expect(payload.error.suggestion).toContain('doctor');
  });
});
