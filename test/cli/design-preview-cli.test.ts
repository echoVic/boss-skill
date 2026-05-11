import { spawnSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { resolve } from 'node:path';

import { describe, expect, it } from 'vitest';

import { createCliContext } from '../../packages/boss-cli/src/cli/contract.js';
import { shouldKeepPreviewAlive } from '../../packages/boss-cli/src/commands/design/preview.js';
import { runCli } from '../helpers/run-cli.js';

const root = resolve(import.meta.dirname, '..', '..');
const distEntry = resolve(root, 'packages/boss-cli/dist/bin/boss.js');

function minimalUiDesign(feature: string) {
  return {
    schemaVersion: '1.0.0',
    artifact: 'ui-design',
    mode: 'wireframe',
    feature,
    updatedAt: '2026-05-11T10:00:00Z',
    tokens: { colors: {}, typography: {}, spacing: {}, radius: {} },
    pages: [
      {
        id: 'main',
        name: 'Main',
        route: '/',
        viewport: { width: 1440, height: 960 },
        frames: [
          { id: 'main-page', type: 'page', name: 'Main page', layout: 'vertical', children: [] }
        ],
        states: []
      }
    ],
    components: [],
    prototype: { startPageId: 'main', links: [] },
    implementationHints: {
      preferredFramework: 'react',
      requiredComponents: [],
      accessibilityNotes: []
    }
  };
}

function runPreview(args: string[], cwd: string) {
  return spawnSync(process.execPath, [distEntry, ...args], {
    cwd,
    encoding: 'utf8'
  });
}

describe('boss design preview CLI', () => {
  it('returns structured metadata with --describe', () => {
    const result = runCli(['packages/boss-cli/dist/bin/boss.js', 'design', 'preview', '--describe']);

    expect(result.status).toBe(0);
    const payload = JSON.parse(result.stdout) as {
      command: string;
      options: Array<{ name: string }>;
    };
    expect(payload.command).toBe('boss design preview');
    expect(payload.options.map((option) => option.name)).toEqual(expect.arrayContaining(['no-open', 'port']));
  });

  it('previews a valid ui-design artifact without opening the browser when requested', () => {
    const workspace = mkdtempSync(resolve(tmpdir(), 'boss-design-preview-'));
    const feature = 'checkout-flow';

    try {
      mkdirSync(resolve(workspace, '.boss', feature), { recursive: true });
      writeFileSync(
        resolve(workspace, '.boss', feature, 'ui-design.json'),
        `${JSON.stringify(minimalUiDesign(feature), null, 2)}\n`,
        'utf8'
      );

      const result = runPreview(['design', 'preview', feature, '--json', '--no-open', '--port', '0'], workspace);

      expect(result.status, result.stderr).toBe(0);
      const payload = JSON.parse(result.stdout) as {
        feature: string;
        artifact: string;
        url: string;
        mode: string;
        opened: boolean;
        valid: boolean;
        errors: string[];
      };
      expect(payload).toMatchObject({
        feature,
        artifact: `.boss/${feature}/ui-design.json`,
        mode: 'wireframe',
        opened: false,
        valid: true,
        errors: []
      });
      expect(payload.url).toMatch(/^http:\/\/localhost:\d+$/);
    } finally {
      rmSync(workspace, { recursive: true, force: true });
    }
  });

  it('returns a structured error when the ui-design artifact is missing', () => {
    const workspace = mkdtempSync(resolve(tmpdir(), 'boss-design-preview-missing-'));

    try {
      const result = runPreview(['design', 'preview', 'missing-feature', '--json', '--no-open'], workspace);

      expect(result.status).toBe(1);
      const payload = JSON.parse(result.stderr) as { error: { code: string } };
      expect(payload.error.code).toBe('ui_design_not_found');
    } finally {
      rmSync(workspace, { recursive: true, force: true });
    }
  });

  it('keeps interactive text previews alive after starting the server', () => {
    const interactiveContext = createCliContext([], {
      command: 'boss design preview',
      stdinIsTTY: true,
      stdoutIsTTY: true
    });
    const jsonContext = createCliContext(['--json'], {
      command: 'boss design preview',
      stdinIsTTY: true,
      stdoutIsTTY: true
    });

    expect(shouldKeepPreviewAlive(interactiveContext, { noOpen: false })).toBe(true);
    expect(shouldKeepPreviewAlive(interactiveContext, { noOpen: true })).toBe(false);
    expect(shouldKeepPreviewAlive(jsonContext, { noOpen: false })).toBe(false);
  });
});
