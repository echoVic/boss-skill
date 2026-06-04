import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import * as runtime from '../../packages/boss-cli/src/runtime/application/pipeline.js';
import { hashWorkflowValue } from '../../packages/boss-cli/src/runtime/application/workflow.js';
import { cleanupTempDir } from '../helpers/fixtures.js';
import { ensureBuilt } from '../helpers/run-cli.js';

const REPO_ROOT = path.resolve(import.meta.dirname, '..', '..');
const BOSS_BIN = path.join(REPO_ROOT, 'packages', 'boss-cli', 'dist', 'bin', 'boss.js');

interface WorkflowPlanNode {
  id: string;
  kind: 'agent' | 'gate' | 'input';
  artifact?: string;
  gate?: string;
  agent?: string | string[] | null;
  stage: number;
  phase: string;
  inputs: string[];
  parallelGroup?: string;
}

interface WorkflowPlan {
  schemaVersion: string;
  feature: string;
  source: {
    pack: { name: string; version: string; hash: { value: string } };
    artifactDag: { hash: { value: string } };
  };
  phases: Array<{ id: string; stage: number; name: string; nodeIds: string[] }>;
  nodes: WorkflowPlanNode[];
  validation: { deterministic: boolean; errors: string[] };
}

describe('workflow runtime layer', () => {
  let tmpDir: string;
  let cwd: string;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'boss-workflow-runtime-'));
    cwd = process.cwd();
    process.chdir(tmpDir);
  });

  afterEach(() => {
    process.chdir(cwd);
    cleanupTempDir(tmpDir);
  });

  function readPlan(feature = 'workflow-feat'): WorkflowPlan {
    const planPath = path.join(tmpDir, '.boss', feature, '.meta', 'workflow-plan.json');
    return JSON.parse(fs.readFileSync(planPath, 'utf8')) as WorkflowPlan;
  }

  function runRuntimeCommand(name: string, args: string[]) {
    ensureBuilt('packages/boss-cli/dist/bin/boss.js');
    return spawnSync(process.execPath, [BOSS_BIN, 'runtime', name, ...args], {
      cwd: tmpDir,
      encoding: 'utf8'
    });
  }

  it('initializes a deterministic workflow plan and separates definition metadata from run metadata', () => {
    const state = runtime.initPipeline('workflow-feat', { cwd: tmpDir });
    const planPath = path.join(tmpDir, '.boss', 'workflow-feat', '.meta', 'workflow-plan.json');

    expect(fs.existsSync(planPath)).toBe(true);
    const plan = readPlan();
    expect(plan.schemaVersion).toBe('1.0.0');
    expect(plan.feature).toBe('workflow-feat');
    expect(plan.validation).toEqual({ deterministic: true, errors: [] });
    expect(plan.phases.map((phase) => phase.stage)).toEqual([0, 1, 2, 3, 4]);
    expect(plan.nodes.some((node) => node.kind === 'agent' && node.artifact === 'prd.md')).toBe(true);
    expect(plan.nodes.some((node) => node.kind === 'gate' && node.gate === 'gate1')).toBe(true);
    expect(plan.nodes.find((node) => node.artifact === 'code')?.parallelGroup).toBe('stage-3-code');

    expect(state.parameters.workflowPlanPath).toBe('.boss/workflow-feat/.meta/workflow-plan.json');
    expect(state.parameters.workflowHash).toMatch(/^[a-f0-9]{64}$/);
    expect(state.parameters.packHash).toMatch(/^[a-f0-9]{64}$/);
    expect(state.parameters.artifactDagHash).toMatch(/^[a-f0-9]{64}$/);
    expect(state.parameters.runId).toMatch(/^[a-f0-9]{64}$/);
    expect(state.parameters.workflowHash).toBe(hashWorkflowValue(plan).value);
    expect(state.parameters.packHash).toBe(plan.source.pack.hash.value);
    expect(state.parameters.artifactDagHash).toBe(plan.source.artifactDag.hash.value);
  });

  it('rejects workflow plans with undeclared inputs', () => {
    fs.mkdirSync(path.join(tmpDir, '.boss'), { recursive: true });
    fs.writeFileSync(
      path.join(tmpDir, '.boss', 'artifact-dag.json'),
      JSON.stringify({
        version: '1.0.0',
        artifacts: {
          'prd.md': {
            inputs: ['missing-brief'],
            agent: 'boss-pm',
            stage: 1
          }
        }
      }, null, 2) + '\n',
      'utf8'
    );

    expect(() => runtime.initPipeline('workflow-feat', { cwd: tmpDir })).toThrow(/undeclared input/i);
  });

  it('rejects workflow plans with dynamic scripts', () => {
    fs.mkdirSync(path.join(tmpDir, '.boss'), { recursive: true });
    fs.writeFileSync(
      path.join(tmpDir, '.boss', 'artifact-dag.json'),
      JSON.stringify({
        version: '1.0.0',
        artifacts: {
          'prd.md': {
            inputs: [],
            agent: 'boss-pm',
            stage: 1,
            script: 'Date.now()'
          }
        }
      }, null, 2) + '\n',
      'utf8'
    );

    expect(() => runtime.initPipeline('workflow-feat', { cwd: tmpDir })).toThrow(/non-deterministic|Date\.now/i);
  });

  it('compiles project pipeline packs and custom DAGs through the same workflow plan path', () => {
    fs.mkdirSync(path.join(tmpDir, '.boss', 'pipeline-packs', 'custom'), { recursive: true });
    fs.writeFileSync(path.join(tmpDir, 'custom.marker'), 'yes\n', 'utf8');
    fs.writeFileSync(
      path.join(tmpDir, '.boss', 'custom-dag.json'),
      JSON.stringify({
        version: 'custom',
        artifacts: {
          'custom-input': {
            inputs: [],
            agent: null,
            stage: 0,
            optional: true
          },
          'custom-output.md': {
            inputs: ['custom-input'],
            agent: 'boss-pm',
            stage: 1
          }
        }
      }, null, 2) + '\n',
      'utf8'
    );
    fs.writeFileSync(
      path.join(tmpDir, '.boss', 'pipeline-packs', 'custom', 'pipeline.json'),
      JSON.stringify({
        name: 'custom',
        version: '1.0.0',
        type: 'pipeline-pack',
        priority: 100,
        when: { fileExists: ['custom.marker'] },
        config: {
          stages: [1],
          agents: ['boss-pm'],
          gates: [],
          artifactDag: '.boss/custom-dag.json'
        }
      }, null, 2) + '\n',
      'utf8'
    );

    const state = runtime.initPipeline('custom-feat', { cwd: tmpDir });
    const plan = readPlan('custom-feat');

    expect(state.parameters.pipelinePack).toBe('custom');
    expect(plan.source.pack.name).toBe('custom');
    expect(plan.source.artifactDag.hash.value).toBe(state.parameters.artifactDagHash);
    expect(plan.nodes.map((node) => node.artifact).filter(Boolean)).toEqual([
      'custom-input',
      'custom-output.md'
    ]);
  });

  it('exposes boss runtime resume with node-level reuse decisions', () => {
    const state = runtime.initPipeline('workflow-feat', { cwd: tmpDir });
    const runId = state.parameters.runId;
    expect(typeof runId).toBe('string');

    fs.writeFileSync(path.join(tmpDir, '.boss', 'workflow-feat', 'design-brief'), 'brief\n', 'utf8');
    runtime.updateAgent('workflow-feat', 1, 'boss-pm', 'completed', {
      cwd: tmpDir,
      prompt: 'boss-pm:prd.md',
      dependencyArtifacts: ['design-brief']
    });

    const result = runRuntimeCommand('resume', [
      'workflow-feat',
      '--from-run',
      runId as string,
      '--json'
    ]);
    expect(result.status, result.stderr).toBe(0);
    const payload = JSON.parse(result.stdout) as {
      feature: string;
      fromRunId: string;
      runId: string;
      workflowPlanPath: string;
      nodes: Array<{ id: string; decision: string; reason: string }>;
    };

    expect(payload.feature).toBe('workflow-feat');
    expect(payload.fromRunId).toBe(runId);
    expect(payload.runId).toBe(runId);
    expect(payload.workflowPlanPath).toBe('.boss/workflow-feat/.meta/workflow-plan.json');
    expect(payload.nodes.some((node) => node.id === 'artifact:prd.md' && node.decision === 'reuse')).toBe(true);
    expect(payload.nodes.some((node) => node.decision === 'run')).toBe(true);
  });
});
