import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { execSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const RECORD_FEEDBACK_SCRIPT = path.join(import.meta.dirname, '..', '..', 'scripts', 'harness', 'record-feedback.sh');
const MATERIALIZE_SCRIPT = path.join(import.meta.dirname, '..', '..', 'scripts', 'harness', 'materialize-state.sh');

function getExecError(error: unknown) {
  return error as Error & { status?: number; stdout?: string; stderr?: string };
}

describe('feedback-loops', () => {
  let tmpDir: string;
  let origCwd: string;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'boss-feedback-'));
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
      parameters: {},
      stages: {
        '1': { name: 'planning', status: 'completed', startTime: null, endTime: null, retryCount: 0, maxRetries: 2, failureReason: null, artifacts: ['prd.md', 'architecture.md'], gateResults: {} },
        '2': { name: 'review', status: 'running', startTime: null, endTime: null, retryCount: 0, maxRetries: 2, failureReason: null, artifacts: [], gateResults: {} },
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
    fs.writeFileSync(
      path.join(metaDir, 'events.jsonl'),
      `${JSON.stringify({
        id: 1,
        type: 'PipelineInitialized',
        timestamp: '2024-01-01T00:00:00Z',
        data: { initialState: initState }
      })}\n`,
      'utf8'
    );
  });

  afterEach(() => {
    process.chdir(origCwd);
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  function runScript(args: string) {
    try {
      return execSync(`bash "${RECORD_FEEDBACK_SCRIPT}" ${args}`, {
        encoding: 'utf8',
        cwd: tmpDir,
        env: { ...process.env, PATH: process.env.PATH }
      }).trim();
    } catch (error) {
      const execError = getExecError(error);
      if (execError.status !== 0) {
        throw new Error(execError.stderr || execError.message);
      }
      return execError.stdout ? String(execError.stdout).trim() : '';
    }
  }

  function readExecJson() {
    return JSON.parse(
      fs.readFileSync(path.join(tmpDir, '.boss', 'test-feat', '.meta', 'execution.json'), 'utf8')
    ) as {
      feedbackLoops: { currentRound: number };
      revisionRequests: Array<{
        from: string;
        to: string;
        artifact: string;
        resolved: boolean;
        priority?: string;
      }>;
    };
  }

  it('records a revision request and increments round', () => {
    runScript('test-feat --from boss-tech-lead --to boss-architect --artifact architecture.md --reason "缺少缓存策略"');

    const exec = readExecJson();
    expect(exec.feedbackLoops.currentRound).toBe(1);
    expect(exec.revisionRequests).toHaveLength(1);
    expect(exec.revisionRequests[0]?.from).toBe('boss-tech-lead');
    expect(exec.revisionRequests[0]?.to).toBe('boss-architect');
    expect(exec.revisionRequests[0]?.artifact).toBe('architecture.md');
    expect(exec.revisionRequests[0]?.resolved).toBe(false);
  });

  it('allows second round', () => {
    runScript('test-feat --from boss-tech-lead --to boss-architect --artifact architecture.md --reason "round 1"');
    runScript('test-feat --from boss-qa --to boss-backend --artifact code --reason "round 2"');

    const exec = readExecJson();
    expect(exec.feedbackLoops.currentRound).toBe(2);
    expect(exec.revisionRequests).toHaveLength(2);
  });

  it('rejects when max rounds reached', () => {
    runScript('test-feat --from boss-tech-lead --to boss-architect --artifact architecture.md --reason "round 1"');
    runScript('test-feat --from boss-qa --to boss-backend --artifact code --reason "round 2"');

    expect(() => {
      runScript('test-feat --from boss-qa --to boss-frontend --artifact code --reason "round 3"');
    }).toThrow(/已达上限/);
  });

  it('records priority field', () => {
    runScript('test-feat --from boss-tech-lead --to boss-architect --artifact architecture.md --reason "安全问题" --priority critical');

    const exec = readExecJson();
    expect(exec.revisionRequests[0]?.priority).toBe('critical');
  });

  it('appends event to events.jsonl', () => {
    runScript('test-feat --from boss-tech-lead --to boss-architect --artifact architecture.md --reason "test"');

    const lines = fs
      .readFileSync(path.join(tmpDir, '.boss', 'test-feat', '.meta', 'events.jsonl'), 'utf8')
      .trim()
      .split('\n');
    expect(lines.length).toBeGreaterThanOrEqual(2);

    const lastEvent = JSON.parse(lines[lines.length - 1] ?? '{}') as {
      type: string;
      data: { from: string; to: string };
    };
    expect(lastEvent.type).toBe('RevisionRequested');
    expect(lastEvent.data.from).toBe('boss-tech-lead');
    expect(lastEvent.data.to).toBe('boss-architect');
  });

  it('rebuilds revision requests from events', () => {
    runScript('test-feat --from boss-tech-lead --to boss-architect --artifact architecture.md --reason "test" --priority critical');
    runScript('test-feat --from boss-qa --to boss-backend --artifact code --reason "round 2"');

    execSync(`bash "${MATERIALIZE_SCRIPT}" test-feat`, {
      encoding: 'utf8',
      cwd: tmpDir,
      env: { ...process.env, PATH: process.env.PATH }
    });

    const exec = readExecJson();
    expect(exec.feedbackLoops.currentRound).toBe(2);
    expect(exec.revisionRequests).toHaveLength(2);
    expect(exec.revisionRequests[0]?.priority).toBe('critical');
    expect(exec.revisionRequests[1]?.to).toBe('boss-backend');
  });

  it('requires all mandatory parameters', () => {
    expect(() => {
      runScript('test-feat --from boss-tech-lead --to boss-architect --artifact architecture.md');
    }).toThrow(/缺少 --reason/);
  });
});
