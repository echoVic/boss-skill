import { beforeEach, describe, expect, it, vi } from 'vitest';

describe('pre-tool-bash hook', () => {
  let hook: typeof import('../../scripts/hooks/pre-tool-bash.js');

  beforeEach(async () => {
    vi.resetModules();
    hook = await import('../../scripts/hooks/pre-tool-bash.js');
  });

  it('returns empty string for empty command', () => {
    expect(hook.run(JSON.stringify({ tool_input: { command: '' }, cwd: '/tmp' }))).toBe('');
  });

  it('returns empty string for safe commands', () => {
    expect(hook.run(JSON.stringify({ tool_input: { command: 'ls -la' }, cwd: '/tmp' }))).toBe('');
  });

  it('allows safe git commands', () => {
    expect(hook.run(JSON.stringify({ tool_input: { command: 'git status' }, cwd: '/tmp' }))).toBe('');
    expect(hook.run(JSON.stringify({ tool_input: { command: 'git push origin main' }, cwd: '/tmp' }))).toBe('');
  });

  it('allows npm test', () => {
    expect(hook.run(JSON.stringify({ tool_input: { command: 'npm test' }, cwd: '/tmp' }))).toBe('');
  });

  it('denies rm -rf', () => {
    const result = JSON.parse(hook.run(JSON.stringify({ tool_input: { command: 'rm -rf /' }, cwd: '/tmp' })));
    expect(result.hookSpecificOutput.permissionDecision).toBe('deny');
  });

  it('denies rm -rf with path', () => {
    const result = JSON.parse(hook.run(JSON.stringify({ tool_input: { command: 'rm -rf /home/user' }, cwd: '/tmp' })));
    expect(result.hookSpecificOutput.permissionDecision).toBe('deny');
  });

  it('denies git push --force', () => {
    const result = JSON.parse(hook.run(JSON.stringify({ tool_input: { command: 'git push --force origin main' }, cwd: '/tmp' })));
    expect(result.hookSpecificOutput.permissionDecision).toBe('deny');
  });

  it('denies git push -f', () => {
    const result = JSON.parse(hook.run(JSON.stringify({ tool_input: { command: 'git push -f origin main' }, cwd: '/tmp' })));
    expect(result.hookSpecificOutput.permissionDecision).toBe('deny');
  });

  it('denies DROP TABLE', () => {
    const result = JSON.parse(hook.run(JSON.stringify({ tool_input: { command: 'psql -c "DROP TABLE users"' }, cwd: '/tmp' })));
    expect(result.hookSpecificOutput.permissionDecision).toBe('deny');
  });

  it('denies git reset --hard', () => {
    const result = JSON.parse(hook.run(JSON.stringify({ tool_input: { command: 'git reset --hard HEAD~5' }, cwd: '/tmp' })));
    expect(result.hookSpecificOutput.permissionDecision).toBe('deny');
  });

  it('denies chmod 777', () => {
    const result = JSON.parse(hook.run(JSON.stringify({ tool_input: { command: 'chmod 777 /etc/passwd' }, cwd: '/tmp' })));
    expect(result.hookSpecificOutput.permissionDecision).toBe('deny');
  });

  it('denies TRUNCATE TABLE', () => {
    const result = JSON.parse(hook.run(JSON.stringify({ tool_input: { command: 'mysql -e "TRUNCATE TABLE logs"' }, cwd: '/tmp' })));
    expect(result.hookSpecificOutput.permissionDecision).toBe('deny');
  });
});
