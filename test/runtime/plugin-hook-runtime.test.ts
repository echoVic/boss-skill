import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { initPipeline } from '../../src/runtime/cli/lib/pipeline-runtime.js';
import { runHook } from '../../src/runtime/cli/lib/plugin-runtime.js';

const REPO_ROOT = path.resolve(import.meta.dirname, '..', '..');

describe('plugin hook execution', () => {
  let tmpDir: string;

  function writePlugin(
    dirName: string,
    manifest: Record<string, unknown>,
    scripts: Record<string, string> = {}
  ) {
    const pluginDir = path.join(tmpDir, 'harness', 'plugins', dirName);
    fs.mkdirSync(pluginDir, { recursive: true });
    for (const [fileName, content] of Object.entries(scripts)) {
      fs.writeFileSync(path.join(pluginDir, fileName), content, 'utf8');
    }
    fs.writeFileSync(path.join(pluginDir, 'plugin.json'), JSON.stringify(manifest, null, 2), 'utf8');
  }

  function readEvents() {
    return fs
      .readFileSync(path.join(tmpDir, '.boss', 'test-feat', '.meta', 'events.jsonl'), 'utf8')
      .trim()
      .split('\n')
      .map((line) => JSON.parse(line) as { type: string; data: Record<string, unknown> });
  }

  function readExecution() {
    return JSON.parse(
      fs.readFileSync(path.join(tmpDir, '.boss', 'test-feat', '.meta', 'execution.json'), 'utf8')
    ) as {
      pluginLifecycle: {
        executed: Array<{ plugin: { name: string }; hook: string; stage: number }>;
        failed: Array<{ plugin: { name: string }; exitCode: number }>;
      };
    };
  }

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'boss-plugin-hook-'));
    initPipeline('test-feat', { cwd: tmpDir });
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it('records PluginHookExecuted for matching plugins and materializes lifecycle state', () => {
    writePlugin(
      'echo-reporter',
      {
        name: 'echo-reporter',
        version: '1.0.0',
        type: 'reporter',
        hooks: {
          report: 'report.sh',
          'post-gate': 'post-gate.sh'
        },
        stages: [3]
      },
      {
        'report.sh': '#!/bin/bash\nexit 0\n',
        'post-gate.sh': '#!/bin/bash\necho \"$1:$2\" > .boss/test-feat/.meta/post-gate.log\nexit 0\n'
      }
    );

    const result = runHook('post-gate', 'test-feat', { cwd: tmpDir, stage: 3 });
    expect(Array.isArray(result.results)).toBe(true);
    expect(result.results).toHaveLength(1);
    expect(result.results[0].plugin.name).toBe('echo-reporter');
    expect(result.results[0].hook).toBe('post-gate');
    expect(result.results[0].exitCode).toBe(0);
    expect(result.results[0].passed).toBe(true);

    const events = readEvents();
    const executed = events.filter((event) => event.type === 'PluginHookExecuted');
    expect(executed).toHaveLength(1);
    expect((executed[0].data.plugin as { name: string }).name).toBe('echo-reporter');
    expect(executed[0].data.hook).toBe('post-gate');
    expect(executed[0].data.stage).toBe(3);

    const execution = readExecution();
    expect(Array.isArray(execution.pluginLifecycle.executed)).toBe(true);
    expect(execution.pluginLifecycle.executed).toHaveLength(1);
    expect(execution.pluginLifecycle.executed[0].plugin.name).toBe('echo-reporter');
    expect(execution.pluginLifecycle.executed[0].hook).toBe('post-gate');
    expect(execution.pluginLifecycle.executed[0].stage).toBe(3);

    const marker = path.join(tmpDir, '.boss', 'test-feat', '.meta', 'post-gate.log');
    expect(fs.existsSync(marker)).toBe(true);
    expect(fs.readFileSync(marker, 'utf8').trim()).toBe('test-feat:3');
  });

  it('records PluginHookFailed for non-zero hook exits and keeps runtime callable', () => {
    writePlugin(
      'failing-reporter',
      {
        name: 'failing-reporter',
        version: '1.0.0',
        type: 'reporter',
        hooks: {
          report: 'report.sh',
          'post-gate': 'post-gate.sh'
        },
        stages: [3]
      },
      {
        'report.sh': '#!/bin/bash\nexit 0\n',
        'post-gate.sh': '#!/bin/bash\nexit 7\n'
      }
    );

    const result = runHook('post-gate', 'test-feat', { cwd: tmpDir, stage: 3 });
    expect(result.results).toHaveLength(1);
    expect(result.results[0].plugin.name).toBe('failing-reporter');
    expect(result.results[0].passed).toBe(false);
    expect(result.results[0].exitCode).toBe(7);

    const events = readEvents();
    const failed = events.filter((event) => event.type === 'PluginHookFailed');
    expect(failed).toHaveLength(1);
    expect((failed[0].data.plugin as { name: string }).name).toBe('failing-reporter');
    expect(failed[0].data.hook).toBe('post-gate');
    expect(failed[0].data.exitCode).toBe(7);

    const execution = readExecution();
    expect(Array.isArray(execution.pluginLifecycle.failed)).toBe(true);
    expect(execution.pluginLifecycle.failed).toHaveLength(1);
    expect(execution.pluginLifecycle.failed[0].plugin.name).toBe('failing-reporter');
    expect(execution.pluginLifecycle.failed[0].exitCode).toBe(7);
  });

  it('run-plugin-hook CLI returns machine-readable JSON results', () => {
    writePlugin(
      'cli-reporter',
      {
        name: 'cli-reporter',
        version: '1.0.0',
        type: 'reporter',
        hooks: {
          report: 'report.sh',
          'post-gate': 'post-gate.sh'
        },
        stages: [3]
      },
      {
        'report.sh': '#!/bin/bash\nexit 0\n',
        'post-gate.sh': '#!/bin/bash\nexit 0\n'
      }
    );

    const cliPath = path.join(REPO_ROOT, 'dist', 'runtime', 'cli', 'run-plugin-hook.js');
    const result = spawnSync(process.execPath, [cliPath, 'post-gate', 'test-feat', '--stage', '3'], {
      cwd: tmpDir,
      encoding: 'utf8'
    });

    expect(result.status).toBe(0);
    const payload = JSON.parse(result.stdout) as {
      hook: string;
      feature: string;
      stage: number;
      results: Array<{ plugin: { name: string } }>;
    };
    expect(payload.hook).toBe('post-gate');
    expect(payload.feature).toBe('test-feat');
    expect(payload.stage).toBe(3);
    expect(Array.isArray(payload.results)).toBe(true);
    expect(payload.results[0].plugin.name).toBe('cli-reporter');
  });

  it('run-plugin-hook CLI returns non-zero when a hook fails', () => {
    writePlugin(
      'cli-failing-reporter',
      {
        name: 'cli-failing-reporter',
        version: '1.0.0',
        type: 'reporter',
        hooks: {
          report: 'report.sh',
          'post-gate': 'post-gate.sh'
        },
        stages: [3]
      },
      {
        'report.sh': '#!/bin/bash\nexit 0\n',
        'post-gate.sh': '#!/bin/bash\nexit 4\n'
      }
    );

    const cliPath = path.join(REPO_ROOT, 'dist', 'runtime', 'cli', 'run-plugin-hook.js');
    const result = spawnSync(process.execPath, [cliPath, 'post-gate', 'test-feat', '--stage', '3'], {
      cwd: tmpDir,
      encoding: 'utf8'
    });

    expect(result.status).toBe(1);
    const payload = JSON.parse(result.stdout) as {
      results: Array<{ exitCode: number; passed: boolean; plugin: { name: string } }>;
    };
    expect(payload.results).toHaveLength(1);
    expect(payload.results[0].plugin.name).toBe('cli-failing-reporter');
    expect(payload.results[0].exitCode).toBe(4);
    expect(payload.results[0].passed).toBe(false);
  });
});
