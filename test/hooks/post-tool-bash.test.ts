import { beforeEach, describe, expect, it, vi } from 'vitest';

describe('post-tool-bash hook', () => {
  let hook: typeof import('../../scripts/hooks/post-tool-bash.js');

  beforeEach(async () => {
    vi.resetModules();
    hook = await import('../../scripts/hooks/post-tool-bash.js');
  });

  it('returns empty string for empty command', () => {
    expect(
      hook.run(
        JSON.stringify({
          tool_input: { command: '' },
          cwd: '/tmp'
        })
      )
    ).toBe('');
  });

  it('returns empty string for non-harness commands', () => {
    expect(
      hook.run(
        JSON.stringify({
          tool_input: { command: 'ls -la' },
          cwd: '/tmp'
        })
      )
    ).toBe('');
  });

  it('detects gate commands', () => {
    const parsed = JSON.parse(
      hook.run(
        JSON.stringify({
          tool_input: { command: 'node runtime/cli/evaluate-gates.js my-feat gate0' },
          cwd: '/tmp'
        })
      )
    ) as {
      hookSpecificOutput: { additionalContext: string };
    };

    expect(parsed.hookSpecificOutput.additionalContext).toContain('门禁');
    expect(parsed.hookSpecificOutput.additionalContext).toContain('read model');
  });

  it('detects harness commands', () => {
    const parsed = JSON.parse(
      hook.run(
        JSON.stringify({
          tool_input: { command: 'node runtime/cli/update-stage.js my-feat 1 running' },
          cwd: '/tmp'
        })
      )
    ) as {
      hookSpecificOutput: { additionalContext: string };
    };

    expect(parsed.hookSpecificOutput.additionalContext).toContain('流水线');
  });
});
