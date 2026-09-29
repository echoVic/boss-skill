import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { readEvents as inspectEvents } from '../../skill/cli/runtime/application/inspection.mts';
import { rebuildFeatureMemory } from '../../skill/cli/runtime/application/memory.mts';
import { initPipeline, recordArtifact } from '../../skill/cli/runtime/application/pipeline.mts';
import { getArtifactVersion } from '../../skill/cli/runtime/application/pipeline-artifacts.mts';
import { readRuntimeEvents } from '../../skill/cli/runtime/application/pipeline-dag.mts';
import { appendRuntimeEvent } from '../../skill/cli/runtime/application/state.mts';
import { EVENT_TYPES } from '../../skill/cli/runtime/domain/event-types.mts';

/**
 * 崩溃残留的半行被封口后会**永久停留在事件流中间**。凡是自己 split('\n') 再
 * JSON.parse 的读取路径都会因此抛错，一次崩溃就让 inspect / memory / DAG / 工件
 * 版本号全线不可用。这些路径必须和 readJsonlTolerant 一样跳过损坏行。
 */
describe('event-log readers over a sealed crash residue', () => {
  let tmpDir: string;
  let eventsFile: string;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'boss-residue-readers-'));
    initPipeline('residue-feature', { cwd: tmpDir });
    eventsFile = path.join(tmpDir, '.boss', 'residue-feature', '.meta', 'events.jsonl');
    // 模拟崩溃：追加半条 JSON（无结尾换行），随后一次正常追加会把它封口成中间行
    fs.appendFileSync(eventsFile, '{"type":"StageStarted","id":999', 'utf8');
    appendRuntimeEvent(tmpDir, 'residue-feature', EVENT_TYPES.STAGE_STARTED, { stage: 1 });
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it('leaves the residue in the middle of the log', () => {
    const lines = fs.readFileSync(eventsFile, 'utf8').split('\n').filter(Boolean);
    expect(lines).toContain('{"type":"StageStarted","id":999');
    expect(lines[lines.length - 1]).toMatch(/"type":"StageStarted"/);
  });

  it('inspection.readEvents skips the residue instead of throwing', () => {
    const events = inspectEvents('residue-feature', tmpDir);
    expect(events.length).toBeGreaterThan(0);
    expect(events.every((event) => typeof event.type === 'string')).toBe(true);
  });

  it('pipeline-dag.readRuntimeEvents skips the residue instead of throwing', () => {
    const events = readRuntimeEvents(tmpDir, 'residue-feature');
    expect(events.length).toBeGreaterThan(0);
  });

  it('rebuildFeatureMemory skips the residue instead of throwing', () => {
    expect(() => rebuildFeatureMemory('residue-feature', { cwd: tmpDir })).not.toThrow();
  });

  it('artifact version counting ignores the residue and stays consistent', () => {
    fs.writeFileSync(path.join(tmpDir, '.boss', 'residue-feature', 'prd.md'), '# prd\n', 'utf8');
    recordArtifact('residue-feature', 'prd.md', 1, { cwd: tmpDir });

    expect(getArtifactVersion('residue-feature', 'prd.md', { cwd: tmpDir })).toBe(1);

    // 事件 id 必须仍然唯一：残留行不计入记录数，也不得让下一个 id 撞车
    const ids = fs
      .readFileSync(eventsFile, 'utf8')
      .split('\n')
      .filter(Boolean)
      .flatMap((line) => {
        try {
          return [(JSON.parse(line) as { id: number }).id];
        } catch {
          return [];
        }
      });
    expect(new Set(ids).size).toBe(ids.length);
  });
});
