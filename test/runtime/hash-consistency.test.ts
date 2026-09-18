import { describe, expect, it } from 'vitest';

import { hashRuntimeValue } from '../../packages/boss-cli/src/runtime/application/pipeline-dag.js';
import { hashWorkflowValue } from '../../packages/boss-cli/src/runtime/application/workflow.js';

/**
 * 所有稳定序列化必须与 JSON.stringify 对 undefined 的处理一致。
 *
 * 否则「内存中对象的哈希」与「它写进 JSON 后再读回来的哈希」在缺少可选字段时不相等，
 * 这种哈希就无法用来证明任何落盘内容没被改过——workflowHash 正是这样错了几个月。
 * 仓库里曾有两份各自实现的 stableStringify，只修一份等于留着同一个坑。
 */
describe('hash helpers follow JSON semantics for undefined', () => {
  const withAbsentFields = {
    id: 'a',
    description: undefined,
    agent: null,
    inputs: ['x', undefined],
  };
  const roundTripped = JSON.parse(JSON.stringify(withAbsentFields)) as unknown;

  it('hashWorkflowValue hashes an object the same as its JSON round trip', () => {
    expect(hashWorkflowValue(withAbsentFields).value).toBe(hashWorkflowValue(roundTripped).value);
  });

  it('hashRuntimeValue hashes an object the same as its JSON round trip', () => {
    expect(hashRuntimeValue(withAbsentFields).value).toBe(hashRuntimeValue(roundTripped).value);
  });

  it('both helpers agree with each other', () => {
    // 两者是同一个算法的两处调用点；若哈希不同，说明又出现了第二份实现
    expect(hashRuntimeValue(withAbsentFields).value).toBe(
      hashWorkflowValue(withAbsentFields).value,
    );
  });
});
