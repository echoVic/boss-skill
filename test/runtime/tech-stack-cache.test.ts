import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const REPO_ROOT = path.resolve(import.meta.dirname, '..', '..');

// Dynamic import of pipeline-runtime (ESM)
let pipelineRuntime: typeof import('../../src/runtime/cli/lib/pipeline-runtime.js');

beforeEach(async () => {
  pipelineRuntime = await import('../../src/runtime/cli/lib/pipeline-runtime.js');
});

describe('tech stack caching', () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'boss-techcache-'));
    // Create minimal .boss/<feature>/.meta/ structure
    const metaDir = path.join(tmpDir, '.boss', 'test-feat', '.meta');
    fs.mkdirSync(metaDir, { recursive: true });
    fs.writeFileSync(
      path.join(metaDir, 'execution.json'),
      JSON.stringify({ pipeline: 'test', stages: {} }, null, 2)
    );
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it('returns null when no cache exists', () => {
    const result = pipelineRuntime.readCachedTechStack('test-feat', { cwd: tmpDir });
    expect(result).toBeNull();
  });

  it('writes and reads tech stack cache', () => {
    const techStack = {
      language: 'TypeScript',
      framework: 'Next.js',
      testFramework: 'vitest',
      buildTool: 'Vite',
      deployEnv: 'Vercel',
      monorepo: null
    };
    pipelineRuntime.cacheTechStack('test-feat', techStack, { cwd: tmpDir });
    const cached = pipelineRuntime.readCachedTechStack('test-feat', { cwd: tmpDir });
    expect(cached).toEqual(techStack);
  });

  it('cache file is written to .meta/tech-stack.json', () => {
    pipelineRuntime.cacheTechStack('test-feat', { language: 'Go' }, { cwd: tmpDir });
    const filePath = path.join(tmpDir, '.boss', 'test-feat', '.meta', 'tech-stack.json');
    expect(fs.existsSync(filePath)).toBe(true);
  });

  it('overwrites existing cache on re-detect', () => {
    pipelineRuntime.cacheTechStack('test-feat', { language: 'Go' }, { cwd: tmpDir });
    pipelineRuntime.cacheTechStack('test-feat', { language: 'Rust' }, { cwd: tmpDir });
    const cached = pipelineRuntime.readCachedTechStack('test-feat', { cwd: tmpDir });
    expect(cached!.language).toBe('Rust');
  });
});
