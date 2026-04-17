import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const REPO_ROOT = path.resolve(import.meta.dirname, '..', '..');

describe('pack/plugin runtime integration', () => {
  let tmpDir: string;

  function runtimeCli(name: string) {
    return path.join(REPO_ROOT, 'runtime', 'cli', `${name}.js`);
  }

  function runRuntimeCommand(name: string, args: string[]) {
    return spawnSync(process.execPath, [runtimeCli(name), ...args], {
      cwd: tmpDir,
      encoding: 'utf8'
    });
  }

  function expectSuccess(result: ReturnType<typeof spawnSync>, label: string) {
    expect(result.status, `${label} should exit 0\nstdout:\n${result.stdout}\nstderr:\n${result.stderr}`).toBe(0);
  }

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'boss-pack-plugin-'));
    fs.writeFileSync(path.join(tmpDir, 'package.json'), '{"name":"api-only-app"}\n', 'utf8');

    const pluginDir = path.join(tmpDir, 'harness', 'plugins', 'local-reporter');
    fs.mkdirSync(pluginDir, { recursive: true });
    fs.writeFileSync(path.join(pluginDir, 'report.sh'), '#!/bin/bash\nexit 0\n', 'utf8');
    fs.writeFileSync(
      path.join(pluginDir, 'post-gate.sh'),
      '#!/bin/bash\necho "$1:$2" > .boss/test-feat/.meta/local-reporter.log\nexit 0\n',
      'utf8'
    );
    fs.writeFileSync(
      path.join(pluginDir, 'plugin.json'),
      JSON.stringify(
        {
          name: 'local-reporter',
          version: '1.0.0',
          type: 'reporter',
          hooks: {
            report: 'report.sh',
            'post-gate': 'post-gate.sh'
          },
          stages: [3]
        },
        null,
        2
      ),
      'utf8'
    );
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it('reconstructs pack and plugin hook state from events only', () => {
    expectSuccess(runRuntimeCommand('init-pipeline', ['test-feat']), 'init-pipeline');
    expectSuccess(runRuntimeCommand('register-plugins', ['--register', 'test-feat']), 'register-plugins');
    expectSuccess(runRuntimeCommand('run-plugin-hook', ['post-gate', 'test-feat', '--stage', '3']), 'run-plugin-hook');

    const execution = JSON.parse(
      fs.readFileSync(path.join(tmpDir, '.boss', 'test-feat', '.meta', 'execution.json'), 'utf8')
    ) as {
      parameters: { pipelinePack: string };
      plugins: Array<{ name: string }>;
      pluginLifecycle: {
        discovered: Array<{ name: string }>;
        activated: Array<{ name: string }>;
        executed: Array<{ plugin: { name: string }; hook: string; stage: number }>;
      };
    };

    expect(execution.parameters.pipelinePack).toBe('api-only');
    expect(execution.plugins.some((plugin) => plugin.name === 'local-reporter')).toBe(true);
    expect(execution.pluginLifecycle.discovered.some((plugin) => plugin.name === 'local-reporter')).toBe(true);
    expect(execution.pluginLifecycle.activated.some((plugin) => plugin.name === 'local-reporter')).toBe(true);
    expect(execution.pluginLifecycle.executed).toHaveLength(1);
    expect(execution.pluginLifecycle.executed[0]?.plugin.name).toBe('local-reporter');
    expect(execution.pluginLifecycle.executed[0]?.hook).toBe('post-gate');
    expect(execution.pluginLifecycle.executed[0]?.stage).toBe(3);

    const eventTypes = fs
      .readFileSync(path.join(tmpDir, '.boss', 'test-feat', '.meta', 'events.jsonl'), 'utf8')
      .trim()
      .split('\n')
      .map((line) => (JSON.parse(line) as { type: string }).type);

    expect(eventTypes).toContain('PackApplied');
    expect(eventTypes).toContain('PluginDiscovered');
    expect(eventTypes).toContain('PluginActivated');
    expect(eventTypes).toContain('PluginHookExecuted');
  });
});
