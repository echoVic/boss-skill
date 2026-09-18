import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { cleanupTempDir, createExecData, createTempBossDir } from '../helpers/fixtures.js';

describe('subagent-stop hook', () => {
  let hook: typeof import('../../scripts/hooks/subagent-stop.js');
  let tmpDir: string | null = null;

  beforeEach(async () => {
    vi.resetModules();
    hook = await import('../../scripts/hooks/subagent-stop.js');
  });

  afterEach(() => {
    if (tmpDir) {
      cleanupTempDir(tmpDir);
      tmpDir = null;
    }
  });

  it('writes log entry for active pipeline', () => {
    const execData = createExecData({ feature: 'test-feat', status: 'running' });
    tmpDir = createTempBossDir('test-feat', execData);

    hook.run(
      JSON.stringify({
        cwd: tmpDir,
        agent_type: 'code',
        agent_id: 'agent-123',
        last_assistant_message: 'Task completed successfully',
      }),
    );

    const logFile = path.join(tmpDir, '.boss', 'test-feat', '.meta', 'agent-log.jsonl');
    expect(fs.existsSync(logFile)).toBe(true);

    const entry = JSON.parse(fs.readFileSync(logFile, 'utf8').trim()) as {
      event: string;
      agentType: string;
      agentId: string;
    };

    expect(entry.event).toBe('stop');
    expect(entry.agentType).toBe('code');
    expect(entry.agentId).toBe('agent-123');
  });

  it('creates log dir when no active pipeline', () => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'boss-test-'));

    hook.run(
      JSON.stringify({
        cwd: tmpDir,
        agent_type: 'code',
        agent_id: 'agent-456',
        last_assistant_message: 'Done',
      }),
    );

    const logFile = path.join(tmpDir, '.boss', '.harness-logs', '.meta', 'agent-log.jsonl');
    expect(fs.existsSync(logFile)).toBe(true);
  });

  it('records the reported status for boss agents', () => {
    const execData = createExecData({
      feature: 'test-feat',
      status: 'running',
      stages: {
        '1': { name: 'Planning', status: 'completed', artifacts: [] },
        '2': { name: 'Review', status: 'running', artifacts: [] },
        '3': { name: 'Development', status: 'pending', artifacts: [] },
        '4': { name: 'Deployment', status: 'pending', artifacts: [] },
      },
    });
    tmpDir = createTempBossDir('test-feat', execData);

    hook.run(
      JSON.stringify({
        cwd: tmpDir,
        agent_type: 'boss-tech-lead',
        agent_id: 'agent-789',
        // 散文里写 DONE 不影响结果：状态只来自结构化字段
        last_assistant_message: 'DONE',
        structured_output: { status: 'BLOCKED', reason: 'waiting-for-schema' },
      }),
    );

    const execJson = JSON.parse(
      fs.readFileSync(path.join(tmpDir, '.boss', 'test-feat', '.meta', 'execution.json'), 'utf8'),
    ) as {
      stages: {
        '2': {
          agents: {
            'boss-tech-lead': { status: string; failureReason: string };
          };
        };
      };
    };
    expect(execJson.stages['2'].agents['boss-tech-lead'].status).toBe('failed');
    expect(execJson.stages['2'].agents['boss-tech-lead'].failureReason).toBe('waiting-for-schema');

    const logFile = path.join(tmpDir, '.boss', 'test-feat', '.meta', 'agent-log.jsonl');
    const entry = JSON.parse(fs.readFileSync(logFile, 'utf8').trim()) as {
      status: string;
      reason: string;
    };
    expect(entry.status).toBe('BLOCKED');
    expect(entry.reason).toBe('waiting-for-schema');
  });

  it('does not record any agent status when none was reported', () => {
    const execData = createExecData({
      feature: 'test-feat',
      status: 'running',
      stages: {
        '1': { name: 'Planning', status: 'completed', artifacts: [] },
        '2': { name: 'Review', status: 'running', artifacts: [] },
        '3': { name: 'Development', status: 'pending', artifacts: [] },
        '4': { name: 'Deployment', status: 'pending', artifacts: [] },
      },
    });
    tmpDir = createTempBossDir('test-feat', execData);

    hook.run(
      JSON.stringify({
        cwd: tmpDir,
        agent_type: 'boss-tech-lead',
        agent_id: 'agent-790',
        last_assistant_message: 'DONE',
      }),
    );

    const execJson = JSON.parse(
      fs.readFileSync(path.join(tmpDir, '.boss', 'test-feat', '.meta', 'execution.json'), 'utf8'),
    ) as {
      stages: {
        '2': {
          agents?: Record<string, { status: string }>;
        };
      };
    };

    // 缺失上报应表现为「没推进」而非「失败」：
    // 未按协议上报的执行不应被伪造成一个失败事件。
    expect(execJson.stages['2'].agents?.['boss-tech-lead']).toBeUndefined();
  });

  it('ignores unknown status values instead of inventing a failure reason', () => {
    const execData = createExecData({
      feature: 'test-feat',
      status: 'running',
      stages: {
        '1': { name: 'Planning', status: 'completed', artifacts: [] },
        '2': { name: 'Review', status: 'running', artifacts: [] },
        '3': { name: 'Development', status: 'pending', artifacts: [] },
        '4': { name: 'Deployment', status: 'pending', artifacts: [] },
      },
    });
    tmpDir = createTempBossDir('test-feat', execData);

    hook.run(
      JSON.stringify({
        cwd: tmpDir,
        agent_type: 'boss-tech-lead',
        agent_id: 'agent-791',
        structured_output: { status: 'ALL_GOOD', reason: 'ship it' },
      }),
    );

    const execJson = JSON.parse(
      fs.readFileSync(path.join(tmpDir, '.boss', 'test-feat', '.meta', 'execution.json'), 'utf8'),
    ) as {
      stages: {
        '2': {
          agents?: Record<string, { status: string }>;
        };
      };
    };

    // 非法枚举值由 report-agent-status 命令在工具层拒绝并要求重试，
    // hook 侧不接受、也不猜测。
    expect(execJson.stages['2'].agents?.['boss-tech-lead']).toBeUndefined();

    const logFile = path.join(tmpDir, '.boss', 'test-feat', '.meta', 'agent-log.jsonl');
    const entry = JSON.parse(fs.readFileSync(logFile, 'utf8').trim()) as {
      status: string;
      reason: string;
    };
    expect(entry.status).toBe('');
    expect(entry.reason).toBe('');
  });
});
