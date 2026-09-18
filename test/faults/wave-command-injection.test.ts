import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { initPipeline } from '../../packages/boss-cli/src/runtime/application/pipeline.js';
import { verifyWave } from '../../packages/boss-cli/src/runtime/application/wave-verification.js';
import { cleanupTempDir } from '../helpers/fixtures.js';

/**
 * 回归防护：wave 验证命令曾以 `spawnSync(cmd, { shell: true })` 执行，
 * 且命令取自 `tasks.md` 的 Markdown 表格单元格。任何能写该文件的人
 * （例如一个被克隆的仓库）都可以任意执行命令。
 *
 * 这些测试用「命令若被 shell 解释就会留下的副作用文件」作为探针：
 * 探针文件出现即表示注入成功。
 */
describe('wave verification command injection', () => {
  let tmpDir: string;
  const feature = 'inject-feat';

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'boss-inject-'));
    initPipeline(feature, { cwd: tmpDir });
  });

  afterEach(() => {
    cleanupTempDir(tmpDir);
  });

  function featureDir(): string {
    const dir = path.join(tmpDir, '.boss', feature);
    fs.mkdirSync(dir, { recursive: true });
    return dir;
  }

  function probePath(name: string): string {
    return path.join(tmpDir, name);
  }

  it('does not execute commands embedded in tasks.md table cells', () => {
    const probe = probePath('pwned-markdown');
    fs.writeFileSync(
      path.join(featureDir(), 'tasks.md'),
      [
        '| Evidence Wave | Scope | Owner Files | Red Tests | Green Gates | Contract Matrix | Stop Condition |',
        '| --- | --- | --- | --- | --- | --- | --- |',
        `| Wave X | s | \`src/a.ts\` | \`touch ${probe} && exit 1\` | \`true\` | CM | Stop |`,
      ].join('\n'),
    );

    // Markdown 不再提供命令，因此这里必然因「没有定义 redTests」而抛错
    expect(() => verifyWave(feature, 'wave-x', 'red', { cwd: tmpDir })).toThrow(
      '没有定义 redTests',
    );
    expect(fs.existsSync(probe)).toBe(false);
  });

  it('rejects shell metacharacters in waves.json before executing anything', () => {
    const probe = probePath('pwned-structured');
    fs.writeFileSync(
      path.join(featureDir(), 'waves.json'),
      JSON.stringify({
        waves: [
          {
            id: 'wave-y',
            title: 'Wave Y',
            redTests: [['sh', '-c', `touch ${probe} && exit 1`]],
            greenGates: [['true']],
          },
        ],
      }),
    );

    expect(() => verifyWave(feature, 'wave-y', 'red', { cwd: tmpDir })).toThrow(/shell 元字符/);
    expect(fs.existsSync(probe)).toBe(false);
  });

  it('treats a would-be injection payload as literal argv when it has no metacharacters', () => {
    // `touch` 的参数是普通路径，没有元字符，所以命令合法并会真正执行 —
    // 这正是 argv 直传的语义：参数就是参数，不会被再解释一层。
    const probe = probePath('legit-touch');
    fs.writeFileSync(
      path.join(featureDir(), 'waves.json'),
      JSON.stringify({
        waves: [
          {
            id: 'wave-z',
            title: 'Wave Z',
            redTests: [['false']],
            greenGates: [['touch', probe]],
          },
        ],
      }),
    );

    const result = verifyWave(feature, 'wave-z', 'green', { cwd: tmpDir });
    expect(result.greenGates!.allCorrect).toBe(true);
    expect(fs.existsSync(probe)).toBe(true);
  });

  it('reports a missing executable as exit 127 instead of a shell error', () => {
    fs.writeFileSync(
      path.join(featureDir(), 'waves.json'),
      JSON.stringify({
        waves: [
          {
            id: 'wave-missing',
            title: 'Wave Missing',
            redTests: [['definitely-not-a-real-binary-xyz']],
            greenGates: [['true']],
          },
        ],
      }),
    );

    const result = verifyWave(feature, 'wave-missing', 'red', { cwd: tmpDir });
    const first = result.redTests!.results[0]!;
    expect(first.exitCode).toBe(127);
    expect(first.stderr).toContain('找不到可执行文件');
    // 找不到可执行文件不构成有效的「红」：否则拼错命令名就能伪造红测通过。
    expect(first.passed).toBe(false);
    expect(result.verified).toBe(false);
  });

  it('prefers waves.json over tasks.md when both exist', () => {
    const dir = featureDir();
    fs.writeFileSync(
      path.join(dir, 'tasks.md'),
      [
        '| Evidence Wave | Scope | Owner Files | Red Tests | Green Gates | Contract Matrix | Stop Condition |',
        '| --- | --- | --- | --- | --- | --- | --- |',
        '| Wave Dup | md | `src/md.ts` | `true` | `true` | CM-md | Stop md |',
      ].join('\n'),
    );
    fs.writeFileSync(
      path.join(dir, 'waves.json'),
      JSON.stringify({
        waves: [
          {
            id: 'wave-dup',
            title: 'Wave Dup',
            scope: 'structured',
            redTests: [['false']],
            greenGates: [['true']],
          },
        ],
      }),
    );

    const result = verifyWave(feature, 'wave-dup', 'full', { cwd: tmpDir });
    expect(result.verified).toBe(true);
    expect(result.redTests!.results[0]!.command).toBe('false');
  });
});
