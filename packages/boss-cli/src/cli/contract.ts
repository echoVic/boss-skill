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
    stdoutIsTTY = Boolean(process.stdout.isTTY),
    validateOptionValues = true
  }: { command: string; stdinIsTTY?: boolean; stdoutIsTTY?: boolean; validateOptionValues?: boolean }
): CliContext {
  if (validateOptionValues) {
    validateCliContractOptionValues(argv);
  }

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

function isLikelyOptionToken(value: string): boolean {
  return value.startsWith('--') || /^-[A-Za-z]$/.test(value);
}

function missingValueError(option: string): CliUserError {
  return new CliUserError({
    code: 'missing_option_value',
    message: `${option} requires a value`,
    input: { option },
    retryable: false,
    suggestion: `Pass a value after ${option}`
  });
}

export function validateCliContractOptionValues(argv: string[]): void {
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index]!;
    if (arg !== '--fields' && arg !== '--limit' && arg !== '--json-input') {
      continue;
    }

    const nextValue = argv[index + 1];
    if (
      nextValue === undefined ||
      (isLikelyOptionToken(nextValue) && !(arg === '--json-input' && nextValue === '-'))
    ) {
      throw missingValueError(arg);
    }

    index += 1;
  }
}

export function consumeCliContractOption(argv: string[], index: number): number | null {
  const arg = argv[index]!;
  if (arg === '--json' || arg === '--describe' || arg === '--dry-run' || arg === '--yes' || arg === '-y') {
    return index;
  }

  if (arg === '--fields' || arg === '--limit' || arg === '--json-input') {
    const nextValue = argv[index + 1];
    if (
      nextValue === undefined ||
      (isLikelyOptionToken(nextValue) && !(arg === '--json-input' && nextValue === '-'))
    ) {
      throw missingValueError(arg);
    }
    return index + 1;
  }

  if (arg.startsWith('--fields=') || arg.startsWith('--limit=') || arg.startsWith('--json-input=')) {
    return index;
  }

  return null;
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

function optionValuePlaceholder(option: CommandOption): string {
  if (option.name === 'json-input') return ' <json|->';
  if (option.type === 'boolean') return '';
  return ` <${option.type}>`;
}

function optionDetails(option: CommandOption): string {
  const parts: string[] = [];
  if (option.enum && option.enum.length > 0) {
    parts.push(`(${option.enum.join('|')})`);
  }
  if (option.default !== undefined && option.default !== false) {
    parts.push(`[default: ${String(option.default)}]`);
  }
  return parts.join(' ');
}

function renderOption(option: CommandOption): string {
  const longFlag = `--${option.name}${optionValuePlaceholder(option)}`;
  const flag = option.short ? `-${option.short}, ${longFlag}` : longFlag;
  const details = optionDetails(option);
  return details ? `  ${flag}  ${details}` : `  ${flag}`;
}

export function renderHelp(description: CommandDescription, usage: string): string {
  const lines = [
    `Usage: ${usage}`,
    '',
    'Options:',
    ...description.options.map(renderOption),
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
  const unknownOptionMatch = message.match(/^(?:未知选项|Unknown option):\s*(.+)$/);
  if (unknownOptionMatch) {
    return {
      error: {
        code: 'unknown_option',
        message,
        input: { option: unknownOptionMatch[1] },
        retryable: false,
        suggestion: 'Run this command with --describe to verify supported options'
      }
    };
  }
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
