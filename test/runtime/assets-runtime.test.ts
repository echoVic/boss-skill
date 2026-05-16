import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import {
  listPipelinePackManifestPaths,
  listPluginManifestPaths,
  resolveArtifactDagPath,
  resolveBuiltInAssetPath,
  resolvePluginSchemaPath
} from '../../packages/boss-cli/src/runtime/assets.js';

const REPO_ROOT = path.resolve(import.meta.dirname, '..', '..');

describe('runtime asset resolver', () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'boss-assets-'));
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true, maxRetries: 5, retryDelay: 200 });
  });

  it('resolves built-in assets under packages/boss-cli/assets', () => {
    const dagPath = path.join(REPO_ROOT, 'packages', 'boss-cli', 'assets', 'artifact-dag.json');
    const schemaPath = path.join(REPO_ROOT, 'packages', 'boss-cli', 'assets', 'plugin-schema.json');

    expect(resolveBuiltInAssetPath('artifact-dag.json')).toBe(dagPath);
    expect(resolvePluginSchemaPath()).toBe(schemaPath);
    expect(fs.existsSync(dagPath)).toBe(true);
    expect(fs.existsSync(schemaPath)).toBe(true);
  });

  it('prefers project .boss artifact DAG over the built-in DAG', () => {
    fs.mkdirSync(path.join(tmpDir, '.boss'), { recursive: true });
    fs.writeFileSync(path.join(tmpDir, '.boss', 'artifact-dag.json'), '{"artifacts":{}}\n', 'utf8');

    expect(resolveArtifactDagPath({ cwd: tmpDir })).toBe(path.join(tmpDir, '.boss', 'artifact-dag.json'));
  });

  it('merges project pipeline packs over built-in packs by name', () => {
    const packDir = path.join(tmpDir, '.boss', 'pipeline-packs', 'api-only');
    fs.mkdirSync(packDir, { recursive: true });
    fs.writeFileSync(
      path.join(packDir, 'pipeline.json'),
      '{"name":"api-only","version":"9.9.9","type":"pipeline-pack","config":{}}\n',
      'utf8'
    );

    const paths = listPipelinePackManifestPaths({ cwd: tmpDir });
    const apiOnlyEntries = paths.filter((item) => item.name === 'api-only');
    expect(apiOnlyEntries).toHaveLength(1);
    expect(apiOnlyEntries[0]?.path).toBe(path.join(packDir, 'pipeline.json'));
  });

  it('merges project plugins over built-in plugins by name', () => {
    const pluginDir = path.join(tmpDir, '.boss', 'plugins', 'security-audit');
    fs.mkdirSync(pluginDir, { recursive: true });
    fs.writeFileSync(
      path.join(pluginDir, 'plugin.json'),
      '{"name":"security-audit","version":"9.9.9","type":"gate","hooks":{"gate":"gate.js"}}\n',
      'utf8'
    );
    fs.writeFileSync(path.join(pluginDir, 'gate.js'), '#!/usr/bin/env node\nprocess.exit(0)\n', 'utf8');

    const paths = listPluginManifestPaths({ cwd: tmpDir });
    const securityAuditEntries = paths.filter((item) => item.name === 'security-audit');
    expect(securityAuditEntries).toHaveLength(1);
    expect(securityAuditEntries[0]?.path).toBe(path.join(pluginDir, 'plugin.json'));
  });
});
