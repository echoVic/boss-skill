import { describe, expect, it, vi } from 'vitest';
import path from 'node:path';

import {
  CliUserError,
  createCliContext,
  describeCommand,
  exitCodeForError,
  outputList,
  pickFields,
  readJsonInput,
  readJsonInputText,
  validatePathInside,
  writeOutput
} from '../../packages/boss-cli/src/cli/contract.js';

describe('CLI contract utilities', () => {
  it('defaults to json when stdout is not a TTY', () => {
    const context = createCliContext(['--limit=2'], {
      command: 'boss test',
      stdoutIsTTY: false,
      stdinIsTTY: false
    });

    expect(context.useJson).toBe(true);
    expect(context.values.limit).toBe('2');
  });

  it('picks fields and applies list limits', () => {
    const context = createCliContext(['--fields=name,status', '--limit=1'], {
      command: 'boss test',
      stdoutIsTTY: false,
      stdinIsTTY: false
    });

    const payload = outputList(
      [
        { name: 'a', status: 'ok', secret: 'hidden' },
        { name: 'b', status: 'ok', secret: 'hidden' }
      ],
      context
    );

    expect(payload).toEqual([{ name: 'a', status: 'ok' }]);
  });

  it('rejects path traversal and control characters', () => {
    const baseDir = path.resolve('/tmp/boss-base');

    expect(() => validatePathInside('../outside', baseDir, 'project directory')).toThrow(CliUserError);
    expect(() => validatePathInside('bad\npath', baseDir, 'project directory')).toThrow(CliUserError);
    expect(validatePathInside('inside/project', baseDir, 'project directory')).toBe(
      path.join(baseDir, 'inside', 'project')
    );
  });

  it('parses direct and stdin json input text', () => {
    expect(readJsonInputText('{"feature":"demo"}', '')).toEqual({ feature: 'demo' });
    expect(readJsonInputText('-', '{"feature":"stdin-demo"}')).toEqual({ feature: 'stdin-demo' });
  });

  it('rejects invalid and empty direct json input', () => {
    for (const raw of ['{', '']) {
      try {
        readJsonInput(raw);
      } catch (err) {
        expect(err).toBeInstanceOf(CliUserError);
        expect((err as CliUserError).code).toBe('invalid_json_input');
        continue;
      }

      throw new Error(`Expected json input ${JSON.stringify(raw)} to be rejected`);
    }
  });

  it('passes unfiltered data to text output renderers', () => {
    const context = createCliContext(['--fields=name'], {
      command: 'boss test',
      stdoutIsTTY: true,
      stdinIsTTY: true
    });
    const data = { name: 'demo', secret: 'visible-in-text-mode' };
    let renderedData: unknown;
    const stdoutWrite = vi.spyOn(process.stdout, 'write').mockImplementation(() => true);

    try {
      writeOutput(data, context, (payload) => {
        renderedData = payload;
        return 'rendered\n';
      });
    } finally {
      stdoutWrite.mockRestore();
    }

    expect(renderedData).toBe(data);
  });

  it('describes commands with stable metadata', () => {
    const metadata = describeCommand({
      command: 'boss project init',
      summary: 'Initialize a Boss feature workspace',
      parameters: [{ name: 'feature', type: 'string', required: true }],
      options: [{ name: 'json', type: 'boolean', default: false }],
      risk_tier: 'medium'
    });

    expect(metadata.command).toBe('boss project init');
    expect(metadata.parameters[0]).toEqual({ name: 'feature', type: 'string', required: true });
    expect(metadata.risk_tier).toBe('medium');
  });

  it('maps retryable errors to exit code 2', () => {
    expect(exitCodeForError(new CliUserError({
      code: 'transient_timeout',
      message: 'Timed out',
      retryable: true
    }))).toBe(2);
  });
});
