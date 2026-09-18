import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';

import { afterEach, describe, expect, it } from 'vitest';

import { readEvents } from '../../packages/boss-cli/src/runtime/projectors/materialize-state.js';

const SCHEMA_PATH = path.resolve(
  import.meta.dirname,
  '..',
  '..',
  'packages',
  'boss-cli',
  'src',
  'runtime',
  'schema',
  'event-schema.json',
);

interface EventSchema {
  allOf?: Array<{
    if?: { properties?: { type?: { const?: string } } };
    then?: { properties?: { data?: { required?: string[] } } };
  }>;
}

/** 从 event-schema.json 提取「每个 type → data 必填字段」的声明。 */
function schemaRequiredByType(): Array<{ type: string; required: string[] }> {
  const schema = JSON.parse(fs.readFileSync(SCHEMA_PATH, 'utf8')) as EventSchema;
  const out: Array<{ type: string; required: string[] }> = [];
  for (const clause of schema.allOf ?? []) {
    const type = clause.if?.properties?.type?.const;
    const required = clause.then?.properties?.data?.required;
    if (type && Array.isArray(required) && required.length > 0) {
      out.push({ type, required });
    }
  }
  return out;
}

/** 为某个 type 造一条「满足全部必填字段」的合法事件，字段值取占位。 */
function validEventFor(type: string, required: string[]): Record<string, unknown> {
  const data: Record<string, unknown> = {};
  for (const field of required) {
    // 用能通过运行时逐字段校验的占位值：stage/exitCode 用正整数，passed/verified 用布尔，
    // 其余用最小非空对象/字符串。这样「完整事件」应当被 readEvents 接受。
    if (field === 'stage' || field === 'exitCode') data[field] = 1;
    else if (field === 'passed' || field === 'verified') data[field] = true;
    else if (field === 'plugins')
      data[field] = [{ name: 'p', version: '1.0.0', type: 'gate', manifestPath: 'p/plugin.json' }];
    else if (field === 'plugin')
      data[field] = { name: 'p', version: '1.0.0', type: 'gate', manifestPath: 'p/plugin.json' };
    else if (field === 'initialState') data[field] = {};
    else if (field === 'thread')
      data[field] = { id: 't1', kind: 'ask', anchor: { scope: 's' }, initiator: 'boss-pm' };
    else if (field === 'message')
      data[field] = { id: 'm1', threadId: 't1', from: 'boss-pm', body: 'x' };
    else if (field === 'resolution') data[field] = { threadId: 't1', decision: 'resolved' };
    else if (field === 'todo') data[field] = { id: 'todo1', title: 't', owner: 'boss-pm' };
    else if (field === 'phase') data[field] = 'red';
    else data[field] = `${field}-value`;
  }
  return { id: 1, type, timestamp: '2026-07-30T00:00:00Z', data };
}

let tmpDir: string | null = null;

function writeAndRead(event: Record<string, unknown>) {
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'boss-schema-bridge-'));
  const file = path.join(tmpDir, 'events.jsonl');
  fs.writeFileSync(file, JSON.stringify(event) + '\n', 'utf8');
  return readEvents(file);
}

afterEach(() => {
  if (tmpDir) {
    fs.rmSync(tmpDir, { recursive: true, force: true });
    tmpDir = null;
  }
});

describe('event schema ⟷ runtime validator bridge (drift guard)', () => {
  const cases = schemaRequiredByType();

  it('schema declares required-field constraints for multiple event types', () => {
    // 若 schema 结构变化导致提取不到任何分支，本测试立即失败，避免下方 it.each 静默空跑
    expect(cases.length).toBeGreaterThanOrEqual(10);
  });

  it.each(cases)(
    'runtime validator enforces every schema-required field for $type',
    ({ type, required }) => {
      // 完整事件应被接受 —— 证明占位值合法、该 type 走通
      expect(() => writeAndRead(validEventFor(type, required))).not.toThrow();

      // 逐个抽掉 schema 声明的必填字段，运行时校验必须拒绝 ——
      // 若运行时漏校验某字段，schema 与实现就漂移了，这里会红。
      for (const field of required) {
        const broken = validEventFor(type, required);
        delete (broken.data as Record<string, unknown>)[field];
        expect(
          () => writeAndRead(broken),
          `${type}: 删除 schema 必填字段 "${field}" 后运行时仍接受，schema 与校验已漂移`,
        ).toThrow();
      }
    },
  );
});
