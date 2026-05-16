import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { runCli } from '../helpers/run-cli.js';
import {
  initPipeline,
  recordArtifact,
  retryAgent,
  updateAgent,
  updateStage
} from '../../packages/boss-cli/src/runtime/application/pipeline.js';

describe('Boss runtime fault injection', () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'boss-runtime-fault-'));
    initPipeline('fault-feature', { cwd: tmpDir });
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true, maxRetries: 5, retryDelay: 200 });
  });

  function eventsText(): string {
    return fs.readFileSync(path.join(tmpDir, '.boss', 'fault-feature', '.meta', 'events.jsonl'), 'utf8');
  }

  it('rejects path traversal artifact names before appending events', () => {
    const before = eventsText();

    expect(() => {
      recordArtifact('fault-feature', '../escape.json', 1, { cwd: tmpDir });
    }).toThrow(/无效 artifact 路径|Path traversal/i);

    expect(eventsText()).toBe(before);
    expect(fs.existsSync(path.join(tmpDir, '.boss', 'escape.json.v1'))).toBe(false);
  });

  it('rejects missing Markdown artifact recording without mutating the trace', () => {
    const before = eventsText();

    const result = runCli(
      ['packages/boss-cli/dist/bin/boss.js', 'runtime', 'record-artifact', 'fault-feature', 'prd.md', '1', '--json'],
      { cwd: tmpDir }
    );

    expect(result.status).toBe(1);
    const payload = JSON.parse(result.stderr) as { error: { message: string } };
    expect(payload.error.message).toContain('未找到 Markdown 产物');
    expect(eventsText()).toBe(before);
  });

  it('rejects malformed plugin manifests without appending registration events', () => {
    const pluginDir = path.join(tmpDir, '.boss', 'plugins', 'broken-gate');
    fs.mkdirSync(pluginDir, { recursive: true });
    fs.writeFileSync(path.join(pluginDir, 'gate.sh'), '#!/bin/bash\nexit 0\n', 'utf8');
    fs.writeFileSync(
      path.join(pluginDir, 'plugin.json'),
      JSON.stringify({ version: '1.0.0', type: 'gate', hooks: { gate: 'gate.sh' } }),
      'utf8'
    );
    const before = eventsText();

    const result = runCli(
      ['packages/boss-cli/dist/bin/boss.js', 'runtime', 'register-plugins', 'fault-feature', '--json'],
      { cwd: tmpDir }
    );

    expect(result.status).toBe(1);
    const payload = JSON.parse(result.stderr) as { error: { message: string } };
    expect(payload.error.message).toContain('缺少或无效的 name');
    expect(eventsText()).toBe(before);
  });

  it('rejects malformed agent status values before appending events', () => {
    updateStage('fault-feature', 3, 'running', { cwd: tmpDir });
    const before = eventsText();

    const result = runCli(
      [
        'packages/boss-cli/dist/bin/boss.js',
        'runtime',
        'update-agent',
        'fault-feature',
        '3',
        'boss-qa',
        'BOSS_STATUS=done',
        '--json'
      ],
      { cwd: tmpDir }
    );

    expect(result.status).toBe(1);
    const payload = JSON.parse(result.stderr) as { error: { message: string } };
    expect(payload.error.message).toContain('无效状态');
    expect(eventsText()).toBe(before);
  });

  it('requires confirmation for retry-agent in non-interactive CLI runs', () => {
    updateStage('fault-feature', 3, 'running', { cwd: tmpDir });
    updateAgent('fault-feature', 3, 'boss-qa', 'running', { cwd: tmpDir });
    updateAgent('fault-feature', 3, 'boss-qa', 'failed', { cwd: tmpDir, reason: 'test failure' });
    const before = eventsText();

    const result = runCli(
      ['packages/boss-cli/dist/bin/boss.js', 'runtime', 'retry-agent', 'fault-feature', '3', 'boss-qa', '--json'],
      { cwd: tmpDir }
    );

    expect(result.status).toBe(1);
    const payload = JSON.parse(result.stderr) as { error: { code: string; suggestion: string } };
    expect(payload.error.code).toBe('confirmation_required');
    expect(payload.error.suggestion).toContain('--yes');
    expect(eventsText()).toBe(before);
  });

  it('rejects retry exhaustion without appending retry events', () => {
    updateStage('fault-feature', 3, 'running', { cwd: tmpDir });
    updateAgent('fault-feature', 3, 'boss-qa', 'running', { cwd: tmpDir });
    updateAgent('fault-feature', 3, 'boss-qa', 'failed', { cwd: tmpDir, reason: 'first failure' });
    retryAgent('fault-feature', 3, 'boss-qa', { cwd: tmpDir });
    updateAgent('fault-feature', 3, 'boss-qa', 'failed', { cwd: tmpDir, reason: 'second failure' });
    retryAgent('fault-feature', 3, 'boss-qa', { cwd: tmpDir });
    updateAgent('fault-feature', 3, 'boss-qa', 'failed', { cwd: tmpDir, reason: 'third failure' });
    const before = eventsText();

    const result = runCli(
      [
        'packages/boss-cli/dist/bin/boss.js',
        'runtime',
        'retry-agent',
        'fault-feature',
        '3',
        'boss-qa',
        '--yes',
        '--json'
      ],
      { cwd: tmpDir }
    );

    expect(result.status).toBe(1);
    const payload = JSON.parse(result.stderr) as { error: { message: string } };
    expect(payload.error.message).toContain('已达最大重试次数');
    expect(eventsText()).toBe(before);
  });
});
