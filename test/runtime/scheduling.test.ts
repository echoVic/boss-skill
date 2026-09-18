import { describe, expect, it } from 'vitest';

import {
  computeNextNodeIds,
  resolveWriteSet,
  type SchedulableNode,
  selectParallelSafeBatch,
} from '../../packages/boss-cli/src/runtime/domain/scheduling.js';

function node(partial: Partial<SchedulableNode> & { id: string }): SchedulableNode {
  return {
    stage: 0,
    status: 'ready',
    ...partial,
  };
}

describe('domain/scheduling write-set batching', () => {
  it('dispatches ready nodes across different stages in one batch', () => {
    // 回归防护：旧调度器按 stage 过滤，只会派发 stage 1。
    // DAG 的 inputs 已表达数据依赖，stage 仅是分期标签，不应阻断并行。
    const nodes = [
      node({ id: 'artifact:a.md', stage: 1, artifact: 'a.md' }),
      node({ id: 'artifact:b.md', stage: 3, artifact: 'b.md' }),
      node({ id: 'artifact:c.md', stage: 4, artifact: 'c.md' }),
    ];

    expect(computeNextNodeIds(nodes)).toEqual(['artifact:a.md', 'artifact:b.md', 'artifact:c.md']);
  });

  it('excludes nodes whose write sets overlap an already-claimed target', () => {
    const nodes = [
      node({ id: 'artifact:api', stage: 3, writes: ['src/api.ts', 'src/shared.ts'] }),
      node({ id: 'artifact:web', stage: 3, writes: ['src/web.ts'] }),
      // 与第一个节点共享 src/shared.ts，必须退到下一批
      node({ id: 'artifact:worker', stage: 3, writes: ['src/shared.ts'] }),
    ];

    expect(selectParallelSafeBatch(nodes)).toEqual(['artifact:api', 'artifact:web']);
  });

  it('lets the deferred node run once the conflicting node leaves ready', () => {
    const first = node({ id: 'artifact:api', writes: ['src/shared.ts'] });
    const second = node({ id: 'artifact:worker', writes: ['src/shared.ts'] });

    expect(selectParallelSafeBatch([first, second])).toEqual(['artifact:api']);

    // api 进入 running 后不再是 ready，worker 得以派发
    const advanced = [{ ...first, status: 'running' }, second];
    expect(computeNextNodeIds(advanced)).toEqual(['artifact:worker']);
  });

  it('treats gate nodes as read-only so they never block each other', () => {
    const nodes = [
      node({ id: 'gate:gate0', stage: 3, gate: 'gate0' }),
      node({ id: 'gate:gate1', stage: 3, gate: 'gate1' }),
      node({ id: 'gate:owasp-scan', stage: 3, gate: 'owasp-scan' }),
    ];

    expect(resolveWriteSet(nodes[0]!)).toEqual([]);
    expect(computeNextNodeIds(nodes)).toEqual(['gate:gate0', 'gate:gate1', 'gate:owasp-scan']);
  });

  it('falls back to the artifact name when no explicit write set is declared', () => {
    const nodes = [
      node({ id: 'artifact:prd.md', artifact: 'prd.md' }),
      // 同一产物的两个写入者不得并行
      node({ id: 'artifact:prd.md#retry', artifact: 'prd.md' }),
    ];

    expect(resolveWriteSet(nodes[0]!)).toEqual(['prd.md']);
    expect(computeNextNodeIds(nodes)).toEqual(['artifact:prd.md']);
  });

  it('ignores nodes that are not ready', () => {
    const nodes = [
      node({ id: 'artifact:a', status: 'blocked', artifact: 'a' }),
      node({ id: 'artifact:b', status: 'completed', artifact: 'b' }),
      node({ id: 'artifact:c', status: 'running', artifact: 'c' }),
      node({ id: 'artifact:d', status: 'ready', artifact: 'd' }),
    ];

    expect(computeNextNodeIds(nodes)).toEqual(['artifact:d']);
  });

  it('returns an empty batch when nothing is ready', () => {
    expect(computeNextNodeIds([node({ id: 'x', status: 'blocked' })])).toEqual([]);
    expect(computeNextNodeIds([])).toEqual([]);
  });

  it('orders the batch deterministically by stage then id', () => {
    const nodes = [
      node({ id: 'artifact:z', stage: 1, artifact: 'z' }),
      node({ id: 'artifact:a', stage: 4, artifact: 'a' }),
      node({ id: 'artifact:m', stage: 1, artifact: 'm' }),
    ];

    // 同一输入的两次调度必须得到同一顺序
    const first = computeNextNodeIds(nodes);
    const second = computeNextNodeIds([...nodes].reverse());
    expect(first).toEqual(['artifact:m', 'artifact:z', 'artifact:a']);
    expect(second).toEqual(first);
  });
});
