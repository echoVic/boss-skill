import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import {
  discoverPlugins,
  registerPlugins
} from '../../packages/boss-cli/src/runtime/application/plugin-runtime.js';

const REPO_ROOT = path.resolve(import.meta.dirname, '..', '..');
const BOSS_BIN = path.join(REPO_ROOT, 'packages', 'boss-cli', 'dist', 'bin', 'boss.js');

describe('plugin runtime registration', () => {
  let tmpDir: string;

  function writePlugin(
    dirName: string,
    manifest: Record<string, unknown>,
    scripts: Record<string, string> = {}
  ) {
    const pluginDir = path.join(tmpDir, '.boss', 'plugins', dirName);
    fs.mkdirSync(pluginDir, { recursive: true });
    for (const [fileName, content] of Object.entries(scripts)) {
      fs.writeFileSync(path.join(pluginDir, fileName), content, 'utf8');
    }
    fs.writeFileSync(path.join(pluginDir, 'plugin.json'), JSON.stringify(manifest, null, 2), 'utf8');
    return pluginDir;
  }

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'boss-plugin-runtime-'));
    writePlugin(
      'alpha',
      {
        name: 'alpha',
        version: '1.0.0',
        type: 'gate',
        hooks: { gate: 'gate.sh' },
        dependencies: ['beta'],
        enabled: true
      },
      { 'gate.sh': '#!/bin/bash\nexit 0\n' }
    );
    writePlugin(
      'beta',
      {
        name: 'beta',
        version: '1.0.0',
        type: 'gate',
        hooks: { gate: 'gate.sh' },
        enabled: true
      },
      { 'gate.sh': '#!/bin/bash\nexit 0\n' }
    );
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it('discovers enabled plugins, validates manifests, and honors dependency order', () => {
    const result = discoverPlugins({ cwd: tmpDir });
    expect(result.plugins.map((plugin) => plugin.name)).toEqual(['beta', 'alpha', 'security-audit']);
  });

  it('discovers project plugins from .boss/plugins and built-in plugins from CLI assets', () => {
    const projectPluginDir = path.join(tmpDir, '.boss', 'plugins', 'project-gate');
    fs.mkdirSync(projectPluginDir, { recursive: true });
    fs.writeFileSync(path.join(projectPluginDir, 'gate.js'), '#!/usr/bin/env node\nprocess.stdout.write("[]\\n")\n', 'utf8');
    fs.chmodSync(path.join(projectPluginDir, 'gate.js'), 0o755);
    fs.writeFileSync(
      path.join(projectPluginDir, 'plugin.json'),
      JSON.stringify({
        name: 'project-gate',
        version: '1.0.0',
        type: 'gate',
        hooks: { gate: 'gate.js' },
        enabled: true
      }),
      'utf8'
    );

    const result = discoverPlugins({ cwd: tmpDir });
    expect(result.plugins.some((plugin) => plugin.name === 'project-gate')).toBe(true);
    expect(result.plugins.some((plugin) => plugin.name === 'security-audit')).toBe(true);
  });

  it('does not discover root harness plugins', () => {
    const rootHarnessPlugin = path.join(tmpDir, 'harness', 'plugins', 'legacy-gate');
    fs.mkdirSync(rootHarnessPlugin, { recursive: true });
    fs.writeFileSync(path.join(rootHarnessPlugin, 'gate.js'), '#!/usr/bin/env node\nprocess.exit(0)\n', 'utf8');
    fs.writeFileSync(
      path.join(rootHarnessPlugin, 'plugin.json'),
      '{"name":"legacy-gate","version":"1.0.0","type":"gate","hooks":{"gate":"gate.js"}}\n',
      'utf8'
    );

    const result = discoverPlugins({ cwd: tmpDir });
    expect(result.plugins.some((plugin) => plugin.name === 'legacy-gate')).toBe(false);
  });

  it('excludes disabled plugins from discovery', () => {
    writePlugin(
      'disabled-gate',
      {
        name: 'disabled-gate',
        version: '1.0.0',
        type: 'gate',
        hooks: { gate: 'gate.sh' },
        enabled: false
      },
      { 'gate.sh': '#!/bin/bash\nexit 0\n' }
    );

    const result = discoverPlugins({ cwd: tmpDir });
    expect(result.plugins.some((plugin) => plugin.name === 'disabled-gate')).toBe(false);
  });

  it('fails validation when required fields are missing', () => {
    writePlugin(
      'invalid-missing-name',
      {
        version: '1.0.0',
        type: 'gate',
        hooks: { gate: 'gate.sh' }
      },
      { 'gate.sh': '#!/bin/bash\nexit 0\n' }
    );

    expect(() => discoverPlugins({ cwd: tmpDir })).toThrow(/缺少或无效的 name/);
  });

  it('fails validation for gate plugins without hooks.gate', () => {
    writePlugin('invalid-gate-hook', {
      name: 'invalid-gate-hook',
      version: '1.0.0',
      type: 'gate',
      hooks: {}
    });

    expect(() => discoverPlugins({ cwd: tmpDir })).toThrow(/type=gate 时必须定义 hooks\.gate/);
  });

  it('fails validation when a hook file does not exist', () => {
    writePlugin('invalid-hook-file', {
      name: 'invalid-hook-file',
      version: '1.0.0',
      type: 'gate',
      hooks: { gate: 'missing.sh' }
    });

    expect(() => discoverPlugins({ cwd: tmpDir })).toThrow(/hooks\.gate 指向不存在文件/);
  });

  it('fails dependency validation when a dependency is missing', () => {
    writePlugin(
      'broken-dependency',
      {
        name: 'broken-dependency',
        version: '1.0.0',
        type: 'gate',
        hooks: { gate: 'gate.sh' },
        dependencies: ['not-found']
      },
      { 'gate.sh': '#!/bin/bash\nexit 0\n' }
    );

    expect(() => discoverPlugins({ cwd: tmpDir })).toThrow(/依赖不存在: not-found/);
  });

  it('orders independent plugins deterministically', () => {
    const pluginsRoot = path.join(tmpDir, '.boss', 'plugins');
    fs.rmSync(pluginsRoot, { recursive: true, force: true });
    fs.mkdirSync(pluginsRoot, { recursive: true });

    const names = ['zeta', 'delta', 'epsilon'];
    for (const name of names) {
      const pluginDir = path.join(pluginsRoot, name);
      fs.mkdirSync(pluginDir, { recursive: true });
      fs.writeFileSync(path.join(pluginDir, 'gate.sh'), '#!/bin/bash\nexit 0\n', 'utf8');
      fs.writeFileSync(
        path.join(pluginDir, 'plugin.json'),
        JSON.stringify(
          {
            name,
            version: '1.0.0',
            type: 'gate',
            hooks: { gate: 'gate.sh' }
          },
          null,
          2
        ),
        'utf8'
      );
    }

    const result = discoverPlugins({ cwd: tmpDir });
    expect(result.plugins.map((plugin) => plugin.name)).toEqual([
      'delta',
      'epsilon',
      'security-audit',
      'zeta'
    ]);
  });

  it('fails validation when duplicate plugin names are declared', () => {
    writePlugin(
      'dup-a',
      {
        name: 'dup',
        version: '1.0.0',
        type: 'gate',
        hooks: { gate: 'gate.sh' }
      },
      { 'gate.sh': '#!/bin/bash\nexit 0\n' }
    );
    writePlugin(
      'dup-b',
      {
        name: 'dup',
        version: '1.0.0',
        type: 'gate',
        hooks: { gate: 'gate.sh' }
      },
      { 'gate.sh': '#!/bin/bash\nexit 0\n' }
    );

    expect(() => discoverPlugins({ cwd: tmpDir })).toThrow(/重复插件名: dup/);
  });

  it('registers plugins through runtime lifecycle events and materializes state', () => {
    const metaDir = path.join(tmpDir, '.boss', 'test-feat', '.meta');
    fs.mkdirSync(metaDir, { recursive: true });

    const initialState = {
      schemaVersion: '0.2.0',
      feature: 'test-feat',
      createdAt: '2024-01-01T00:00:00Z',
      updatedAt: '2024-01-01T00:00:00Z',
      status: 'initialized',
      parameters: {},
      stages: {},
      qualityGates: {},
      metrics: { totalDuration: null, stageTimings: {}, gatePassRate: null, retryTotal: 0 },
      plugins: [],
      humanInterventions: [],
      revisionRequests: [],
      feedbackLoops: { maxRounds: 2, currentRound: 0 }
    };

    fs.writeFileSync(path.join(metaDir, 'execution.json'), JSON.stringify(initialState, null, 2), 'utf8');
    fs.writeFileSync(
      path.join(metaDir, 'events.jsonl'),
      `${JSON.stringify({
        id: 1,
        type: 'PipelineInitialized',
        timestamp: '2024-01-01T00:00:00Z',
        data: { initialState }
      })}\n`,
      'utf8'
    );

    const registered = registerPlugins('test-feat', { cwd: tmpDir });
    expect(registered.plugins.map((plugin) => plugin.name)).toEqual(['beta', 'alpha', 'security-audit']);

    const events = fs
      .readFileSync(path.join(metaDir, 'events.jsonl'), 'utf8')
      .trim()
      .split('\n')
      .map((line) => JSON.parse(line) as { type: string });

    expect(events.some((event) => event.type === 'PluginDiscovered')).toBe(true);
    expect(events.some((event) => event.type === 'PluginActivated')).toBe(true);
    expect(events.some((event) => event.type === 'PluginsRegistered')).toBe(true);

    const execution = JSON.parse(fs.readFileSync(path.join(metaDir, 'execution.json'), 'utf8')) as {
      plugins: Array<{ name: string }>;
      pluginLifecycle: {
        discovered: Array<{ name: string }>;
        activated: Array<{ name: string }>;
      };
    };
    expect(execution.plugins.map((plugin) => plugin.name)).toEqual(['beta', 'alpha', 'security-audit']);
    expect(execution.pluginLifecycle.discovered.map((plugin) => plugin.name)).toEqual([
      'beta',
      'alpha',
      'security-audit'
    ]);
    expect(execution.pluginLifecycle.activated.map((plugin) => plugin.name)).toEqual([
      'beta',
      'alpha',
      'security-audit'
    ]);
  });

  it('preserves plugin union across sequential filtered registration', () => {
    writePlugin(
      'echo-reporter',
      {
        name: 'echo-reporter',
        version: '1.0.0',
        type: 'reporter',
        hooks: { report: 'report.sh' },
        enabled: true
      },
      { 'report.sh': '#!/bin/bash\nexit 0\n' }
    );

    const metaDir = path.join(tmpDir, '.boss', 'test-feat', '.meta');
    fs.mkdirSync(metaDir, { recursive: true });
    const initialState = {
      schemaVersion: '0.2.0',
      feature: 'test-feat',
      createdAt: '2024-01-01T00:00:00Z',
      updatedAt: '2024-01-01T00:00:00Z',
      status: 'initialized',
      parameters: {},
      stages: {},
      qualityGates: {},
      metrics: { totalDuration: null, stageTimings: {}, gatePassRate: null, retryTotal: 0 },
      plugins: [],
      humanInterventions: [],
      revisionRequests: [],
      feedbackLoops: { maxRounds: 2, currentRound: 0 }
    };
    fs.writeFileSync(path.join(metaDir, 'execution.json'), JSON.stringify(initialState, null, 2), 'utf8');
    fs.writeFileSync(
      path.join(metaDir, 'events.jsonl'),
      `${JSON.stringify({
        id: 1,
        type: 'PipelineInitialized',
        timestamp: '2024-01-01T00:00:00Z',
        data: { initialState }
      })}\n`,
      'utf8'
    );

    registerPlugins('test-feat', { cwd: tmpDir, type: 'gate' });
    const secondPass = registerPlugins('test-feat', { cwd: tmpDir, type: 'reporter' });

    expect(secondPass.plugins.map((plugin) => plugin.name)).toEqual([
      'beta',
      'alpha',
      'security-audit',
      'echo-reporter'
    ]);
    expect(secondPass.execution.plugins.map((plugin) => plugin.name)).toEqual([
      'beta',
      'alpha',
      'security-audit',
      'echo-reporter'
    ]);
  });

  it('register-plugins CLI reports event registration instead of a direct execution write', () => {
    const metaDir = path.join(tmpDir, '.boss', 'test-feat', '.meta');
    fs.mkdirSync(metaDir, { recursive: true });
    const initialState = {
      schemaVersion: '0.2.0',
      feature: 'test-feat',
      createdAt: '2024-01-01T00:00:00Z',
      updatedAt: '2024-01-01T00:00:00Z',
      status: 'initialized',
      parameters: {},
      stages: {},
      qualityGates: {},
      metrics: { totalDuration: null, stageTimings: {}, gatePassRate: null, retryTotal: 0 },
      plugins: [],
      pluginLifecycle: { discovered: [], activated: [] },
      humanInterventions: [],
      revisionRequests: [],
      feedbackLoops: { maxRounds: 2, currentRound: 0 }
    };
    fs.writeFileSync(path.join(metaDir, 'execution.json'), JSON.stringify(initialState, null, 2), 'utf8');
    fs.writeFileSync(
      path.join(metaDir, 'events.jsonl'),
      `${JSON.stringify({
        id: 1,
        type: 'PipelineInitialized',
        timestamp: '2024-01-01T00:00:00Z',
        data: { initialState }
      })}\n`,
      'utf8'
    );

    const result = spawnSync(process.execPath, [BOSS_BIN, 'runtime', 'register-plugins', '--register', 'test-feat'], {
      cwd: tmpDir,
      encoding: 'utf8'
    });

    expect(result.status).toBe(0);
    const payload = JSON.parse(result.stdout) as {
      feature: string;
      plugin_count: number;
      plugin_names: string[];
      executionPath: string;
    };
    expect(payload.feature).toBe('test-feat');
    expect(payload.plugin_count).toBeGreaterThan(0);
    expect(payload.plugin_names).toContain('security-audit');
    expect(payload.executionPath).toBe('.boss/test-feat/.meta/execution.json');
    expect(result.stdout).not.toMatch(/注册 .* 到 .*execution\.json/);
  });
});
