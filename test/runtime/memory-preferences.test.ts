import { describe, expect, it } from 'vitest';

import { extractPreferenceMemories } from '../../packages/boss-cli/src/runtime/memory/preferences.js';

function choiceEvent(id: number, selected: string, extra: Record<string, unknown> = {}) {
  return {
    id,
    type: 'UserChoiceRecorded',
    timestamp: `2026-07-30T00:00:0${id}Z`,
    data: { choiceType: 'design-variant', selected, ...extra },
  };
}

describe('memory/preferences deterministic fold', () => {
  it('ignores non-choice events', () => {
    const records = extractPreferenceMemories('feat', [
      { id: 1, type: 'StageCompleted', timestamp: '2026-07-30T00:00:01Z', data: {} },
    ]);
    expect(records).toEqual([]);
  });

  it('creates a preference record from a single choice', () => {
    const [record] = extractPreferenceMemories('feat', [
      choiceEvent(2, '方案A', { reason: '简洁' }),
    ]);
    expect(record).toMatchObject({
      scope: 'feature',
      kind: 'long_term',
      category: 'design-style',
      influence: 'preference',
      confidence: 0.5,
      decayScore: 5,
    });
    expect(record!.tags).toEqual(['design-style', '方案A']);
    expect(record!.summary).toContain('方案A');
    expect(record!.summary).toContain('简洁');
    expect(record!.evidence).toHaveLength(1);
  });

  it('raises confidence and accumulates evidence when the same choice repeats', () => {
    const records = extractPreferenceMemories('feat', [
      choiceEvent(2, '方案A'),
      choiceEvent(3, '方案A'),
    ]);
    expect(records).toHaveLength(1);
    expect(records[0]!.confidence).toBeCloseTo(0.7);
    expect(records[0]!.decayScore).toBe(7);
    expect(records[0]!.evidence).toHaveLength(2);
    expect(records[0]!.summary).toContain('已确认2次');
  });

  it('caps confidence at 0.95 no matter how many repeats', () => {
    const events = Array.from({ length: 10 }, (_, i) => choiceEvent(i + 2, '方案A'));
    const [record] = extractPreferenceMemories('feat', events);
    expect(record!.confidence).toBeLessThanOrEqual(0.95);
    expect(record!.confidence).toBeCloseTo(0.95);
  });

  it('decrements an opposing choice in the same category', () => {
    // A, A（→0.7）, 然后 B 到达 → 削弱 A 至 0.5，B 自身从 0.5 起
    const records = extractPreferenceMemories('feat', [
      choiceEvent(2, '方案A'),
      choiceEvent(3, '方案A'),
      choiceEvent(4, '方案B'),
    ]);
    const byTag = Object.fromEntries(records.map((r) => [r.tags[1]!, r]));
    expect(byTag['方案A']!.confidence).toBeCloseTo(0.5);
    expect(byTag['方案B']!.confidence).toBeCloseTo(0.5);
    // A 被削弱后 evidence 仍是自己的 2 条，不会污染 B
    expect(byTag['方案A']!.evidence).toHaveLength(2);
    expect(byTag['方案B']!.evidence).toHaveLength(1);
  });

  it('keeps pure-CJK opposing choices distinct instead of collapsing to one id', () => {
    // 回归防护：preferenceId 曾用 `replace(/[^a-z0-9-]/g, '-')` 抹除全部非 ASCII 字符，
    // 使 '方案甲' 与 '方案乙' 塌缩为同一 id（pref-design-style----），
    // 对立选择被误判为「重复确认」（confidence 累加、evidence 追加、对立削弱不触发）。
    // 纯中文标签是 design-variants 的常态，故必须独立覆盖此路径。
    const records = extractPreferenceMemories('feat', [
      choiceEvent(2, '方案甲'),
      choiceEvent(3, '方案甲'),
      choiceEvent(4, '方案乙'),
    ]);
    // 必须是两条独立记录，而非被合并成一条
    expect(records).toHaveLength(2);
    const byTag = Object.fromEntries(records.map((r) => [r.tags[1]!, r]));
    expect(byTag['方案甲']!.id).not.toBe(byTag['方案乙']!.id);
    // 甲 升到 0.7 后被 乙 的对立削弱回 0.5；乙 自身从 0.5 起
    expect(byTag['方案甲']!.confidence).toBeCloseTo(0.5);
    expect(byTag['方案乙']!.confidence).toBeCloseTo(0.5);
    expect(byTag['方案甲']!.evidence).toHaveLength(2);
    expect(byTag['方案乙']!.evidence).toHaveLength(1);
    // summary 不应被错误标记为「已确认」
    expect(byTag['方案乙']!.summary).not.toContain('已确认');
  });

  it('generates distinct ids for distinct pure-CJK review decisions', () => {
    const records = extractPreferenceMemories('feat', [
      choiceEvent(2, '通过', { choiceType: 'review-decision' }),
      choiceEvent(3, '拒绝', { choiceType: 'review-decision' }),
    ]);
    expect(records).toHaveLength(2);
    expect(records[0]!.id).not.toBe(records[1]!.id);
  });

  it('does not decrement across different categories', () => {
    const records = extractPreferenceMemories('feat', [
      choiceEvent(2, 'darkmode', { choiceType: 'config-preference' }),
      choiceEvent(3, '方案A', { choiceType: 'design-variant' }),
    ]);
    // 两个不同类别，互不削弱，都保持起始 0.5
    for (const record of records) {
      expect(record.confidence).toBeCloseTo(0.5);
    }
  });

  it('is a pure fold: replaying the same events yields identical records', () => {
    const events = [choiceEvent(2, '方案A'), choiceEvent(3, '方案B'), choiceEvent(4, '方案A')];
    const first = extractPreferenceMemories('feat', events);
    const second = extractPreferenceMemories('feat', events);
    expect(JSON.stringify(second)).toBe(JSON.stringify(first));
  });

  it('maps known choice types to categories and falls back for unknown', () => {
    const records = extractPreferenceMemories('feat', [
      choiceEvent(2, 'x', { choiceType: 'review-decision' }),
      choiceEvent(3, 'y', { choiceType: 'gate-override' }),
      choiceEvent(4, 'z', { choiceType: 'something-else' }),
    ]);
    const categories = records.map((r) => r.category).sort();
    expect(categories).toEqual(['general-preference', 'quality-threshold', 'review-preference']);
  });

  it('skips malformed choice events missing selected or choiceType', () => {
    const records = extractPreferenceMemories('feat', [
      {
        id: 2,
        type: 'UserChoiceRecorded',
        timestamp: '2026-07-30T00:00:02Z',
        data: { choiceType: 'design-variant' },
      },
      {
        id: 3,
        type: 'UserChoiceRecorded',
        timestamp: '2026-07-30T00:00:03Z',
        data: { selected: '方案A' },
      },
    ]);
    expect(records).toEqual([]);
  });
});
