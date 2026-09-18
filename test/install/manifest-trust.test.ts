import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const REPO_ROOT = path.resolve(import.meta.dirname, '..', '..');
const MANIFEST_PATH = path.join(REPO_ROOT, '.codex-plugin', 'plugin.json');

function readManifest(): { interface?: Record<string, unknown> } {
  return JSON.parse(fs.readFileSync(MANIFEST_PATH, 'utf8')) as {
    interface?: Record<string, unknown>;
  };
}

function isHttpsUrl(value: unknown): value is string {
  return typeof value === 'string' && value.startsWith('https://');
}

function isSafeExistingAsset(value: unknown): value is string {
  if (typeof value !== 'string') return false;
  if (!value.startsWith('./')) return false;
  const resolved = path.resolve(REPO_ROOT, value);
  if (!resolved.startsWith(REPO_ROOT + path.sep)) return false;
  return fs.existsSync(resolved);
}

describe('Codex plugin trust metadata', () => {
  it('declares scanner-valid interface URLs and in-repo assets', () => {
    const manifest = readManifest();
    const pluginInterface = manifest.interface;

    expect(pluginInterface).toBeDefined();
    expect(isHttpsUrl(pluginInterface?.privacyPolicyURL)).toBe(true);
    expect(isHttpsUrl(pluginInterface?.termsOfServiceURL)).toBe(true);
    expect(isSafeExistingAsset(pluginInterface?.composerIcon)).toBe(true);
    expect(isSafeExistingAsset(pluginInterface?.logo)).toBe(true);

    const screenshots = pluginInterface?.screenshots;
    expect(Array.isArray(screenshots)).toBe(true);
    expect((screenshots as unknown[]).length).toBeGreaterThan(0);
    for (const screenshot of screenshots as unknown[]) {
      expect(isSafeExistingAsset(screenshot)).toBe(true);
    }
  });
});
