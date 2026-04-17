import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const REPO_ROOT = path.resolve(import.meta.dirname, '..', '..');

describe('feature flow integration (runtime commands only)', () => {
  let tmpDir: string;
  let cwd: string;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'boss-feature-flow-'));
    cwd = process.cwd();
    process.chdir(tmpDir);
  });

  afterEach(() => {
    process.chdir(cwd);
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

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

  function readExecution() {
    return JSON.parse(
      fs.readFileSync(path.join(tmpDir, '.boss', 'test-feat', '.meta', 'execution.json'), 'utf8')
    ) as {
      stages: {
        '1': { status: string; artifacts: string[] };
        '2': { agents: { 'boss-tech-lead': { status: string } } };
        '3': { gateResults: { gate1: { passed: boolean } } };
      };
      plugins: Array<{ name: string }>;
      qualityGates: { gate1: { status: string; passed: boolean } };
    };
  }

  function readEventTypes() {
    return fs
      .readFileSync(path.join(tmpDir, '.boss', 'test-feat', '.meta', 'events.jsonl'), 'utf8')
      .trim()
      .split('\n')
      .map((line) => (JSON.parse(line) as { type: string }).type);
  }

  it('materializes stage, artifact, plugin, agent, and gate state through runtime commands', () => {
    expectSuccess(runRuntimeCommand('init-pipeline', ['test-feat']), 'initPipeline');
    expectSuccess(runRuntimeCommand('register-plugins', ['--register', 'test-feat']), 'registerPlugins');
    expectSuccess(runRuntimeCommand('update-stage', ['test-feat', '1', 'running']), 'updateStage stage1 running');
    expectSuccess(runRuntimeCommand('record-artifact', ['test-feat', 'prd.md', '1']), 'recordArtifact prd.md');
    expectSuccess(runRuntimeCommand('record-artifact', ['test-feat', 'architecture.md', '1']), 'recordArtifact architecture.md');
    expectSuccess(runRuntimeCommand('update-stage', ['test-feat', '1', 'completed']), 'updateStage stage1 completed');
    expectSuccess(runRuntimeCommand('update-agent', ['test-feat', '2', 'boss-tech-lead', 'running']), 'updateAgent stage2 boss-tech-lead running');
    expectSuccess(runRuntimeCommand('evaluate-gates', ['test-feat', 'gate1']), 'evaluateGates gate1');

    const execution = readExecution();
    const stage1Artifacts = execution.stages['1'].artifacts;

    expect(execution.stages['1'].status).toBe('completed');
    expect(stage1Artifacts.slice().sort()).toEqual(['architecture.md', 'prd.md']);
    expect(execution.plugins.some((plugin) => plugin.name === 'security-audit')).toBe(true);
    expect(execution.stages['2'].agents['boss-tech-lead'].status).toBe('running');
    expect(execution.qualityGates.gate1.status).toBe('completed');
    expect(execution.qualityGates.gate1.passed).toBe(true);
    expect(execution.stages['3'].gateResults.gate1.passed).toBe(true);

    expect(readEventTypes()).toEqual([
      'PipelineInitialized',
      'PluginDiscovered',
      'PluginActivated',
      'PluginsRegistered',
      'StageStarted',
      'ArtifactRecorded',
      'ArtifactRecorded',
      'StageCompleted',
      'AgentStarted',
      'GateEvaluated'
    ]);
  });
});
