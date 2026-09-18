#!/usr/bin/env node

import { execSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const ROOT = path.resolve(path.dirname(__filename), '..');
const PROVENANCE_PATH = '.agents/plugins/provenance.json';

const MANIFEST_REFERENCES = [
  '.codex-plugin/plugin.json',
  '.codex-plugin/marketplace.json',
  '.claude-plugin/plugin.json',
  '.claude-plugin/marketplace.json',
  '.agents/plugins/marketplace.json',
];

const COMPONENT_REFERENCES = [
  'skill/SKILL.md',
  'skill/commands/boss.md',
  'skill/commands/boss-plan.md',
  'skill/commands/boss-review.md',
  'skill/commands/boss-qa.md',
  'skill/commands/boss-ship.md',
  'skill/commands/boss-extend.md',
  'skill/commands/boss-upgrade.md',
  'skill/hooks/codex/hooks.json',
  'skill/hooks/claude/hooks.json',
  'scripts/hooks/pre-tool-bash.js',
  'scripts/hooks/pre-tool-write.js',
  'scripts/hooks/post-tool-bash.js',
  'scripts/hooks/post-tool-write.js',
  'scripts/hooks/on-stop.js',
  'scripts/hooks/session-start.js',
  'scripts/hooks/session-end.js',
  'packages/boss-cli/assets/artifact-dag.json',
  'packages/boss-cli/assets/plugin-schema.json',
];

function readJson(relativePath) {
  return JSON.parse(fs.readFileSync(path.join(ROOT, relativePath), 'utf8'));
}

function git(args) {
  return execSync(`git ${args}`, { cwd: ROOT, encoding: 'utf8' }).trim();
}

function repositoryCommit() {
  return process.env.GITHUB_SHA || git('rev-parse HEAD');
}

function repositoryUrl(packageJson) {
  const raw =
    typeof packageJson.repository === 'string'
      ? packageJson.repository
      : packageJson.repository?.url;
  return String(raw || packageJson.homepage || '')
    .replace(/^git\+/, '')
    .replace(/\.git$/, '');
}

function sha256(relativePath) {
  const fullPath = path.join(ROOT, relativePath);
  const buffer = fs.readFileSync(fullPath);
  return {
    path: relativePath,
    sha256: createHash('sha256').update(buffer).digest('hex'),
    bytes: buffer.byteLength,
  };
}

function buildProvenance(options = {}) {
  const packageJson = readJson('package.json');
  const codexPlugin = readJson('.codex-plugin/plugin.json');
  const marketplace = readJson('.agents/plugins/marketplace.json');
  const repoUrl = repositoryUrl(packageJson);
  const commit = options.commit || repositoryCommit();

  return {
    schemaVersion: 1,
    plugin: {
      name: codexPlugin.name,
      version: packageJson.version,
      npmPackage: packageJson.name,
    },
    repository: {
      type: 'git',
      url: repoUrl,
      commit,
      commitUrl: `${repoUrl}/commit/${commit}`,
    },
    publisher: {
      name: codexPlugin.author?.name || packageJson.author?.name,
      email: codexPlugin.author?.email || packageJson.author?.email,
      url: codexPlugin.author?.url || packageJson.homepage,
      packageRegistry: packageJson.publishConfig?.registry || 'https://registry.npmjs.org/',
    },
    support: {
      url: packageJson.bugs?.url || packageJson.homepage,
      security: `${repoUrl}/security/advisories/new`,
    },
    marketplace: {
      name: marketplace.name,
      plugin:
        marketplace.plugins?.find((plugin) => plugin.name === codexPlugin.name)?.name ||
        codexPlugin.name,
    },
    manifests: MANIFEST_REFERENCES.map(sha256),
    components: COMPONENT_REFERENCES.map(sha256),
  };
}

function stableStringify(value) {
  return `${JSON.stringify(value, null, 2)}\n`;
}

function generate() {
  const output = stableStringify(buildProvenance());
  fs.mkdirSync(path.dirname(path.join(ROOT, PROVENANCE_PATH)), { recursive: true });
  fs.writeFileSync(path.join(ROOT, PROVENANCE_PATH), output, 'utf8');
  console.log(`Generated ${PROVENANCE_PATH}`);
}

function verify() {
  const actualText = fs.readFileSync(path.join(ROOT, PROVENANCE_PATH), 'utf8');
  const actual = JSON.parse(actualText);
  const commit = actual.repository?.commit;
  const commitUrl = actual.repository?.commitUrl;
  if (!/^[0-9a-f]{40}$/.test(String(commit || ''))) {
    console.error(`${PROVENANCE_PATH} repository.commit must be a 40-character SHA`);
    process.exit(1);
  }
  if (commitUrl !== `${actual.repository?.url}/commit/${commit}`) {
    console.error(
      `${PROVENANCE_PATH} repository.commitUrl must match repository.url and repository.commit`,
    );
    process.exit(1);
  }
  const expected = stableStringify(buildProvenance({ commit }));
  if (actualText !== expected) {
    console.error(`${PROVENANCE_PATH} is out of date. Run: npm run provenance:generate`);
    process.exit(1);
  }
  console.log(`${PROVENANCE_PATH} is current`);
}

const command = process.argv[2] || 'generate';
if (command === 'generate') {
  generate();
} else if (command === 'verify') {
  verify();
} else {
  console.error('Usage: node scripts/provenance.js <generate|verify>');
  process.exit(1);
}
