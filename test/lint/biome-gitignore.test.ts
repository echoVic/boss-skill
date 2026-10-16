import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';

const ROOT = path.resolve(import.meta.dirname, '..', '..');
const BIOME = path.resolve(ROOT, 'node_modules/.bin/biome');
const PROBE_DIR = path.join(ROOT, '.boss/__biome_ignore_probe__');
const PROBE = path.join(PROBE_DIR, '.meta/execution.json');
const FIXTURE = path.join(
  ROOT,
  'test/evals/fixtures/missing-qa/workspace/.boss/todo-app/.meta/execution.json',
);
const UNFORMATTED = '{\n  "enabledStages": [\n    1,\n    2\n  ]\n}\n';

function runBiome(args: string[]) {
  return spawnSync(BIOME, args, {
    cwd: ROOT,
    encoding: 'utf8',
    env: { ...process.env, NO_COLOR: '1' },
  });
}

function output(result: ReturnType<typeof runBiome>): string {
  return `${result.stdout ?? ''}\n${result.stderr ?? ''}`;
}

describe('biome gitignore integration', () => {
  afterEach(() => {
    fs.rmSync(PROBE_DIR, { recursive: true, force: true });
  });

  it('ignores a local .boss workspace and still checks committed fixtures', () => {
    const config = JSON.parse(fs.readFileSync(path.join(ROOT, 'biome.json'), 'utf8')) as {
      vcs?: { enabled?: boolean; clientKind?: string; useIgnoreFile?: boolean };
    };
    // useIgnoreFile alone does not enable gitignore; clientKind is required too.
    expect(config.vcs).toEqual({
      enabled: true,
      clientKind: 'git',
      useIgnoreFile: true,
    });

    fs.mkdirSync(path.dirname(PROBE), { recursive: true });
    fs.writeFileSync(PROBE, UNFORMATTED);

    const ignored = runBiome(['ci', PROBE]);
    const ignoredOutput = output(ignored);
    expect(ignored.status, ignoredOutput).not.toBe(0);
    expect(ignoredOutput).toContain('ignored');
    expect(ignoredOutput).not.toContain('format');

    const fixed = runBiome(['check', '--fix', PROBE]);
    expect(output(fixed)).toContain('ignored');
    expect(fs.readFileSync(PROBE, 'utf8')).toBe(UNFORMATTED);

    const fixture = runBiome(['ci', FIXTURE]);
    const fixtureOutput = output(fixture);
    expect(fixture.status, fixtureOutput).toBe(0);
    expect(fixtureOutput).toMatch(/Checked 1 file/);

    const repo = runBiome(['ci']);
    const repoOutput = output(repo);
    expect(repo.status, repoOutput).toBe(0);
    expect(repoOutput).not.toContain('__biome_ignore_probe__');
  });
});
