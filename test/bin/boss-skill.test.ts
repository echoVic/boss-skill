import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  copyFileSync,
  existsSync,
  mkdirSync,
  readFileSync,
  renameSync,
  rmSync
} from 'node:fs';
import { dirname, resolve } from 'node:path';
import { runCli } from '../helpers/run-cli.js';

const root = resolve(import.meta.dirname, '..', '..');
const pkg = JSON.parse(readFileSync(resolve(root, 'package.json'), 'utf8'));
const distEntry = resolve(root, 'dist/bin/boss-skill.js');
const distEntryBackup = resolve(root, 'dist/bin/boss-skill.js.bak');

afterEach(() => {
  vi.restoreAllMocks();

  if (existsSync(distEntryBackup)) {
    mkdirSync(dirname(distEntry), { recursive: true });
    if (existsSync(distEntry)) {
      rmSync(distEntry);
    }
    renameSync(distEntryBackup, distEntry);
  }
});

describe('boss-skill dist bin', () => {
  it('uses dist/bin/boss-skill.js as the published entrypoint', () => {
    expect(pkg.type).toBe('module');
    expect(pkg.bin['boss-skill']).toBe('dist/bin/boss-skill.js');
    expect(pkg.engines.node).toBe('>=20');
    expect(pkg.files).not.toContain('dist/');
  });

  it('prints help from the built dist entrypoint', () => {
    const result = runCli(['dist/bin/boss-skill.js', '--help']);
    expect(result.status).toBe(0);
    expect(result.stdout).toContain('Usage:');
    expect(result.stdout).toContain('boss-skill install');
  });

  it('rebuilds the dist entrypoint on demand before running the CLI', () => {
    copyFileSync(distEntry, distEntryBackup);
    rmSync(distEntry);

    const result = runCli(['dist/bin/boss-skill.js', '--help']);

    expect(result.status).toBe(0);
    expect(result.stdout).toContain('Usage:');
    expect(existsSync(distEntry)).toBe(true);
  });

  it('does not run main() when the source module is imported', async () => {
    const writeSpy = vi
      .spyOn(process.stdout, 'write')
      .mockImplementation(() => true);

    vi.resetModules();
    const mod = await import('../../src/bin/boss-skill.js');

    expect(writeSpy).not.toHaveBeenCalled();
    expect(typeof mod.main).toBe('function');
    expect(typeof mod.showHelp).toBe('function');
  });
});
