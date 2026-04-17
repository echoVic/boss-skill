import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

describe('hook-flags', () => {
  const originalEnv = {
    BOSS_HOOK_PROFILE: process.env.BOSS_HOOK_PROFILE,
    BOSS_DISABLED_HOOKS: process.env.BOSS_DISABLED_HOOKS
  };

  async function loadFlags() {
    vi.resetModules();
    return import('../../scripts/lib/hook-flags.js');
  }

  beforeEach(() => {
    delete process.env.BOSS_HOOK_PROFILE;
    delete process.env.BOSS_DISABLED_HOOKS;
  });

  afterEach(() => {
    if (originalEnv.BOSS_HOOK_PROFILE !== undefined) {
      process.env.BOSS_HOOK_PROFILE = originalEnv.BOSS_HOOK_PROFILE;
    } else {
      delete process.env.BOSS_HOOK_PROFILE;
    }

    if (originalEnv.BOSS_DISABLED_HOOKS !== undefined) {
      process.env.BOSS_DISABLED_HOOKS = originalEnv.BOSS_DISABLED_HOOKS;
    } else {
      delete process.env.BOSS_DISABLED_HOOKS;
    }
  });

  it('isHookEnabled returns true when no restrictions (default standard profile)', async () => {
    const flags = await loadFlags();
    expect(flags.isHookEnabled('session:start', {})).toBe(true);
  });

  it('isHookEnabled returns false when hook is disabled', async () => {
    process.env.BOSS_DISABLED_HOOKS = 'session:start,session:end';
    const flags = await loadFlags();

    expect(flags.isHookEnabled('session:start', {})).toBe(false);
    expect(flags.isHookEnabled('other:hook', {})).toBe(true);
  });

  it('isHookEnabled respects profile filtering with standard (default)', async () => {
    const flags = await loadFlags();

    expect(flags.isHookEnabled('test', { profiles: 'standard,strict' })).toBe(true);
    expect(flags.isHookEnabled('test', { profiles: 'strict' })).toBe(false);
  });

  it('isHookEnabled respects minimal profile', async () => {
    process.env.BOSS_HOOK_PROFILE = 'minimal';
    const flags = await loadFlags();

    expect(flags.isHookEnabled('test', { profiles: 'standard,strict' })).toBe(false);
    expect(flags.isHookEnabled('test', { profiles: 'minimal,standard' })).toBe(true);
  });

  it('isHookEnabled respects strict profile', async () => {
    process.env.BOSS_HOOK_PROFILE = 'strict';
    const flags = await loadFlags();

    expect(flags.isHookEnabled('test', { profiles: 'strict' })).toBe(true);
    expect(flags.isHookEnabled('test', { profiles: 'minimal' })).toBe(false);
  });

  it('isHookEnabled allows all when no profiles specified', async () => {
    const flags = await loadFlags();

    expect(flags.isHookEnabled('any-hook', { profiles: '' })).toBe(true);
    expect(flags.isHookEnabled('any-hook', {})).toBe(true);
  });

  it('isHookEnabled falls back to standard for invalid profile', async () => {
    process.env.BOSS_HOOK_PROFILE = 'invalid';
    const flags = await loadFlags();

    expect(flags.isHookEnabled('test', { profiles: 'standard' })).toBe(true);
    expect(flags.isHookEnabled('test', { profiles: 'minimal' })).toBe(false);
  });
});
