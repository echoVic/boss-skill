import { readFileSync } from 'node:fs';
import { isAbsolute, relative, resolve } from 'node:path';
import { parseArgs } from 'node:util';

export type RiskTier = 'low' | 'medium' | 'high';
export type JsonObject = Record<string, unknown>;

export interface CliErrorData {
  code: string;
  message: string;
  input?: JsonObject;
  retryable: boolean;
  suggestion?: string;
}

export class CliUserError extends Error {
  readonly code: string;
  readonly input?: JsonObject;
  readonly retryable: boolean;
  readonly suggestion?: string;

  constructor(data: CliErrorData) {
    super(data.message);
    this.name = 'CliUserError';
    this.code = data.code;
    this.input = data.input;
    this.retryable = data.retryable;
    this.suggestion = data.suggestion;
  }
}

export interface CliContext {
  command: string;
  values: {
    json: boolean;
    yes: boolean;
    dryRun: boolean;
    describe: boolean;
    fields?: string;
    limit: string;
    jsonInput?: string;
  };
  positionals: string[];
  useJson: boolean;
  stdinIsTTY: boolean;
  stdoutIsTTY: boolean;
}

export interface CommandParameter {
  name: string;
  type: 'string' | 'number' | 'boolean' | 'array' | 'object';
  required?: boolean;
  enum?: string[];
  default?: unknown;
}

export interface CommandOption extends CommandParameter {
  short?: string;
}

export interface CommandDescription {
  command: string;
  summary: string;
  parameters: CommandParameter[];
  options: CommandOption[];
  risk_tier: RiskTier;
}

export function createCliContext(
  argv: string[],
  {
    command,
    stdinIsTTY = Boolean(process.stdin.isTTY),
    stdoutIsTTY = Boolean(process.stdout.isTTY)
  }: { command: string; stdinIsTTY?: boolean; stdoutIsTTY?: boolean }
): CliContext {
  const { values, positionals } = parseArgs({
    args: argv,
    allowPositionals: true,
    options: {
      json: { type: 'boolean', default: false },
      yes: { type: 'boolean', short: 'y', default: false },
      'dry-run': { type: 'boolean', default: false },
      fields: { type: 'string' },
      limit: { type: 'string', default: '100' },
      'json-input': { type: 'string' },
      describe: { type: 'boolean', default: false }
    },
    strict: false
  });

  return {
    command,
    values: {
      json: Boolean(values.json),
      yes: Boolean(values.yes),
      dryRun: Boolean(values['dry-run']),
      describe: Boolean(values.describe),
      fields: typeof values.fields === 'string' ? values.fields : undefined,
      limit: typeof values.limit === 'string' ? values.limit : '100',
      jsonInput: typeof values['json-input'] === 'string' ? values['json-input'] : undefined
    },
    positionals,
    useJson: Boolean(values.json) || !stdoutIsTTY,
    stdinIsTTY,
    stdoutIsTTY
  };
}

export function parseLimit(limit: string): number {
  const parsed = Number(limit);
  if (!Number.isInteger(parsed) || parsed < 0 || parsed > 1000) {
    throw new CliUserError({
      code: 'invalid_limit',
      message: `Invalid --limit value: ${limit}`,
      input: { limit },
      retryable: false,
      suggestion: 'Use an integer between 0 and 1000'
    });
  }
  return parsed;
}

export function pickFields<T extends JsonObject>(obj: T, fields?: string): JsonObject {
  if (!fields) return obj;
  const keys = fields
    .split(',')
    .map((key) => key.trim())
    .filter(Boolean);
  return Object.fromEntries(keys.filter((key) => key in obj).map((key) => [key, obj[key]]));
}

export function outputList(items: JsonObject[], context: CliContext): JsonObject[] {
  return items.slice(0, parseLimit(context.values.limit)).map((item) => pickFields(item, context.values.fields));
}

