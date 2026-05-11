#!/usr/bin/env node
import * as fs from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  CliUserError,
  consumeCliContractOption,
  createCliContext,
  describeCommand,
  runMain,
  validatePathInside,
  writeOutput
} from '../../cli/contract.js';
import { commandDescriptions } from '../../cli/registry.js';
import { openUrl } from '../../runtime/design/open.js';
import { renderUiDesignHtml } from '../../runtime/design/render.js';
import {
  validateUiDesignArtifact,
  type UiDesignArtifact
} from '../../runtime/design/schema.js';
import { startUiDesignPreviewServer } from '../../runtime/design/server.js';

const designPreviewDescription = commandDescriptions['boss design preview']!;

interface PreviewInput {
  feature: string;
  noOpen: boolean;
  port: number;
}

interface PreviewPayload {
  feature: string;
  artifact: string;
  url: string;
  mode: string | undefined;
  opened: boolean;
  valid: boolean;
  errors: string[];
}

function showHelp(): void {
  process.stdout.write(
    [
      'Usage: boss design preview <feature> [--no-open] [--port <port>]',
      '',
      'Options:',
      '  --no-open',
      '  --port <port>',
      '  --json',
      '  --describe',
      '  -h, --help          Show help',
      ''
    ].join('\n')
  );
}

function invalidPort(port: string): never {
  throw new CliUserError({
    code: 'invalid_port',
    message: `Invalid --port value: ${port}`,
    input: { port },
    retryable: false,
    suggestion: 'Use an integer between 0 and 65535'
  });
}

function parsePort(port: string): number {
  if (!/^\d+$/.test(port)) invalidPort(port);
  const parsed = Number(port);
  if (!Number.isInteger(parsed) || parsed < 0 || parsed > 65535) invalidPort(port);
  return parsed;
}

function parsePreviewInput(argv: string[]): PreviewInput {
  const input: PreviewInput = { feature: '', noOpen: false, port: 0 };
  const positionals: string[] = [];

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (typeof arg !== 'string') continue;

    const consumed = consumeCliContractOption(argv, index);
    if (consumed !== null) {
      index = consumed;
      continue;
    }

    if (arg === '-h' || arg === '--help') {
      continue;
    }

    if (arg === '--no-open') {
      input.noOpen = true;
      continue;
    }

    if (arg === '--port') {
      const value = argv[index + 1];
      if (value === undefined || value.startsWith('-')) {
        throw new CliUserError({
          code: 'missing_option_value',
          message: '--port requires a value',
          input: { option: '--port' },
          retryable: false,
          suggestion: 'Pass a port number after --port'
        });
      }
      input.port = parsePort(value);
      index += 1;
      continue;
    }

    if (arg.startsWith('--port=')) {
      input.port = parsePort(arg.slice('--port='.length));
      continue;
    }

    if (arg.startsWith('-')) {
      throw new CliUserError({
        code: 'unknown_option',
        message: `Unknown option: ${arg}`,
        input: { option: arg },
        retryable: false,
        suggestion: 'Run boss design preview --describe to verify supported options'
      });
    }

    positionals.push(arg);
  }

  if (positionals[0]) input.feature = positionals[0];
  if (positionals.length > 1) {
    throw new CliUserError({
      code: 'extra_argument',
      message: `Extra argument: ${positionals[1]}`,
      input: { argument: positionals[1] },
      retryable: false,
      suggestion: 'Pass only the feature name'
    });
  }

  if (!input.feature) {
    throw new CliUserError({
      code: 'missing_argument',
      message: 'Usage: boss design preview <feature> [--no-open] [--port <port>]',
      input: { feature: input.feature },
      retryable: false,
      suggestion: 'Pass the feature that contains .boss/<feature>/ui-design.json'
    });
  }

  return input;
}

function readUiDesignArtifact(cwd: string, feature: string): { artifactPath: string; relativeArtifactPath: string; design: unknown } {
  const relativeArtifactPath = path.posix.join('.boss', feature, 'ui-design.json');
  const artifactPath = validatePathInside(relativeArtifactPath, cwd, 'ui design artifact');

  if (!fs.existsSync(artifactPath)) {
    throw new CliUserError({
      code: 'ui_design_not_found',
      message: `UI design artifact not found: ${relativeArtifactPath}`,
      input: { feature, artifact: relativeArtifactPath },
      retryable: false,
      suggestion: `Create ${relativeArtifactPath} before running the preview`
    });
  }

  const text = fs.readFileSync(artifactPath, 'utf8');
  try {
    return {
      artifactPath,
      relativeArtifactPath,
      design: JSON.parse(text) as unknown
    };
  } catch {
    throw new CliUserError({
      code: 'invalid_ui_design_json',
      message: `Invalid JSON in ${relativeArtifactPath}`,
      input: { feature, artifact: relativeArtifactPath },
      retryable: false,
      suggestion: 'Fix the JSON syntax and run the preview again'
    });
  }
}

function renderTextPayload(data: unknown): string {
  const payload = data as PreviewPayload;
  const status = payload.valid ? 'valid' : 'invalid';
  const opened = payload.opened ? 'opened' : 'not opened';
  const errors = payload.errors.length > 0 ? `\nErrors:\n${payload.errors.map((error) => `- ${error}`).join('\n')}\n` : '';
  return `Preview ${status}: ${payload.artifact}\nURL: ${payload.url}\nBrowser: ${opened}\n${errors}`;
}

export async function main(
  argv: string[] = process.argv.slice(2),
  { cwd = process.cwd() }: { cwd?: string } = {}
): Promise<number> {
  const context = createCliContext(argv, { command: 'boss design preview' });
  if (context.values.describe) {
    writeOutput(describeCommand(designPreviewDescription), context, (data) => `${JSON.stringify(data, null, 2)}\n`);
    return 0;
  }

  if (argv.includes('-h') || argv.includes('--help')) {
    showHelp();
    return 0;
  }

  const input = parsePreviewInput(argv);
  const { relativeArtifactPath, design } = readUiDesignArtifact(cwd, input.feature);
  const validation = validateUiDesignArtifact(design);
  const html = renderUiDesignHtml(design as UiDesignArtifact, validation);
  const preview = await startUiDesignPreviewServer(html, input.port);

  const shouldOpen = !input.noOpen && context.stdinIsTTY && context.stdoutIsTTY && !process.env.CI;
  const opened = shouldOpen ? openUrl(preview.url) : false;
  const mode = typeof (design as Partial<UiDesignArtifact>).mode === 'string'
    ? (design as Partial<UiDesignArtifact>).mode
    : undefined;
  const payload: PreviewPayload = {
    feature: input.feature,
    artifact: relativeArtifactPath,
    url: preview.url,
    mode,
    opened,
    valid: validation.ok,
    errors: validation.errors
  };

  writeOutput(payload, context, renderTextPayload);

  if (context.useJson || input.noOpen) {
    await preview.close();
  }

  return validation.ok ? 0 : 1;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const context = createCliContext(process.argv.slice(2), { command: 'boss design preview', validateOptionValues: false });
  process.exit(await runMain(() => main(process.argv.slice(2), { cwd: process.cwd() }), context));
}
