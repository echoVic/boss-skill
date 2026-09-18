import { describe, expect, it } from 'vitest';

import {
  formatCommand,
  InvalidCommandError,
  normalizeCommand,
  normalizeCommands,
} from '../../packages/boss-cli/src/runtime/domain/structured-wave.js';

describe('domain/structured-wave command normalization', () => {
  it('accepts an argv array', () => {
    expect(normalizeCommand(['npm', 'test', '--', 'data.test.ts'], 'redTests')).toEqual({
      command: 'npm',
      args: ['test', '--', 'data.test.ts'],
    });
  });

  it('accepts a { command, args } object', () => {
    expect(normalizeCommand({ command: 'npm', args: ['run', 'typecheck'] }, 'greenGates')).toEqual({
      command: 'npm',
      args: ['run', 'typecheck'],
    });
  });

  it('defaults args to an empty array', () => {
    expect(normalizeCommand({ command: 'true' }, 'greenGates')).toEqual({
      command: 'true',
      args: [],
    });
  });

  it('rejects a bare string because it would need shell splitting', () => {
    expect(() => normalizeCommand('npm test', 'redTests')).toThrow(InvalidCommandError);
    expect(() => normalizeCommand('npm test', 'redTests')).toThrow(/不能是字符串/);
  });

  it.each([
    ['command chaining', ['sh', '-c', 'touch /tmp/pwned && exit 1']],
    ['pipe', ['cat', 'report.json | jq .ok']],
    ['redirect', ['echo', 'x > /etc/passwd']],
    ['subshell', ['echo', '$(whoami)']],
    ['backtick', ['echo', '`id`']],
    ['semicolon', ['npm', 'test; rm -rf /']],
    ['newline', ['npm', 'test\nrm -rf /']],
    ['glob', ['rm', '*.ts']],
  ])('rejects %s in any argv element', (_label, argv) => {
    // 核心安全不变量：任何 shell 元字符都必须在执行前被拒绝，
    // 因为命令来源（waves.json / tasks.md）可能来自不受信任的仓库。
    expect(() => normalizeCommand(argv, 'redTests')).toThrow(InvalidCommandError);
  });

  it('reports the offending field and value on rejection', () => {
    try {
      normalizeCommands([['ok'], ['bad', 'a && b']], 'greenGates');
      throw new Error('should have thrown');
    } catch (err) {
      expect(err).toBeInstanceOf(InvalidCommandError);
      const typed = err as InvalidCommandError;
      expect(typed.field).toBe('greenGates[1]');
      expect(typed.value).toBe('a && b');
    }
  });

  it('allows ordinary flags, paths and version specifiers', () => {
    const cases = [
      ['npm', 'test', '--', 'test/a.test.ts'],
      ['pytest', '-q', 'tests/test_x.py::test_y'],
      ['go', 'test', './...'],
      ['cargo', 'test', '--all-features'],
      ['./node_modules/.bin/vitest', 'run'],
      ['python3', '-m', 'pytest'],
    ];
    for (const argv of cases) {
      expect(() => normalizeCommand(argv, 'redTests')).not.toThrow();
    }
  });

  it('rejects an empty command list entry', () => {
    expect(() => normalizeCommand([], 'redTests')).toThrow(/命令数组为空/);
    expect(() => normalizeCommand({}, 'redTests')).toThrow(/缺少 command 字段/);
  });

  it('normalizes a list and treats null as empty', () => {
    expect(normalizeCommands(null, 'redTests')).toEqual([]);
    expect(normalizeCommands(undefined, 'redTests')).toEqual([]);
    expect(normalizeCommands([['true'], { command: 'false' }], 'redTests')).toEqual([
      { command: 'true', args: [] },
      { command: 'false', args: [] },
    ]);
  });

  it('rejects a non-array command list', () => {
    expect(() => normalizeCommands('npm test', 'redTests')).toThrow(/必须是数组/);
  });

  it('formats a command for display only', () => {
    expect(formatCommand({ command: 'npm', args: ['test', '--', 'a.ts'] })).toBe(
      'npm test -- a.ts',
    );
  });
});
