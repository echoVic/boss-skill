import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { emitProgress } from '../../src/scripts/lib/progress-emitter.js';
import {
  buildFeatureSummary,
  writeFeatureMemory
} from '../../src/runtime/cli/lib/memory-runtime.js';
import { inspectPipeline } from '../../src/runtime/cli/lib/inspection-runtime.js';
import { initPipeline } from '../../src/runtime/cli/lib/pipeline-runtime.js';

const REPO_ROOT = path.resolve(import.meta.dirname, '..', '..');

describe('inspection runtime CLIs', () => {
  let tmpDir: string;
  let cwd: string;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'boss-inspect-'));
    cwd = process.cwd();
    process.chdir(tmpDir);
  });

  afterEach(() => {
    process.chdir(cwd);
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  function runtimeCli(name: string) {
    return path.join(REPO_ROOT, 'dist', 'runtime', 'cli', `${name}.js`);
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

  it('inspect-pipeline reports current stage, ready artifacts, active agents, pack, plugins, and metrics', () => {
    fs.writeFileSync(path.join(tmpDir, 'package.json'), '{"name":"api-only-app"}\n', 'utf8');

    expectSuccess(runRuntimeCommand('init-pipeline', ['test-feat']), 'init-pipeline');
    expectSuccess(runRuntimeCommand('register-plugins', ['--register', 'test-feat']), 'register-plugins');
    expectSuccess(runRuntimeCommand('update-stage', ['test-feat', '1', 'running']), 'update-stage');
    expectSuccess(runRuntimeCommand('record-artifact', ['test-feat', 'prd.md', '1']), 'record-artifact');
    expectSuccess(runRuntimeCommand('update-stage', ['test-feat', '1', 'completed']), 'update-stage-complete');
    expectSuccess(runRuntimeCommand('update-agent', ['test-feat', '2', 'boss-tech-lead', 'running']), 'update-agent');

    const inspect = runRuntimeCommand('inspect-pipeline', ['test-feat', '--json']);
    expectSuccess(inspect, 'inspect-pipeline');

    const payload = JSON.parse(inspect.stdout) as {
      feature: string;
      status: string;
      currentStage: { id: number; status: string };
      pack: { name: string };
      plugins: { active: Array<{ name: string }> };
      readyArtifacts: string[];
      activeAgents: Array<{ stage: number; agent: string; status: string }>;
      metrics: Record<string, number>;
    };
    expect(payload.feature).toBe('test-feat');
    expect(payload.status).toBe('running');
    expect(payload.currentStage.id).toBe(2);
    expect(payload.currentStage.status).toBe('pending');
    expect(payload.pack.name).toBe('api-only');
    expect(payload.plugins.active.some((plugin) => plugin.name === 'security-audit')).toBe(true);
    expect(payload.readyArtifacts).toContain('architecture.md');
    expect(payload.activeAgents).toEqual([
      { stage: 2, agent: 'boss-tech-lead', status: 'running' }
    ]);
    expect(typeof payload.metrics.retryTotal).toBe('number');
    expect(typeof payload.metrics.agentSuccessCount).toBe('number');
    expect(typeof payload.metrics.agentFailureCount).toBe('number');
    expect(typeof payload.metrics.meanRetriesPerStage).toBe('number');
    expect(typeof payload.metrics.revisionLoopCount).toBe('number');
    expect(typeof payload.metrics.pluginFailureCount).toBe('number');
  });

  it('inspect-events returns recent events in reverse chronological order with filtering', () => {
    expectSuccess(runRuntimeCommand('init-pipeline', ['test-feat']), 'init-pipeline');
    expectSuccess(runRuntimeCommand('update-stage', ['test-feat', '1', 'running']), 'update-stage');
    expectSuccess(runRuntimeCommand('record-artifact', ['test-feat', 'prd.md', '1']), 'record-artifact');
    expectSuccess(runRuntimeCommand('update-stage', ['test-feat', '1', 'completed']), 'update-stage-complete');

    const inspectRecent = runRuntimeCommand('inspect-events', ['test-feat', '--json', '--limit', '2']);
    expectSuccess(inspectRecent, 'inspect-events recent');
    const recentPayload = JSON.parse(inspectRecent.stdout) as {
      feature: string;
      events: Array<{ type: string }>;
    };
    expect(recentPayload.feature).toBe('test-feat');
    expect(recentPayload.events).toHaveLength(2);
    expect(recentPayload.events[0].type).toBe('StageCompleted');
    expect(recentPayload.events[1].type).toBe('ArtifactRecorded');

    const inspectFiltered = runRuntimeCommand('inspect-events', [
      'test-feat',
      '--json',
      '--type',
      'ArtifactRecorded'
    ]);
    expectSuccess(inspectFiltered, 'inspect-events filtered');
    const filteredPayload = JSON.parse(inspectFiltered.stdout) as { events: Array<{ type: string }> };
    expect(filteredPayload.events).toHaveLength(1);
    expect(filteredPayload.events[0].type).toBe('ArtifactRecorded');
  });

  it('inspect-plugins returns plugin lifecycle slices from the execution view', () => {
    const pluginDir = path.join(tmpDir, 'harness', 'plugins', 'local-reporter');
    fs.mkdirSync(pluginDir, { recursive: true });
    fs.writeFileSync(path.join(pluginDir, 'report.sh'), '#!/bin/bash\nexit 0\n', 'utf8');
    fs.writeFileSync(path.join(pluginDir, 'post-gate.sh'), '#!/bin/bash\nexit 0\n', 'utf8');
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

    expectSuccess(runRuntimeCommand('init-pipeline', ['test-feat']), 'init-pipeline');
    expectSuccess(runRuntimeCommand('register-plugins', ['--register', 'test-feat']), 'register-plugins');
    expectSuccess(runRuntimeCommand('run-plugin-hook', ['post-gate', 'test-feat', '--stage', '3']), 'run-plugin-hook');

    const inspect = runRuntimeCommand('inspect-plugins', ['test-feat', '--json']);
    expectSuccess(inspect, 'inspect-plugins');

    const payload = JSON.parse(inspect.stdout) as {
      feature: string;
      active: Array<{ name: string }>;
      discovered: Array<{ name: string }>;
      activated: Array<{ name: string }>;
      executed: unknown[];
      failed: unknown[];
    };
    expect(payload.feature).toBe('test-feat');
    expect(payload.active.some((plugin) => plugin.name === 'local-reporter')).toBe(true);
    expect(payload.discovered.some((plugin) => plugin.name === 'local-reporter')).toBe(true);
    expect(payload.activated.some((plugin) => plugin.name === 'local-reporter')).toBe(true);
    expect(payload.executed).toHaveLength(1);
    expect(payload.failed).toHaveLength(0);
  });

  it('inspect-progress returns recent structured progress events', () => {
    expectSuccess(runRuntimeCommand('init-pipeline', ['test-feat']), 'init-pipeline');
    emitProgress(tmpDir, 'test-feat', { type: 'stage-start', data: { stage: 1 } });
    emitProgress(tmpDir, 'test-feat', { type: 'agent-start', data: { stage: 1, agent: 'boss-pm' } });

    const inspect = runRuntimeCommand('inspect-progress', ['test-feat', '--json', '--limit', '1']);
    expectSuccess(inspect, 'inspect-progress');

    const payload = JSON.parse(inspect.stdout) as {
      feature: string;
      events: Array<{ feature: string; type: string }>;
    };
    expect(payload.feature).toBe('test-feat');
    expect(payload.events).toHaveLength(1);
    expect(payload.events[0].feature).toBe('test-feat');
    expect(payload.events[0].type).toBe('agent-start');
  });

  it('inspect-pipeline includes startup memory summary when available', () => {
    initPipeline('test-feat', { cwd: tmpDir });
    writeFeatureMemory(
      'test-feat',
      [
        {
          id: 'm1',
          scope: 'feature',
          kind: 'execution',
          category: 'historical_risk',
          summary: 'Stage 3 is unstable',
          source: { type: 'events' },
          evidence: [{ type: 'event', ref: '2' }],
          tags: ['stage3'],
          confidence: 0.9,
          createdAt: '2026-04-17T00:00:00Z',
          lastSeenAt: '2026-04-17T00:00:00Z',
          expiresAt: null,
          decayScore: 10,
          influence: 'preference'
        }
      ],
      { cwd: tmpDir }
    );
    buildFeatureSummary('test-feat', { cwd: tmpDir });

    const payload = inspectPipeline('test-feat', { cwd: tmpDir });
    expect(payload.memory.startupSummary[0].summary).toBe('Stage 3 is unstable');
  });
});
