import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import {
  initPipeline,
  updateStage,
  updateAgent,
  checkStall,
  cacheTechStack,
  readCachedTechStack
} from '../../packages/boss-cli/src/runtime/application/pipeline.js';

describe('checkStall', () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'boss-stall-'));
    initPipeline('stall-feature', { cwd: tmpDir });
    updateStage('stall-feature', 1, 'running', { cwd: tmpDir });
    updateAgent('stall-feature', 1, 'boss-pm', 'running', { cwd: tmpDir });
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true, maxRetries: 5, retryDelay: 200 });
  });

  it('detects stalled agents exceeding maxDurationMs', () => {
    // Manually backdate the agent startTime to simulate a stall
    const execPath = path.join(tmpDir, '.boss', 'stall-feature', '.meta', 'execution.json');
    const execution = JSON.parse(fs.readFileSync(execPath, 'utf8'));
    execution.stages['1'].agents['boss-pm'].startTime = new Date(Date.now() - 60_000).toISOString();
    fs.writeFileSync(execPath, JSON.stringify(execution, null, 2) + '\n', 'utf8');

    const result = checkStall('stall-feature', { cwd: tmpDir, maxDurationMs: 30_000 });
    expect(result.stalled).toHaveLength(1);
    expect(result.stalled[0].agent).toBe('boss-pm');
    expect(result.stalled[0].stage).toBe(1);
    expect(result.stalled[0].elapsedMs).toBeGreaterThan(30_000);
    expect(result.stalled[0].failed).toBeUndefined();
  });

  it('does not flag agents within threshold', () => {
    const result = checkStall('stall-feature', { cwd: tmpDir, maxDurationMs: 999_999_999 });
    expect(result.stalled).toHaveLength(0);
  });

  it('auto-fails stalled agents when autoFail=true', () => {
    const execPath = path.join(tmpDir, '.boss', 'stall-feature', '.meta', 'execution.json');
    const execution = JSON.parse(fs.readFileSync(execPath, 'utf8'));
    execution.stages['1'].agents['boss-pm'].startTime = new Date(Date.now() - 120_000).toISOString();
    fs.writeFileSync(execPath, JSON.stringify(execution, null, 2) + '\n', 'utf8');

    const result = checkStall('stall-feature', { cwd: tmpDir, maxDurationMs: 60_000, autoFail: true });
    expect(result.stalled).toHaveLength(1);
    expect(result.stalled[0].failed).toBe(true);

    // Verify agent status was updated
    const updatedExec = JSON.parse(fs.readFileSync(execPath, 'utf8'));
    expect(updatedExec.stages['1'].agents['boss-pm'].status).toBe('failed');
    expect(updatedExec.stages['1'].agents['boss-pm'].failureReason).toBe('timeout');
  });

  it('ignores non-running agents', () => {
    updateAgent('stall-feature', 1, 'boss-pm', 'completed', { cwd: tmpDir });
    const result = checkStall('stall-feature', { cwd: tmpDir, maxDurationMs: 0 });
    expect(result.stalled).toHaveLength(0);
  });
});

describe('cacheTechStack / readCachedTechStack', () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'boss-cache-'));
    initPipeline('cache-feature', { cwd: tmpDir });
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true, maxRetries: 5, retryDelay: 200 });
  });

  it('writes and reads back tech stack data', () => {
    const stack = { language: 'TypeScript', framework: 'Express', runtime: 'Node.js 20' };
    cacheTechStack('cache-feature', stack, { cwd: tmpDir });
    const result = readCachedTechStack('cache-feature', { cwd: tmpDir });
    expect(result).toEqual(stack);
  });

  it('returns null when no cache exists', () => {
    const result = readCachedTechStack('cache-feature', { cwd: tmpDir });
    expect(result).toBeNull();
  });

  it('overwrites previous cache on re-write', () => {
    cacheTechStack('cache-feature', { language: 'Go' }, { cwd: tmpDir });
    cacheTechStack('cache-feature', { language: 'Rust' }, { cwd: tmpDir });
    const result = readCachedTechStack('cache-feature', { cwd: tmpDir });
    expect(result).toEqual({ language: 'Rust' });
  });

  it('persists to .meta/tech-stack.json file', () => {
    cacheTechStack('cache-feature', { db: 'postgres' }, { cwd: tmpDir });
    const filePath = path.join(tmpDir, '.boss', 'cache-feature', '.meta', 'tech-stack.json');
    expect(fs.existsSync(filePath)).toBe(true);
    const raw = JSON.parse(fs.readFileSync(filePath, 'utf8'));
    expect(raw.db).toBe('postgres');
  });
});
