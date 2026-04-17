import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

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
        last_assistant_message: 'Task completed successfully'
      })
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
        last_assistant_message: 'Done'
      })
    );

    const logFile = path.join(tmpDir, '.boss', '.harness-logs', '.meta', 'agent-log.jsonl');
    expect(fs.existsSync(logFile)).toBe(true);
  });

  it('requires structured boss status blocks for boss agents', () => {
    const execData = createExecData({
      feature: 'test-feat',
      status: 'running',
      stages: {
        '1': { name: 'Planning', status: 'completed', artifacts: [] },
        '2': { name: 'Review', status: 'running', artifacts: [] },
        '3': { name: 'Development', status: 'pending', artifacts: [] },
        '4': { name: 'Deployment', status: 'pending', artifacts: [] }
      }
    });
    tmpDir = createTempBossDir('test-feat', execData);

    hook.run(
      JSON.stringify({
        cwd: tmpDir,
        agent_type: 'boss-tech-lead',
        agent_id: 'agent-789',
        last_assistant_message: [
          'DONE',
          '[BOSS_STATUS]',
          'status: BLOCKED',
          'reason: waiting-for-schema',
          '[/BOSS_STATUS]'
        ].join('\n')
      })
    );

    const execJson = JSON.parse(
      fs.readFileSync(path.join(tmpDir, '.boss', 'test-feat', '.meta', 'execution.json'), 'utf8')
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

  it('treats missing structured status blocks as failed without fallback parsing', () => {
    const execData = createExecData({
      feature: 'test-feat',
      status: 'running',
      stages: {
        '1': { name: 'Planning', status: 'completed', artifacts: [] },
        '2': { name: 'Review', status: 'running', artifacts: [] },
        '3': { name: 'Development', status: 'pending', artifacts: [] },
        '4': { name: 'Deployment', status: 'pending', artifacts: [] }
      }
    });
    tmpDir = createTempBossDir('test-feat', execData);

    hook.run(
      JSON.stringify({
        cwd: tmpDir,
        agent_type: 'boss-tech-lead',
        agent_id: 'agent-790',
        last_assistant_message: 'DONE'
      })
    );

    const execJson = JSON.parse(
      fs.readFileSync(path.join(tmpDir, '.boss', 'test-feat', '.meta', 'execution.json'), 'utf8')
    ) as {
      stages: {
        '2': {
          agents: {
            'boss-tech-lead': { status: string };
          };
        };
      };
    };

    expect(execJson.stages['2'].agents['boss-tech-lead'].status).toBe('failed');
  });
});
