/**
 * 并行安全组调度：从 ready 节点集合中选出可同时派发的最大批次。
 *
 * 设计要点：
 * - 派发轴是「写集冲突」而非「stage 序号」。DAG 的 inputs 已经表达了数据依赖，
 *   stage 只是人类阅读用的分期标签；用 stage 过滤会把 DAG 已允许的跨期并行丢掉。
 * - 写集不重叠的 ready 节点可同批派发；重叠的节点留到后续批次，避免并发写同一产物。
 * - 纯函数、无 IO，被 application 与 projectors 两层共用，避免调度语义漂移。
 */

/** 参与调度的最小节点形状。两层各自的节点类型都结构兼容这个接口。 */
export interface SchedulableNode {
  id: string;
  stage: number;
  status?: string;
  /** 该节点产出/写入的路径集合。缺省时由 resolveWriteSet 回退到产物名。 */
  writes?: string[];
  artifact?: string;
  gate?: string;
}

/**
 * 解析节点写集。显式 writes 优先；否则回退到 artifact 名。
 * gate 节点是只读校验，不写产物，返回空集 —— 因此永不与他人冲突，可全部并行。
 */
export function resolveWriteSet(node: SchedulableNode): string[] {
  if (Array.isArray(node.writes) && node.writes.length > 0) {
    return node.writes.filter((entry) => typeof entry === 'string' && entry.length > 0);
  }
  if (node.gate) return [];
  if (typeof node.artifact === 'string' && node.artifact.length > 0) {
    return [node.artifact];
  }
  return [];
}

/**
 * 稳定排序：stage 升序作为「优先级提示」（越早的分期越先派发），
 * 同 stage 内按 id 字典序。注意这只影响*顺序*，不再用于*过滤*。
 */
function compareNodes(left: SchedulableNode, right: SchedulableNode): number {
  if (left.stage !== right.stage) return left.stage - right.stage;
  return left.id.localeCompare(right.id);
}

/**
 * 从 ready 节点中选出第一个并行安全组：贪心扫描，写集与已选集合不冲突即纳入。
 * 返回的节点可安全并发执行；被排除的节点在下一轮调度中参与。
 */
export function selectParallelSafeBatch(readyNodes: SchedulableNode[]): string[] {
  const sorted = [...readyNodes].sort(compareNodes);
  const claimed = new Set<string>();
  const batch: string[] = [];

  for (const node of sorted) {
    const writeSet = resolveWriteSet(node);
    const conflicts = writeSet.some((target) => claimed.has(target));
    if (conflicts) continue;
    for (const target of writeSet) claimed.add(target);
    batch.push(node.id);
  }

  return batch;
}

/**
 * 计算下一批要派发的节点 id。
 * 传入全部节点，内部筛出 status==='ready' 的参与分组。
 */
export function computeNextNodeIds(nodes: Iterable<SchedulableNode>): string[] {
  const ready = [...nodes].filter((node) => node.status === 'ready');
  return selectParallelSafeBatch(ready);
}
