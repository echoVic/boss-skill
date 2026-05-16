import { afterEach, describe, expect, it } from 'vitest';
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { ensureBuilt } from '../helpers/run-cli.js';
import { cleanupTempDir } from '../helpers/fixtures.js';

const REPO_ROOT = path.resolve(import.meta.dirname, '..', '..');
const BOSS_BIN = path.join(REPO_ROOT, 'packages', 'boss-cli', 'dist', 'bin', 'boss.js');

const COPY_TARGETS = [
  { agent: 'Codex', marker: ['.codex'], installPath: ['.codex', 'skills', 'boss'], metadata: 'codex:' },
  { agent: 'Hermes', marker: ['.hermes'], installPath: ['.hermes', 'skills', 'boss'], metadata: 'hermes:' },
  { agent: 'OpenClaw', marker: ['.openclaw'], installPath: ['.openclaw', 'skills', 'boss'], metadata: 'openclaw:' },
  {
    agent: 'Antigravity',
    marker: ['.gemini', 'antigravity'],
    installPath: ['.gemini', 'antigravity', 'skills', 'boss'],
    metadata: 'antigravity:'
  }
] as const;

const REPRESENTATIVE_BUNDLE_FILES = [
  'SKILL.md',
  'agents/boss-pm.md',
  'agents/boss-qa.md',
  'commands/boss.md',
  'hooks/hooks.json',
  'templates/prd.md.template',
  'skills/README.md',
  'skills/brainstorming/SKILL.md',
  'skills/pm/requirement-penetration/SKILL.md',
  'skills/architect/architecture-design/SKILL.md',
  'skills/backend/testing-guide/SKILL.md',
  'skills/frontend/testing-guide/SKILL.md',
  'skills/qa/test-strategy/SKILL.md',
  'skills/shared/tech-stack-detection/SKILL.md'
] as const;

const REQUIRED_PACKED_FILES = [
  'package.json',
  'packages/boss-cli/dist/bin/boss.js',
  'packages/boss-cli/assets/artifact-dag.json',
  'packages/boss-cli/src/runtime/schema/execution-schema.json',
  'skill/SKILL.md',
  'skill/skills/README.md',
  'skill/skills/pm/requirement-penetration/SKILL.md',
  'skill/skills/qa/test-strategy/SKILL.md',
  '.claude-plugin/plugin.json',
  '.claude-plugin/marketplace.json',
  'scripts/hooks/subagent-stop.js'
] as const;

describe('Boss install matrix', () => {
  const tmpDirs: string[] = [];

  afterEach(() => {
    for (const tmpDir of tmpDirs.splice(0)) {
      cleanupTempDir(tmpDir);
    }
  });

  function makeHome(): string {
    const home = fs.mkdtempSync(path.join(os.tmpdir(), 'boss-install-matrix-'));
    tmpDirs.push(home);
    return home;
  }

  it.each(COPY_TARGETS)('copy-installs the full skill bundle for $agent', (target) => {
    ensureBuilt('packages/boss-cli/dist/bin/boss.js');
    const home = makeHome();
    fs.mkdirSync(path.join(home, ...target.marker), { recursive: true });

    const result = spawnSync(process.execPath, [BOSS_BIN, 'install', '--json'], {
      cwd: REPO_ROOT,
      env: { ...process.env, HOME: home },
      encoding: 'utf8'
    });

    expect(result.status, result.stderr).toBe(0);
    const payload = JSON.parse(result.stdout) as { actions: Array<{ agent: string; type: string }> };
    expect(payload.actions).toContainEqual(expect.objectContaining({ agent: target.agent, type: 'install_skill' }));

    const installed = path.join(home, ...target.installPath);
    for (const relativePath of REPRESENTATIVE_BUNDLE_FILES) {
      expect(fs.existsSync(path.join(installed, relativePath)), `${target.agent} missing ${relativePath}`).toBe(true);
    }

    const skill = fs.readFileSync(path.join(installed, 'SKILL.md'), 'utf8');
    expect(skill).toContain(target.metadata);
    expect(fs.existsSync(path.join(installed, 'package.json'))).toBe(false);
    expect(fs.existsSync(path.join(installed, 'packages'))).toBe(false);
    expect(fs.existsSync(path.join(installed, '.claude-plugin'))).toBe(false);
  });

  it('Claude plugin declares the main skill and methodology skill roots', () => {
    const plugin = JSON.parse(
      fs.readFileSync(path.join(REPO_ROOT, '.claude-plugin', 'plugin.json'), 'utf8')
    ) as { skills: string[] };

    expect(plugin.skills).toContain('./skill/');
    expect(plugin.skills).toContain('./skill/skills/');
  });

  it('npm dry-run pack includes release-critical runtime, skill, and plugin files', () => {
    ensureBuilt('packages/boss-cli/dist/bin/boss.js');

    const result = spawnSync('npm', ['pack', '--json', '--dry-run'], {
      cwd: REPO_ROOT,
      encoding: 'utf8'
    });

    expect(result.status, result.stderr).toBe(0);
    const payload = JSON.parse(result.stdout) as Array<{ files: Array<{ path: string }> }>;
    const packedFiles = new Set(payload[0]?.files.map((file) => file.path) ?? []);

    for (const file of REQUIRED_PACKED_FILES) {
      expect(packedFiles.has(file), `npm package missing ${file}`).toBe(true);
    }
  });
});