function isJsonObject(value: unknown): value is JsonObject {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

export function writeOutput(data: unknown, context: CliContext, renderText: (data: unknown) => string): void {
  if (!context.useJson) {
    process.stdout.write(renderText(data));
    return;
  }

  const payload = Array.isArray(data)
    ? data
        .slice(0, parseLimit(context.values.limit))
        .map((item) => (isJsonObject(item) ? pickFields(item, context.values.fields) : item))
    : isJsonObject(data)
      ? pickFields(data, context.values.fields)
      : data;

  process.stdout.write(`${JSON.stringify(payload)}\n`);
}

export function readJsonInputText(raw: string, stdinText: string): unknown {
  const text = raw === '-' ? stdinText : raw;
  try {
    return JSON.parse(text) as unknown;
  } catch {
    throw new CliUserError({
      code: 'invalid_json_input',
      message: 'Invalid JSON supplied to --json-input',
      input: { jsonInput: raw === '-' ? '<stdin>' : raw },
      retryable: false,
      suggestion: 'Pass valid JSON or use --json-input=- with JSON on stdin'
    });
  }
}

export function readJsonInput(raw: string | undefined): unknown | null {
  if (raw === undefined) return null;
  return readJsonInputText(raw, raw === '-' ? readFileSync(0, 'utf8') : '');
}

export function assertConfirmed(context: CliContext, action: string): void {
  if (!context.stdinIsTTY && !context.values.yes) {
    throw new CliUserError({
      code: 'confirmation_required',
      message: '--yes required in non-interactive mode',
      input: { action },
      retryable: false,
      suggestion: `Re-run ${context.command} with --yes after reviewing --dry-run output`
    });
  }
}

export function validatePathInside(input: string, baseDir: string, label: string): string {
  if (/[\x00-\x1f]/.test(input)) {
    throw new CliUserError({
      code: 'invalid_path',
      message: `Control characters rejected in ${label}`,
      input: { path: input },
      retryable: false,
      suggestion: `Pass a ${label} path without control characters`
    });
  }

  const resolvedBaseDir = resolve(baseDir);
  const resolvedPath = resolve(resolvedBaseDir, input);
  const relativePath = relative(resolvedBaseDir, resolvedPath);

  if (
    relativePath === '..' ||
    relativePath.startsWith('../') ||
    relativePath.startsWith('..\\') ||
    isAbsolute(relativePath)
  ) {
    throw new CliUserError({
      code: 'invalid_path',
      message: `Path traversal rejected for ${label}: ${input}`,
      input: { path: input },
      retryable: false,
      suggestion: `Use a ${label} path inside the current project directory`
    });
  }

  return resolvedPath;
}

export function describeCommand(description: CommandDescription): CommandDescription {
  return {
    command: description.command,
    summary: description.summary,
    parameters: description.parameters,
    options: description.options,
    risk_tier: description.risk_tier
  };
}

export function renderHelp(_description: CommandDescription, usage: string): string {
  const lines = [
    `Usage: ${usage}`,
    '',
    'Options:',
    '  --json              Output JSON',
    '  --describe          Output command schema as JSON',
    '  --fields <list>     Include only comma-separated JSON fields',
    '  --limit <number>    Limit list output, default 100',
    '  --json-input <json|-> Read input from JSON string or stdin',
    '  --dry-run           Preview changes without executing',
    '  -y, --yes           Skip confirmation for destructive actions',
    '  -h, --help          Show help',
    ''
  ];
  return lines.join('\n');
}

export function exitCodeForError(err: unknown): number {
  return err instanceof CliUserError && err.retryable ? 2 : 1;
}

export function errorPayload(err: unknown): { error: CliErrorData } {
  if (err instanceof CliUserError) {
    return {
      error: {
        code: err.code,
        message: err.message,
        input: err.input,
        retryable: err.retryable,
        suggestion: err.suggestion
      }
    };
  }

  const message = err instanceof Error ? err.message : String(err);
  return {
    error: {
      code: 'internal_error',
      message,
      retryable: false,
      suggestion: 'Re-run with --describe to verify command parameters'
    }
  };
}

export function writeError(err: unknown, context: Pick<CliContext, 'useJson'>): void {
  const payload = errorPayload(err);
  if (context.useJson) {
    process.stderr.write(`${JSON.stringify(payload)}\n`);
    return;
  }

  process.stderr.write(`Error [${payload.error.code}]: ${payload.error.message}\n`);
  if (payload.error.suggestion) {
    process.stderr.write(`Hint: ${payload.error.suggestion}\n`);
  }
}

export function runMain(fn: () => number | Promise<number>, context: Pick<CliContext, 'useJson'>): Promise<number> {
  return Promise.resolve()
    .then(fn)
    .catch((err) => {
      writeError(err, context);
      return exitCodeForError(err);
    });
}
