import { describe, expect, it } from 'vitest';

import { readReportedStatus } from '../../scripts/hooks/subagent-stop.js';

describe('Boss agent status intake fault handling', () => {
  it('accepts a known status from the structured field', () => {
    expect(
      readReportedStatus({
        structured_output: { status: 'DONE_WITH_CONCERNS', reason: 'verified with warnings' },
      }),
    ).toEqual({ status: 'DONE_WITH_CONCERNS', reason: 'verified with warnings' });
  });

  it('accepts a bare status string', () => {
    expect(readReportedStatus({ agent_status: 'BLOCKED' })).toEqual({
      status: 'BLOCKED',
      reason: '',
    });
  });

  it('rejects unknown status values instead of guessing', () => {
    expect(readReportedStatus({ structured_output: { status: 'ALL_GOOD' } })).toBeNull();
    expect(readReportedStatus({ agent_status: 'ALL_GOOD' })).toBeNull();
  });

  it('does not infer status from prose', () => {
    // 核心不变量：状态是控制流输入，只能来自校验过的结构化字段，
    // 不得从自然语言消息里推断。
    expect(readReportedStatus({ last_assistant_message: 'Done, all tests passed.' })).toBeNull();
    expect(
      readReportedStatus({
        last_assistant_message: '[BOSS_STATUS]\nstatus: DONE\n[/BOSS_STATUS]',
      }),
    ).toBeNull();
  });

  it('returns null when no status field is present', () => {
    expect(readReportedStatus({})).toBeNull();
  });

  it('is unaffected by message length', () => {
    // 回归防护：旧实现把 message 截断到前 500 字符再用正则找末尾的状态块，
    // 导致较长的成功回复被误判为 failed。结构化字段与消息长度无关。
    const verbose = '实现完成。'.repeat(500);
    expect(
      readReportedStatus({
        last_assistant_message: verbose,
        structured_output: { status: 'DONE', reason: 'ok' },
      }),
    ).toEqual({ status: 'DONE', reason: 'ok' });
  });
});
