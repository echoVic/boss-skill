import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  initPipeline,
  recordArtifact,
  retryAgent,
  updateAgent,
  updateStage,
} from '../../packages/boss-cli/src/runtime/application/pipeline.js';
import { appendRuntimeEvent } from '../../packages/boss-cli/src/runtime/application/state.js';
import { EVENT_TYPES } from '../../packages/boss-cli/src/runtime/domain/event-types.js';
import { materializeState } from '../../packages/boss-cli/src/runtime/projectors/materialize-state.js';
import { cleanupTempDir } from '../helpers/fixtures.js';
import { runCli } from '../helpers/run-cli.js';

describe('Boss runtime fault injection', () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'boss-runtime-fault-'));
    initPipeline('fault-feature', { cwd: tmpDir });
  });

  afterEach(() => {
    cleanupTempDir(tmpDir);
  });

  function eventsText(): string {
    return fs.readFileSync(
      path.join(tmpDir, '.boss', 'fault-feature', '.meta', 'events.jsonl'),
      'utf8',
    );
  }

  it('rejects path traversal artifact names before appending events', () => {
    const before = eventsText();

    expect(() => {
      recordArtifact('fault-feature', '../escape.json', 1, { cwd: tmpDir });
    }).toThrow(/无效 artifact 路径|Path traversal/i);

    expect(eventsText()).toBe(before);
    expect(fs.existsSync(path.join(tmpDir, '.boss', 'escape.json.v1'))).toBe(false);
  });

  it('recovers from a crash-corrupted trailing event line instead of failing the feature', () => {
    // 模拟原子追加中途崩溃：在事件流末尾追加一条截断的半行 JSON。
    const eventsFile = path.join(tmpDir, '.boss', 'fault-feature', '.meta', 'events.jsonl');
    const validCount = eventsText().trim().split('\n').length;
    fs.appendFileSync(eventsFile, '{"type":"StageStarted","id":999', 'utf8'); // 无换行、半条 JSON

    // 读取/投影应跳过损坏尾行并成功，而不是让整个 feature 不可读
    const { state, eventCount } = materializeState('fault-feature', tmpDir);
    expect(eventCount).toBe(validCount);
    expect(state.feature).toBe('fault-feature');

    // 新事件仍可正常追加，id 基于「可解析行数」而非包含损坏行的行数
    const next = appendRuntimeEvent(tmpDir, 'fault-feature', EVENT_TYPES.STAGE_STARTED, {
      stage: 1,
    });
    expect(next.id).toBe(validCount + 1);
  });

  it('rejects a corrupt NON-trailing event line as tampering', () => {
    const eventsFile = path.join(tmpDir, '.boss', 'fault-feature', '.meta', 'events.jsonl');
    // 先追加一条真实事件，确保损坏行能落在「中间」而非末尾
    appendRuntimeEvent(tmpDir, 'fault-feature', EVENT_TYPES.STAGE_STARTED, { stage: 1 });
    const lines = eventsText().trim().split('\n');
    expect(lines.length).toBeGreaterThanOrEqual(2);
    // 在中间插入损坏行（保证其后仍有合法行）——这不是崩溃残留，而是真正的损坏/篡改
    lines.splice(1, 0, '{corrupt}');
    fs.writeFileSync(eventsFile, lines.join('\n') + '\n', 'utf8');
    expect(() => materializeState('fault-feature', tmpDir)).toThrow(/非末行|not.*JSON/i);
  });

  it('rejects missing Markdown artifact recording without mutating the trace', () => {
    const before = eventsText();

    const result = runCli(
      [
        'packages/boss-cli/dist/bin/boss.js',
        'runtime',
        'record-artifact',
        'fault-feature',
        'prd.md',
        '1',
        '--json',
      ],
      { cwd: tmpDir },
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
      'utf8',
    );
    const before = eventsText();

    const result = runCli(
      [
        'packages/boss-cli/dist/bin/boss.js',
        'runtime',
        'register-plugins',
        'fault-feature',
        '--json',
      ],
      { cwd: tmpDir },
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
        '--json',
      ],
      { cwd: tmpDir },
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
      [
        'packages/boss-cli/dist/bin/boss.js',
        'runtime',
        'retry-agent',
        'fault-feature',
        '3',
        'boss-qa',
        '--json',
      ],
      { cwd: tmpDir },
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
        '--json',
      ],
      { cwd: tmpDir },
    );

    expect(result.status).toBe(1);
    const payload = JSON.parse(result.stderr) as { error: { message: string } };
    expect(payload.error.message).toContain('已达最大重试次数');
    expect(eventsText()).toBe(before);
  });
});
