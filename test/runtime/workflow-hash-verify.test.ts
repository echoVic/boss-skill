import { spawnSync } from 'node:child_process';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import * as runtime from '../../packages/boss-cli/src/runtime/application/pipeline.js';
import {
  hashWorkflowValue,
  resumeWorkflow,
} from '../../packages/boss-cli/src/runtime/application/workflow.js';
import { ensureBuilt } from '../helpers/run-cli.js';

const BOSS_ENTRYPOINT = 'packages/boss-cli/dist/bin/boss.js';
const REPO_ROOT = path.resolve(import.meta.dirname, '..', '..');

/**
 * 恢复路径必须校验 workflow-plan.json 与当初落盘时的 workflowHash 一致。
 *
 * 计划在初始化时被编译并写盘，哈希存进 execution.parameters.workflowHash。
 * 如果恢复时不复算比对，被改过的计划（手工编辑、pipeline pack 变更后重写、
 * 文件损坏）会被当成原计划继续执行：节点集合、依赖、门禁都可能已经不同，
 * 而恢复结果看起来完全正常——这正是「下一步没有依据」的那类静默错误。
 */
describe('resumeWorkflow plan integrity', () => {
  let tmpDir: string;
  const feature = 'hash-feat';

  function planPath(): string {
    return path.join(tmpDir, '.boss', feature, '.meta', 'workflow-plan.json');
  }
  function executionPath(): string {
    return path.join(tmpDir, '.boss', feature, '.meta', 'execution.json');
  }
  function readExecution(): { parameters: Record<string, unknown> } {
    return JSON.parse(fs.readFileSync(executionPath(), 'utf8')) as {
      parameters: Record<string, unknown>;
    };
  }

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'boss-wf-hash-'));
    runtime.initPipeline(feature, { cwd: tmpDir });
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it('resumes normally when the persisted plan is untouched', () => {
    const runId = readExecution().parameters.runId as string;
    const result = resumeWorkflow(feature, { cwd: tmpDir, fromRunId: runId });

    expect(result.feature).toBe(feature);
    expect(result.nodes.length).toBeGreaterThan(0);
    // 返回的哈希应当就是当前计划文件的哈希，而不是一个未经核对的透传值
    const plan = JSON.parse(fs.readFileSync(planPath(), 'utf8')) as unknown;
    expect(result.workflowHash).toBe(hashWorkflowValue(plan).value);
  });

  it('refuses to resume when workflow-plan.json no longer matches its persisted hash', () => {
    const runId = readExecution().parameters.runId as string;
    const plan = JSON.parse(fs.readFileSync(planPath(), 'utf8')) as {
      nodes: Array<Record<string, unknown>>;
    };
    // 篡改计划：删掉一个节点，恢复时若不校验就会按残缺的计划继续调度
    plan.nodes = plan.nodes.slice(0, -1);
    fs.writeFileSync(planPath(), `${JSON.stringify(plan, null, 2)}\n`, 'utf8');

    expect(() => resumeWorkflow(feature, { cwd: tmpDir, fromRunId: runId })).toThrow(
      /workflow-plan\.json|计划.*不一致|workflowHash/i,
    );
  });

  it('names the plan path and both hashes so the mismatch is actionable', () => {
    const runId = readExecution().parameters.runId as string;
    const persistedHash = readExecution().parameters.workflowHash as string;
    const plan = JSON.parse(fs.readFileSync(planPath(), 'utf8')) as Record<string, unknown>;
    plan.schemaVersion = '9.9.9-tampered';
    fs.writeFileSync(planPath(), `${JSON.stringify(plan, null, 2)}\n`, 'utf8');

    let message = '';
    try {
      resumeWorkflow(feature, { cwd: tmpDir, fromRunId: runId });
    } catch (err) {
      message = (err as Error).message;
    }

    expect(message).toContain('.boss/hash-feat/.meta/workflow-plan.json');
    expect(message).toContain(persistedHash.slice(0, 12));
    expect(message).toContain(hashWorkflowValue(plan).value.slice(0, 12));
  });

  it('reports the mismatch as a typed CLI error, not internal_error', () => {
    // 面向 agent 的 CLI 契约要求结构化错误码；归到 internal_error 会让调用方无从判断该做什么
    ensureBuilt(BOSS_ENTRYPOINT);
    const runId = readExecution().parameters.runId as string;
    const plan = JSON.parse(fs.readFileSync(planPath(), 'utf8')) as {
      nodes: Array<Record<string, unknown>>;
    };
    plan.nodes = plan.nodes.slice(0, -1);
    fs.writeFileSync(planPath(), `${JSON.stringify(plan, null, 2)}\n`, 'utf8');

    const result = spawnSync(
      process.execPath,
      [
        path.join(REPO_ROOT, BOSS_ENTRYPOINT),
        'runtime',
        'resume',
        feature,
        '--from-run',
        runId,
        '--json',
      ],
      { cwd: tmpDir, encoding: 'utf8' },
    );

    expect(result.status).toBe(1);
    const payload = JSON.parse(result.stderr) as {
      error: { code: string; suggestion?: string; input?: Record<string, unknown> };
    };
    expect(payload.error.code).toBe('workflow_plan_mismatch');
    expect(payload.error.input?.path).toBe('.boss/hash-feat/.meta/workflow-plan.json');
    expect(payload.error.suggestion).toMatch(/workflow-plan\.json|init-pipeline/);
  });

  it('persists a hash that identifies the plan as written, even with absent optional fields', () => {
    // 回归：stableStringify 曾把值为 undefined 的键计入哈希，而写盘用的 JSON.stringify 会丢掉它们。
    // 于是只要 DAG 缺少可选字段（如 description），落盘哈希就不等于文件内容的哈希，
    // 这个哈希也就无法用来证明计划没被改过。
    const plan = {
      schemaVersion: '1.0.0',
      feature: 'x',
      nodes: [{ id: 'artifact:a.md', description: undefined, agent: null, inputs: [] }],
    };
    const roundTripped = JSON.parse(JSON.stringify(plan)) as unknown;
    expect(hashWorkflowValue(plan).value).toBe(hashWorkflowValue(roundTripped).value);
  });

  it('still resumes a run recorded before the hash was persisted', () => {
    // 旧版本创建的 run 没有 workflowHash，无从比对；应放行而不是把旧 feature 锁死
    const execution = readExecution();
    const runId = execution.parameters.runId as string;
    delete execution.parameters.workflowHash;
    fs.writeFileSync(executionPath(), `${JSON.stringify(execution, null, 2)}\n`, 'utf8');

    expect(() => resumeWorkflow(feature, { cwd: tmpDir, fromRunId: runId })).not.toThrow();
  });
});
