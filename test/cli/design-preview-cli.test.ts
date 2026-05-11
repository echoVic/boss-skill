import { spawn } from 'node:child_process';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { resolve } from 'node:path';

import { describe, expect, it } from 'vitest';

import { createCliContext } from '../../packages/boss-cli/src/cli/contract.js';
import {
  previewSignalExitCode,
  shouldKeepPreviewAlive
} from '../../packages/boss-cli/src/commands/design/preview.js';
import { ensureBuilt, runCli } from '../helpers/run-cli.js';

const root = resolve(import.meta.dirname, '..', '..');

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
  return runCli(['packages/boss-cli/dist/bin/boss.js', ...args], { cwd });
}

async function waitForExit(child: ReturnType<typeof spawn>): Promise<{ code: number | null; signal: NodeJS.Signals | null }> {
  return new Promise((resolveExit) => {
    child.once('exit', (code, signal) => resolveExit({ code, signal }));
  });
}

async function waitForPreviewUrl(child: ReturnType<typeof spawn>): Promise<string> {
  let output = '';
  return new Promise((resolveUrl, reject) => {
    const timeout = setTimeout(() => {
      reject(new Error(`Timed out waiting for preview URL. Output: ${output}`));
    }, 5000);

    child.stdout?.on('data', (chunk: Buffer) => {
      output += chunk.toString('utf8');
      const match = output.match(/http:\/\/localhost:\d+/);
      if (match) {
        clearTimeout(timeout);
        resolveUrl(match[0]!);
      }
    });
    child.once('error', (error) => {
      clearTimeout(timeout);
      reject(error);
    });
    child.once('exit', (code, signal) => {
      clearTimeout(timeout);
      reject(new Error(`Preview exited before URL. code=${code} signal=${signal} output=${output}`));
    });
  });
}

function spawnPreview(args: string[], cwd: string) {
  ensureBuilt('packages/boss-cli/dist/bin/boss.js');
  return spawn(process.execPath, [resolve(root, 'packages/boss-cli/dist/bin/boss.js'), ...args], {
    cwd,
    env: {
      ...process.env,
      BOSS_DESIGN_PREVIEW_FORCE_INTERACTIVE: '1'
    },
    stdio: ['ignore', 'pipe', 'pipe']
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

  it('returns validation output instead of internal errors for incomplete artifacts', () => {
    const workspace = mkdtempSync(resolve(tmpdir(), 'boss-design-preview-invalid-'));
    const feature = 'incomplete-design';

    try {
      mkdirSync(resolve(workspace, '.boss', feature), { recursive: true });
      writeFileSync(
        resolve(workspace, '.boss', feature, 'ui-design.json'),
        `${JSON.stringify({ artifact: 'ui-design', mode: 'wireframe', pages: [{ id: 'p', frames: [] }] })}\n`,
        'utf8'
      );

      const result = runPreview(['design', 'preview', feature, '--json', '--no-open'], workspace);

      expect(result.status, result.stderr).toBe(1);
      expect(result.stderr).toBe('');
      const payload = JSON.parse(result.stdout) as { valid: boolean; errors: string[] };
      expect(payload.valid).toBe(false);
      expect(payload.errors).toContain('page.viewport.width must be a number');
    } finally {
      rmSync(workspace, { recursive: true, force: true });
    }
  });

  it('rejects feature path traversal before resolving the artifact path', () => {
    const workspace = mkdtempSync(resolve(tmpdir(), 'boss-design-preview-traversal-'));

    try {
      const result = runPreview(['design', 'preview', '../escaped', '--json', '--no-open'], workspace);

      expect(result.status).toBe(1);
      const payload = JSON.parse(result.stderr) as { error: { code: string; input?: Record<string, unknown> } };
      expect(payload.error.code).toBe('invalid_feature');
      expect(payload.error.input).toEqual({ feature: '../escaped' });
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
    const nonInteractiveContext = createCliContext([], {
      command: 'boss design preview',
      stdinIsTTY: false,
      stdoutIsTTY: true
    });

    expect(shouldKeepPreviewAlive(interactiveContext, { noOpen: false }, {})).toBe(true);
    expect(shouldKeepPreviewAlive(interactiveContext, { noOpen: true }, {})).toBe(false);
    expect(shouldKeepPreviewAlive(jsonContext, { noOpen: false }, {})).toBe(false);
    expect(shouldKeepPreviewAlive(nonInteractiveContext, { noOpen: false }, {})).toBe(false);
    expect(shouldKeepPreviewAlive(interactiveContext, { noOpen: false }, { CI: 'true' })).toBe(false);
  });

  it('uses validation-derived exit codes when signal cleanup closes a live preview', () => {
    expect(previewSignalExitCode(true)).toBe(0);
    expect(previewSignalExitCode(false)).toBe(1);
  });

  it('keeps a forced-interactive preview process alive until SIGTERM', async () => {
    const workspace = mkdtempSync(resolve(tmpdir(), 'boss-design-preview-live-'));
    const feature = 'live-preview';
    let child: ReturnType<typeof spawn> | undefined;

    try {
      mkdirSync(resolve(workspace, '.boss', feature), { recursive: true });
      writeFileSync(
        resolve(workspace, '.boss', feature, 'ui-design.json'),
        `${JSON.stringify(minimalUiDesign(feature), null, 2)}\n`,
        'utf8'
      );

      child = spawnPreview(['design', 'preview', feature, '--port', '0'], workspace);
      const exitPromise = waitForExit(child);
      const url = await waitForPreviewUrl(child);

      const health = await fetch(`${url}/healthz`);
      expect(health.status).toBe(200);
      expect(await health.json()).toEqual({ ok: true });

      child.kill('SIGTERM');
      const exit = await exitPromise;
      expect(exit).toEqual({ code: 0, signal: null });
    } finally {
      if (child && child.exitCode === null && child.signalCode === null) {
        child.kill('SIGTERM');
        await waitForExit(child);
      }
      rmSync(workspace, { recursive: true, force: true });
    }
  });

  it('exits with validation failure status when an invalid live preview is terminated', async () => {
    const workspace = mkdtempSync(resolve(tmpdir(), 'boss-design-preview-live-invalid-'));
    const feature = 'invalid-live-preview';
    let child: ReturnType<typeof spawn> | undefined;

    try {
      mkdirSync(resolve(workspace, '.boss', feature), { recursive: true });
      writeFileSync(
        resolve(workspace, '.boss', feature, 'ui-design.json'),
        `${JSON.stringify({ artifact: 'ui-design', mode: 'wireframe', pages: [{ id: 'p', frames: [] }] })}\n`,
        'utf8'
      );

      child = spawnPreview(['design', 'preview', feature, '--port', '0'], workspace);
      const exitPromise = waitForExit(child);
      const url = await waitForPreviewUrl(child);

      const health = await fetch(`${url}/healthz`);
      expect(health.status).toBe(200);

      child.kill('SIGTERM');
      const exit = await exitPromise;
      expect(exit).toEqual({ code: 1, signal: null });
    } finally {
      if (child && child.exitCode === null && child.signalCode === null) {
        child.kill('SIGTERM');
        await waitForExit(child);
      }
      rmSync(workspace, { recursive: true, force: true });
    }
  });
});
