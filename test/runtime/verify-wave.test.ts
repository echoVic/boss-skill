import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { initPipeline } from '../../packages/boss-cli/src/runtime/application/pipeline.js';
import { verifyWave, findWave } from '../../packages/boss-cli/src/runtime/application/wave-verification.js';
import { cleanupTempDir } from '../helpers/fixtures.js';

function writeTasksWithWave(tmpDir: string, feature: string, rows: string[]): void {
  const featureDir = path.join(tmpDir, '.boss', feature);
  fs.mkdirSync(featureDir, { recursive: true });
  fs.writeFileSync(
    path.join(featureDir, 'tasks.md'),
    [
      '# Tasks',
      '',
      '| Evidence Wave | 范围 | Owner 文件 | 红测 | 绿门禁 | Contract Matrix 行 | Stop Condition |',
      '| --- | --- | --- | --- | --- | --- | --- |',
      ...rows
    ].join('\n')
  );
}

describe('verify-wave', () => {
  let tmpDir: string;
  const feature = 'test-feat';

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'boss-verify-wave-'));
    initPipeline(feature, { cwd: tmpDir });
  });

  afterEach(() => {
    cleanupTempDir(tmpDir);
  });

  describe('findWave', () => {
    it('throws when wave does not exist', () => {
      writeTasksWithWave(tmpDir, feature, [
        '| Wave 1：Data | data | `src/d.ts` | `exit 1` | `exit 0` | CM-1 | Stop |'
      ]);
      expect(() => findWave(feature, 'nonexistent', tmpDir)).toThrow('未找到 wave: nonexistent');
    });

    it('finds a wave by its generated id', () => {
      writeTasksWithWave(tmpDir, feature, [
        '| Wave 1：Data | data | `src/d.ts` | `exit 1` | `exit 0` | CM-1 | Stop |'
      ]);
      const wave = findWave(feature, 'wave-1-data', tmpDir);
      expect(wave.title).toBe('Wave 1：Data');
    });
  });

  describe('red phase', () => {
    it('verified=true when all red tests fail (exitCode != 0)', () => {
      writeTasksWithWave(tmpDir, feature, [
        '| Wave 1：Red | scope | `src/a.ts` | `exit 1` | `exit 0` | CM-1 | Stop |'
      ]);
      const result = verifyWave(feature, 'wave-1-red', 'red', { cwd: tmpDir });
      expect(result.verified).toBe(true);
      expect(result.redTests!.allCorrect).toBe(true);
      expect(result.redTests!.results[0]!.exitCode).toBe(1);
      expect(result.redTests!.results[0]!.passed).toBe(true);
    });

    it('verified=false when a red test passes unexpectedly (exitCode == 0)', () => {
      writeTasksWithWave(tmpDir, feature, [
        '| Wave 1：Red | scope | `src/a.ts` | `exit 0` | `exit 0` | CM-1 | Stop |'
      ]);
      const result = verifyWave(feature, 'wave-1-red', 'red', { cwd: tmpDir });
      expect(result.verified).toBe(false);
      expect(result.redTests!.allCorrect).toBe(false);
      expect(result.redTests!.results[0]!.passed).toBe(false);
    });

    it('handles multiple red test commands', () => {
      writeTasksWithWave(tmpDir, feature, [
        '| Wave 1：Multi | scope | `src/a.ts` | `exit 1`, `exit 1` | `exit 0` | CM-1 | Stop |'
      ]);
      const result = verifyWave(feature, 'wave-1-multi', 'red', { cwd: tmpDir });
      expect(result.verified).toBe(true);
      expect(result.redTests!.results).toHaveLength(2);
    });

    it('throws when wave has no redTests', () => {
      writeTasksWithWave(tmpDir, feature, [
        '| Wave 1：Empty | scope | `src/a.ts` |  | `exit 0` | CM-1 | Stop |'
      ]);
      expect(() => verifyWave(feature, 'wave-1-empty', 'red', { cwd: tmpDir })).toThrow(
        '没有定义 redTests'
      );
    });
  });

  describe('green phase', () => {
    it('verified=true when all green gates pass (exitCode == 0)', () => {
      writeTasksWithWave(tmpDir, feature, [
        '| Wave 1：Green | scope | `src/a.ts` | `exit 1` | `exit 0` | CM-1 | Stop |'
      ]);
      const result = verifyWave(feature, 'wave-1-green', 'green', { cwd: tmpDir });
      expect(result.verified).toBe(true);
      expect(result.greenGates!.allCorrect).toBe(true);
      expect(result.greenGates!.results[0]!.exitCode).toBe(0);
      expect(result.greenGates!.results[0]!.passed).toBe(true);
    });

    it('verified=false when a green gate fails (exitCode != 0)', () => {
      writeTasksWithWave(tmpDir, feature, [
        '| Wave 1：Green | scope | `src/a.ts` | `exit 1` | `exit 1` | CM-1 | Stop |'
      ]);
      const result = verifyWave(feature, 'wave-1-green', 'green', { cwd: tmpDir });
      expect(result.verified).toBe(false);
      expect(result.greenGates!.allCorrect).toBe(false);
      expect(result.greenGates!.results[0]!.passed).toBe(false);
    });

    it('throws when wave has no greenGates', () => {
      writeTasksWithWave(tmpDir, feature, [
        '| Wave 1：NoGate | scope | `src/a.ts` | `exit 1` |  | CM-1 | Stop |'
      ]);
      expect(() => verifyWave(feature, 'wave-1-nogate', 'green', { cwd: tmpDir })).toThrow(
        '没有定义 greenGates'
      );
    });
  });

  describe('full phase', () => {
    it('verified=true when red fails and green passes', () => {
      writeTasksWithWave(tmpDir, feature, [
        '| Wave 1：Full | scope | `src/a.ts` | `exit 1` | `exit 0` | CM-1 | Stop |'
      ]);
      const result = verifyWave(feature, 'wave-1-full', 'full', { cwd: tmpDir });
      expect(result.verified).toBe(true);
      expect(result.redTests!.allCorrect).toBe(true);
      expect(result.greenGates!.allCorrect).toBe(true);
    });

    it('verified=false when red passes unexpectedly', () => {
      writeTasksWithWave(tmpDir, feature, [
        '| Wave 1：Full | scope | `src/a.ts` | `exit 0` | `exit 0` | CM-1 | Stop |'
      ]);
      const result = verifyWave(feature, 'wave-1-full', 'full', { cwd: tmpDir });
      expect(result.verified).toBe(false);
    });

    it('verified=false when green fails', () => {
      writeTasksWithWave(tmpDir, feature, [
        '| Wave 1：Full | scope | `src/a.ts` | `exit 1` | `exit 1` | CM-1 | Stop |'
      ]);
      const result = verifyWave(feature, 'wave-1-full', 'full', { cwd: tmpDir });
      expect(result.verified).toBe(false);
    });
  });

  describe('event recording', () => {
    it('appends WaveVerified event to events.jsonl', () => {
      writeTasksWithWave(tmpDir, feature, [
        '| Wave 1：Ev | scope | `src/a.ts` | `exit 1` | `exit 0` | CM-1 | Stop |'
      ]);
      const result = verifyWave(feature, 'wave-1-ev', 'full', { cwd: tmpDir });
      expect(result.event).toBeDefined();
      expect(result.event!.type).toBe('WaveVerified');

      const eventsPath = path.join(tmpDir, '.boss', feature, '.meta', 'events.jsonl');
      const events = fs
        .readFileSync(eventsPath, 'utf8')
        .trim()
        .split('\n')
        .map((line) => JSON.parse(line) as { type: string; data: Record<string, unknown> });
      const waveEvent = events.find((e) => e.type === 'WaveVerified');
      expect(waveEvent).toBeDefined();
      expect(waveEvent!.data.waveId).toBe('wave-1-ev');
      expect(waveEvent!.data.verified).toBe(true);
    });

    it('dry-run does not write event', () => {
      writeTasksWithWave(tmpDir, feature, [
        '| Wave 1：Dry | scope | `src/a.ts` | `exit 1` | `exit 0` | CM-1 | Stop |'
      ]);
      const result = verifyWave(feature, 'wave-1-dry', 'full', { cwd: tmpDir, dryRun: true });
      expect(result.verified).toBe(true);
      expect(result.event).toBeUndefined();

      const eventsPath = path.join(tmpDir, '.boss', feature, '.meta', 'events.jsonl');
      const events = fs
        .readFileSync(eventsPath, 'utf8')
        .trim()
        .split('\n')
        .map((line) => JSON.parse(line) as { type: string });
      const waveEvent = events.find((e) => e.type === 'WaveVerified');
      expect(waveEvent).toBeUndefined();
    });
  });

  it('throws when feature name is empty', () => {
    expect(() => verifyWave('', 'wave-1', 'red', { cwd: tmpDir })).toThrow('缺少 feature');
  });
});
