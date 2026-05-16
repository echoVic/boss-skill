import { describe, expect, it } from 'vitest';

import { parseStatus } from '../../scripts/hooks/subagent-stop.js';

describe('Boss status parser fault handling', () => {
  it('accepts known BOSS_STATUS values', () => {
    expect(
      parseStatus(
        [
          '[BOSS_STATUS]',
          'status: DONE_WITH_CONCERNS',
          'reason: verified with warnings',
          '[/BOSS_STATUS]'
        ].join('\n')
      )
    ).toEqual({ status: 'DONE_WITH_CONCERNS', reason: 'verified with warnings' });
  });

  it('marks unknown BOSS_STATUS values invalid with the raw value in the reason', () => {
    const parsed = parseStatus(['[BOSS_STATUS]', 'status: ALL_GOOD', '[/BOSS_STATUS]'].join('\n'));

    expect(parsed.status).toBe('INVALID');
    expect(parsed.reason).toContain('Invalid BOSS_STATUS status: ALL_GOOD');
  });

  it('does not infer status from prose when the structured block is missing', () => {
    expect(parseStatus('Done, all tests passed.')).toEqual({ status: '', reason: '' });
  });
});
