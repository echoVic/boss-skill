import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

type StageState = {
  name: string;
  status: string;
  artifacts: string[];
};

type ExecData = {
  feature: string;
  status: string;
  version: string;
  createdAt?: string;
  stages: Record<string, StageState>;
} & Record<string, unknown>;

function createTempBossDir(feature: string, execData?: ExecData | null) {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'boss-test-'));
  const metaDir = path.join(tmpDir, '.boss', feature, '.meta');
  fs.mkdirSync(metaDir, { recursive: true });

  if (execData) {
    fs.writeFileSync(
      path.join(metaDir, 'execution.json'),
      `${JSON.stringify(execData, null, 2)}\n`,
      'utf8'
    );
    const timestamp = typeof execData.createdAt === 'string' ? execData.createdAt : '2024-01-01T00:00:00Z';
    fs.writeFileSync(
      path.join(metaDir, 'events.jsonl'),
      `${JSON.stringify({
        id: 1,
        type: 'PipelineInitialized',
        timestamp,
        data: { initialState: execData }
      })}\n`,
      'utf8'
    );
  }

  return tmpDir;
}

function createExecData(overrides: Record<string, unknown> = {}) {
  return {
    feature: 'test-feature',
    status: 'running',
    version: '3.2.0',
    stages: {
      '1': { name: 'Planning', status: 'completed', artifacts: [] },
      '2': { name: 'Review', status: 'running', artifacts: [] },
      '3': { name: 'Development', status: 'pending', artifacts: [] },
      '4': { name: 'Deployment', status: 'pending', artifacts: [] }
    },
    ...overrides
  };
}

function cleanupTempDir(dir: string) {
  fs.rmSync(dir, { recursive: true, force: true });
}

export { cleanupTempDir, createExecData, createTempBossDir };
