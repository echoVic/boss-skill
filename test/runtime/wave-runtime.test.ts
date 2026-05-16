import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { buildBossStatus } from '../../packages/boss-cli/src/runtime/application/checkpoints.js';
import { initPipeline } from '../../packages/boss-cli/src/runtime/application/pipeline.js';
import { readWaves } from '../../packages/boss-cli/src/runtime/application/waves.js';
import { cleanupTempDir } from '../helpers/fixtures.js';

describe('evidence wave runtime', () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'boss-waves-'));
  });

  afterEach(() => {
    cleanupTempDir(tmpDir);
  });

  it('returns an empty array when tasks.md is missing', () => {
    expect(readWaves('test-feat', { cwd: tmpDir })).toEqual([]);
  });

  it('parses an Evidence Wave table row into runtime fields', () => {
    const featureDir = path.join(tmpDir, '.boss', 'test-feat');
    fs.mkdirSync(featureDir, { recursive: true });
    fs.writeFileSync(
      path.join(featureDir, 'tasks.md'),
      [
        '# Tasks',
        '',
        '| Evidence Wave | 范围 | Owner 文件 | 红测 | 绿门禁 | Contract Matrix 行 | Stop Condition |',
        '| --- | --- | --- | --- | --- | --- | --- |',
        '| Wave 1：Data | persistence and schema | `src/data.ts`<br>`src/schema.ts` | `npm test -- data.test.ts`，`npm test -- schema.test.ts` | `npm run typecheck`, `npm test -- data.test.ts` | CM-1, `CM-2` | Pause before migration |'
      ].join('\n')
    );

    const waves = readWaves('test-feat', { cwd: tmpDir });

    expect(waves).toHaveLength(1);
    expect(waves[0]).toMatchObject({
      id: 'wave-1-data',
      title: 'Wave 1：Data',
      status: 'pending',
      scope: 'persistence and schema',
      writeSet: ['src/data.ts', 'src/schema.ts'],
      greenGates: ['npm run typecheck', 'npm test -- data.test.ts'],
      contractRows: ['CM-1', 'CM-2']
    });
  });

  it('populates buildBossStatus currentWave from the first non-completed wave', () => {
    initPipeline('test-feat', { cwd: tmpDir });
    const featureDir = path.join(tmpDir, '.boss', 'test-feat');
    fs.mkdirSync(featureDir, { recursive: true });
    fs.writeFileSync(
      path.join(featureDir, 'tasks.md'),
      [
        '# Tasks',
        '',
        '| Evidence Wave | 范围 | Owner 文件 | 红测 | 绿门禁 | Contract Matrix 行 | Stop Condition |',
        '| --- | --- | --- | --- | --- | --- | --- |',
        '| Wave 1：Runtime | checkpoints | `packages/boss-cli/src/runtime/application/checkpoints.ts` | `npm test -- test/runtime/wave-runtime.test.ts` | `npm run typecheck` | CM-runtime | Stop on failed gate |'
      ].join('\n')
    );

    const status = buildBossStatus('test-feat', { cwd: tmpDir });

    expect(status.currentWave).toMatchObject({
      id: 'wave-1-runtime',
      title: 'Wave 1：Runtime',
      status: 'pending',
      greenGates: ['npm run typecheck']
    });
  });

  it('keeps shell pipes inside code spans in the same table cell', () => {
    const featureDir = path.join(tmpDir, '.boss', 'test-feat');
    fs.mkdirSync(featureDir, { recursive: true });
    fs.writeFileSync(
      path.join(featureDir, 'tasks.md'),
      [
        '| Evidence Wave | 范围 | Owner 文件 | 红测 | 绿门禁 | Contract Matrix 行 | Stop Condition |',
        '| --- | --- | --- | --- | --- | --- | --- |',
        '| Wave 1：Pipes | qa | `src/report.ts` | `npm test -- report.test.ts` | `cat report.json | jq .ok` | CM-pipe | Stop if report parse fails |'
      ].join('\n')
    );

    const waves = readWaves('test-feat', { cwd: tmpDir });

    expect(waves[0]).toMatchObject({
      id: 'wave-1-pipes',
      greenGates: ['cat report.json | jq .ok'],
      contractRows: ['CM-pipe'],
      pausePolicy: 'Stop if report parse fails',
      rollbackRisk: 'Stop if report parse fails'
    });
  });

  it('generates stable non-empty ids for non-latin and duplicate titles', () => {
    const featureDir = path.join(tmpDir, '.boss', 'test-feat');
    fs.mkdirSync(featureDir, { recursive: true });
    fs.writeFileSync(
      path.join(featureDir, 'tasks.md'),
      [
        '| Evidence Wave | 范围 | Owner 文件 | 红测 | 绿门禁 | Contract Matrix 行 | Stop Condition |',
        '| --- | --- | --- | --- | --- | --- | --- |',
        '| 第一波：数据层 | data | `src/data.ts` | `npm test -- data.test.ts` | `npm test -- data.test.ts` | CM-data | Stop A |',
        '| 第一波：数据层 | data 2 | `src/data2.ts` | `npm test -- data2.test.ts` | `npm test -- data2.test.ts` | CM-data-2 | Stop B |'
      ].join('\n')
    );

    const waves = readWaves('test-feat', { cwd: tmpDir });

    expect(waves.map((wave) => wave.id)).toEqual(['wave-1', 'wave-2']);
  });

  it('returns an empty array when tasks.md is not a readable file', () => {
    const featureDir = path.join(tmpDir, '.boss', 'test-feat');
    fs.mkdirSync(path.join(featureDir, 'tasks.md'), { recursive: true });

    expect(readWaves('test-feat', { cwd: tmpDir })).toEqual([]);
  });

  it('skips completed marker rows when selecting currentWave', () => {
    initPipeline('test-feat', { cwd: tmpDir });
    const featureDir = path.join(tmpDir, '.boss', 'test-feat');
    fs.mkdirSync(featureDir, { recursive: true });
    fs.writeFileSync(
      path.join(featureDir, 'tasks.md'),
      [
        '| Evidence Wave | 范围 | Owner 文件 | 红测 | 绿门禁 | Contract Matrix 行 | Stop Condition |',
        '| --- | --- | --- | --- | --- | --- | --- |',
        '| [completed] Wave 1：Done | done | `src/done.ts` | `npm test -- done.test.ts` | `npm test -- done.test.ts` | CM-done | Stop done |',
        '| Wave 2：Next | next | `src/next.ts` | `npm test -- next.test.ts` | `npm test -- next.test.ts` | CM-next | Stop next |'
      ].join('\n')
    );

    const status = buildBossStatus('test-feat', { cwd: tmpDir });

    expect(status.currentWave).toMatchObject({
      id: 'wave-2-next',
      title: 'Wave 2：Next',
      status: 'pending'
    });
  });
});
