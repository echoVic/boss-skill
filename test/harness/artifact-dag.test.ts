import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const GET_READY_ARTIFACTS_CLI = path.join(import.meta.dirname, '..', '..', 'runtime', 'cli', 'get-ready-artifacts.js');
const DAG_PATH = path.join(import.meta.dirname, '..', '..', 'harness', 'artifact-dag.json');

function getExecFileError(error: unknown) {
  return error as Error & { status?: number; stdout?: string; stderr?: string };
}

describe('artifact-dag', () => {
  let tmpDir: string;
  let origCwd: string;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'boss-dag-'));
    origCwd = process.cwd();
    process.chdir(tmpDir);

    const metaDir = path.join(tmpDir, '.boss', 'test-feat', '.meta');
    fs.mkdirSync(metaDir, { recursive: true });

    const initState = {
      schemaVersion: '0.2.0',
      feature: 'test-feat',
      createdAt: '2024-01-01T00:00:00Z',
      updatedAt: '2024-01-01T00:00:00Z',
      status: 'running',
      parameters: { skipUI: false, skipDeploy: false },
      stages: {
        '1': { name: 'planning', status: 'pending', startTime: null, endTime: null, retryCount: 0, maxRetries: 2, failureReason: null, artifacts: [], gateResults: {} },
        '2': { name: 'review', status: 'pending', startTime: null, endTime: null, retryCount: 0, maxRetries: 2, failureReason: null, artifacts: [], gateResults: {} },
        '3': { name: 'development', status: 'pending', startTime: null, endTime: null, retryCount: 0, maxRetries: 2, failureReason: null, artifacts: [], gateResults: {} },
        '4': { name: 'deployment', status: 'pending', startTime: null, endTime: null, retryCount: 0, maxRetries: 2, failureReason: null, artifacts: [], gateResults: {} }
      },
      qualityGates: {
        gate0: { status: 'pending', passed: null, checks: [], executedAt: null },
        gate1: { status: 'pending', passed: null, checks: [], executedAt: null },
        gate2: { status: 'pending', passed: null, checks: [], executedAt: null }
      },
      metrics: { totalDuration: null, stageTimings: {}, gatePassRate: null, retryTotal: 0 },
      plugins: [],
      humanInterventions: [],
      revisionRequests: [],
      feedbackLoops: { maxRounds: 2, currentRound: 0 }
    };

    fs.writeFileSync(path.join(metaDir, 'execution.json'), JSON.stringify(initState, null, 2), 'utf8');
  });

  afterEach(() => {
    process.chdir(origCwd);
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  function runCli(args: string[]) {
    try {
      return execFileSync(process.execPath, [GET_READY_ARTIFACTS_CLI, ...args], {
        encoding: 'utf8',
        cwd: tmpDir,
        env: { ...process.env, PATH: process.env.PATH }
      }).trim();
    } catch (error) {
      const execError = getExecFileError(error);
      if (execError.status !== 0) {
        throw new Error(execError.stderr || execError.message);
      }
      return execError.stdout ? String(execError.stdout).trim() : '';
    }
  }

  it('DAG file is valid JSON with expected structure', () => {
    const dag = JSON.parse(fs.readFileSync(DAG_PATH, 'utf8')) as {
      artifacts: Record<string, { inputs?: string[] }>;
    };

    expect(dag.artifacts).toBeTruthy();
    expect(dag.artifacts['prd.md']).toBeTruthy();
    expect(dag.artifacts['architecture.md']).toBeTruthy();
    expect(dag.artifacts['qa-report.md']).toBeTruthy();
    expect(dag.artifacts['prd.md']?.inputs).toEqual(['design-brief']);
    expect(dag.artifacts['architecture.md']?.inputs).toEqual(['prd.md']);
  });

  it('qa-report.md depends on both code and prd.md', () => {
    const dag = JSON.parse(fs.readFileSync(DAG_PATH, 'utf8')) as {
      artifacts: Record<string, { inputs?: string[] }>;
    };

    expect(dag.artifacts['qa-report.md']?.inputs).toContain('code');
    expect(dag.artifacts['qa-report.md']?.inputs).toContain('prd.md');
  });

  it('detects no circular dependencies in default DAG', () => {
    const dag = JSON.parse(fs.readFileSync(DAG_PATH, 'utf8')) as {
      artifacts: Record<string, { inputs?: string[] }>;
    };
    const visited = new Set<string>();
    const visiting = new Set<string>();

    function visit(name: string): boolean {
      if (visiting.has(name)) return false;
      if (visited.has(name)) return true;

      visiting.add(name);
      const def = dag.artifacts[name];
      if (def?.inputs) {
        for (const input of def.inputs) {
          if (dag.artifacts[input] && !visit(input)) {
            return false;
          }
        }
      }
      visiting.delete(name);
      visited.add(name);
      return true;
    }

    for (const name of Object.keys(dag.artifacts)) {
      expect(visit(name), `Circular dependency detected involving ${name}`).toBe(true);
    }
  });

  it('--ready returns prd.md initially (design-brief is optional)', () => {
    const ready = JSON.parse(runCli(['test-feat', '--ready', '--dag', DAG_PATH, '--json'])) as string[];
    expect(ready).toContain('prd.md');
  });

  it('--ready returns architecture.md and ui-spec.md after prd.md done', () => {
    const execPath = path.join(tmpDir, '.boss', 'test-feat', '.meta', 'execution.json');
    const data = JSON.parse(fs.readFileSync(execPath, 'utf8')) as {
      stages: { '1': { artifacts: string[] } };
    };
    data.stages['1'].artifacts = ['prd.md'];
    fs.writeFileSync(execPath, JSON.stringify(data, null, 2), 'utf8');

    const ready = JSON.parse(runCli(['test-feat', '--ready', '--dag', DAG_PATH, '--json'])) as string[];
    expect(ready).toContain('architecture.md');
    expect(ready).toContain('ui-spec.md');
    expect(ready).not.toContain('prd.md');
  });

  it('--can-start checks dependency satisfaction', () => {
    expect(() => {
      runCli(['test-feat', 'architecture.md', '--can-start', '--dag', DAG_PATH]);
    }).toThrow(/缺少依赖/);
  });

  it('--can-start succeeds when dependencies are met', () => {
    const execPath = path.join(tmpDir, '.boss', 'test-feat', '.meta', 'execution.json');
    const data = JSON.parse(fs.readFileSync(execPath, 'utf8')) as {
      stages: { '1': { artifacts: string[] } };
    };
    data.stages['1'].artifacts = ['prd.md'];
    fs.writeFileSync(execPath, JSON.stringify(data, null, 2), 'utf8');

    expect(runCli(['test-feat', 'architecture.md', '--can-start', '--dag', DAG_PATH])).toContain('可以开始');
  });

  it('skips ui-spec.md when skipUI is true', () => {
    const execPath = path.join(tmpDir, '.boss', 'test-feat', '.meta', 'execution.json');
    const data = JSON.parse(fs.readFileSync(execPath, 'utf8')) as {
      parameters: { skipUI: boolean };
      stages: { '1': { artifacts: string[] } };
    };
    data.parameters.skipUI = true;
    data.stages['1'].artifacts = ['prd.md'];
    fs.writeFileSync(execPath, JSON.stringify(data, null, 2), 'utf8');

    const ready = JSON.parse(runCli(['test-feat', '--ready', '--dag', DAG_PATH, '--json'])) as string[];
    expect(ready).not.toContain('ui-spec.md');
    expect(ready).toContain('architecture.md');
  });

  it('skips tech-review.md and tasks.md when skipReview is true', () => {
    const execPath = path.join(tmpDir, '.boss', 'test-feat', '.meta', 'execution.json');
    const data = JSON.parse(fs.readFileSync(execPath, 'utf8')) as {
      parameters: { skipUI: boolean; skipReview?: boolean };
      stages: { '1': { artifacts: string[] } };
    };
    data.parameters.skipReview = true;
    data.stages['1'].artifacts = ['prd.md', 'architecture.md'];
    fs.writeFileSync(execPath, JSON.stringify(data, null, 2), 'utf8');

    const ready = JSON.parse(runCli(['test-feat', '--ready', '--dag', DAG_PATH, '--json'])) as string[];
    expect(ready).not.toContain('tech-review.md');
    expect(ready).not.toContain('tasks.md');
    expect(ready).toContain('code');
  });

  it('DAG contains gate entries with type "gate"', () => {
    const dag = JSON.parse(fs.readFileSync(DAG_PATH, 'utf8')) as {
      artifacts: Record<string, { type?: string; agent?: string | null; stage?: number; script?: string }>;
    };
    const gateEntries = Object.entries(dag.artifacts)
      .filter(([, def]) => def.type === 'gate');
    expect(gateEntries.length).toBeGreaterThanOrEqual(3);
    for (const [, def] of gateEntries) {
      expect(def.type).toBe('gate');
      expect(def.agent).toBeNull();
      expect(typeof def.stage).toBe('number');
      expect(typeof def.script).toBe('string');
    }
  });

  it('gate entries are not returned by --ready', () => {
    // Mark all stage 3 prerequisites as done so gates would theoretically be "ready"
    const execPath = path.join(tmpDir, '.boss', 'test-feat', '.meta', 'execution.json');
    const data = JSON.parse(fs.readFileSync(execPath, 'utf8')) as {
      parameters: { skipUI: boolean; skipReview?: boolean };
      stages: Record<string, { artifacts: string[] }>;
    };
    data.parameters.skipReview = true;
    data.stages['1'].artifacts = ['prd.md', 'architecture.md'];
    data.stages['3'] = { ...data.stages['3'], artifacts: ['code'] };
    fs.writeFileSync(execPath, JSON.stringify(data, null, 2), 'utf8');

    const ready = JSON.parse(runCli(['test-feat', '--ready', '--dag', DAG_PATH, '--json'])) as string[];
    const gateNames = ready.filter((name: string) => name.startsWith('gate'));
    expect(gateNames).toEqual([]);
  });
});
