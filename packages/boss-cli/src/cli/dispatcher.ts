import * as path from 'node:path';
import { spawnSync } from 'node:child_process';

import {
  CliUserError,
  createCliContext,
  describeCommand,
  validatePathInside,
  writeOutput
} from './contract.js';
import { commandDescriptions, runtimeCommandDescriptions, runtimeCommandNames } from './registry.js';
import {
  artifactDescription,
  designDescription,
  gateDescription,
  hooksDescription,
  packsDescription,
  projectDescription,
  runtimeDescription
} from './registry.js';
import {
  ARTIFACT_USAGE,
  DESIGN_USAGE,
  GATE_USAGE,
  HOOKS_USAGE,
  PACKS_USAGE,
  PROJECT_USAGE,
  showRuntimeHelp
} from './help.js';
import { packageRootFromImportMeta } from '../infrastructure/paths.js';

const PKG_ROOT = packageRootFromImportMeta(import.meta.url, 4);

type RuntimeModule = {
  main: (argv: string[], options?: { cwd?: string }) => number | Promise<number>;
};

type CommandModule = {
  main: (argv: string[], options?: { cwd?: string }) => number | Promise<number>;
};

const runtimeCommands: Record<string, () => Promise<RuntimeModule>> = {
  'build-memory-summary': () => import('../commands/runtime/build-memory-summary.js'),
  'check-stage': () => import('../commands/runtime/check-stage.js'),
  'evaluate-gates': () => import('../commands/runtime/evaluate-gates.js'),
  'extract-memory': () => import('../commands/runtime/extract-memory.js'),
  'generate-summary': () => import('../commands/runtime/generate-summary.js'),
  'get-ready-artifacts': () => import('../commands/runtime/get-ready-artifacts.js'),
  'init-pipeline': () => import('../commands/runtime/init-pipeline.js'),
  'inspect-events': () => import('../commands/runtime/inspect-events.js'),
  'inspect-pipeline': () => import('../commands/runtime/inspect-pipeline.js'),
  'inspect-plugins': () => import('../commands/runtime/inspect-plugins.js'),
  'inspect-progress': () => import('../commands/runtime/inspect-progress.js'),
  'query-memory': () => import('../commands/runtime/query-memory.js'),
  'record-artifact': () => import('../commands/runtime/record-artifact.js'),
  'record-feedback': () => import('../commands/runtime/record-feedback.js'),
  'register-plugins': () => import('../commands/runtime/register-plugins.js'),
  'render-diagnostics': () => import('../commands/runtime/render-diagnostics.js'),
  'replay-events': () => import('../commands/runtime/replay-events.js'),
  'retry-agent': () => import('../commands/runtime/retry-agent.js'),
  'retry-stage': () => import('../commands/runtime/retry-stage.js'),
  'run-plugin-hook': () => import('../commands/runtime/run-plugin-hook.js'),
  'update-agent': () => import('../commands/runtime/update-agent.js'),
  'update-stage': () => import('../commands/runtime/update-stage.js')
};

export function describeGroup(description: typeof runtimeDescription, commands: readonly string[]) {
  return {
    ...describeCommand(description),
    commands: [...commands]
  };
}

export function describeRegisteredCommand(command: string) {
  const description = commandDescriptions[command];
  if (!description) {
    throw new Error(`Missing command description for ${command}`);
  }
  return describeCommand(description);
}

export function writeDescription(data: unknown, context = createCliContext([], { command: 'boss' })): void {
  writeOutput(data, context, () => `${JSON.stringify(data, null, 2)}\n`);
}

export function removeFirstPositional(argv: string[], positional: string | undefined): string[] {
  if (!positional) return argv;
  const index = argv.indexOf(positional);
  if (index === -1) return argv;
  return [...argv.slice(0, index), ...argv.slice(index + 1)];
}

export function throwUnknownCommand(scope: string, command: string | undefined): never {
  throw new CliUserError({
    code: 'unknown_command',
    message: `Unknown command: ${command}`,
    input: { command },
    retryable: false,
    suggestion: `Run ${scope} --describe to list available commands`
  });
}

function runNodeScript(scriptPath: string, args: string[]): number {
  const result = spawnSync(process.execPath, [scriptPath, ...args], {
    cwd: process.cwd(),
    env: process.env,
    stdio: 'inherit'
  });

  if (result.error) {
    throw new CliUserError({
      code: 'script_spawn_failed',
      message: result.error.message,
      input: { script: scriptPath },
      retryable: true,
      suggestion: 'Verify Node can execute the requested hook script'
    });
  }

  return result.status ?? 0;
}

function ensureHookScriptInsideScripts(scriptRelativePath: string): void {
  const scriptAbs = validatePathInside(scriptRelativePath, PKG_ROOT, 'hook script');
  const scriptsRoot = path.join(PKG_ROOT, 'scripts');
  const relativeToScripts = path.relative(scriptsRoot, scriptAbs);
  if (
    relativeToScripts === '..' ||
    relativeToScripts.startsWith('../') ||
    relativeToScripts.startsWith('..\\') ||
    path.isAbsolute(relativeToScripts)
  ) {
    throw new CliUserError({
      code: 'invalid_path',
      message: `Path traversal rejected for hook script: ${scriptRelativePath}`,
      input: { path: scriptRelativePath },
      retryable: false,
      suggestion: 'Use a script-relative-path inside the scripts directory'
    });
  }
}

function runHookScript(argv: string[], context: ReturnType<typeof createCliContext>): number {
  const [hook, script] = context.positionals;
  if (!hook || !script) {
    throw new CliUserError({
      code: 'missing_argument',
      message: 'Usage: boss hooks run <hook-id> <script-relative-path> [profiles-csv]',
      input: { hook, script },
      retryable: false,
      suggestion: 'Run boss hooks run --describe to verify command parameters'
    });
  }

  ensureHookScriptInsideScripts(script);
  const scriptPath = path.join(PKG_ROOT, 'scripts', 'lib', 'run-with-flags.js');
  if (!context.useJson) {
    return runNodeScript(scriptPath, argv);
  }

  const result = spawnSync(process.execPath, [scriptPath, ...argv], {
    cwd: process.cwd(),
    env: process.env,
    stdio: ['inherit', 'pipe', 'pipe']
  });
  if (result.error) {
    throw result.error;
  }

  const payload = {
    hook,
    script,
    exitCode: result.status ?? 0,
    stdout: result.stdout.toString(),
    stderr: result.stderr.toString()
  };
  writeOutput(payload, context, () => result.stdout.toString());
  return result.status ?? 0;
}

export async function runRuntimeCommand(argv: string[]): Promise<number> {
  const context = createCliContext(argv, { command: 'boss runtime' });
  const runtimeCommand = context.positionals[0];
  if (context.values.describe && context.positionals.length === 0) {
    writeDescription(
      {
        ...describeGroup(runtimeDescription, runtimeCommandNames),
        runtime_commands: runtimeCommandNames
      },
      context
    );
    return 0;
  }

  if (!runtimeCommand || runtimeCommand === '-h' || runtimeCommand === '--help') {
    showRuntimeHelp();
    return 0;
  }

  const commandArgv = removeFirstPositional(argv, runtimeCommand);
  const commandContext = createCliContext(commandArgv, { command: `boss runtime ${runtimeCommand}` });
  if (commandContext.values.describe) {
    const description = runtimeCommandDescriptions[runtimeCommand];
    if (!description) {
      throwUnknownCommand('boss runtime', runtimeCommand);
    }
    writeDescription(describeCommand(description), commandContext);
    return 0;
  }

  const load = runtimeCommands[runtimeCommand];
  if (!load) {
    throwUnknownCommand('boss runtime', runtimeCommand);
  }

  const mod = await load();
  return mod.main(commandArgv, { cwd: process.cwd() });
}

export async function runDesignCommand(argv: string[]): Promise<number> {
  const context = createCliContext(argv, { command: 'boss design' });
  const subcommand = context.positionals[0];
  if (context.values.describe && context.positionals.length === 0) {
    writeDescription(describeGroup(designDescription, ['preview']), context);
    return 0;
  }

  if (!subcommand || subcommand === '-h' || subcommand === '--help') {
    process.stdout.write(DESIGN_USAGE);
    return 0;
  }

  if (subcommand !== 'preview') {
    throwUnknownCommand('boss design', subcommand);
  }

  const commandArgv = removeFirstPositional(argv, subcommand);
  const commandContext = createCliContext(commandArgv, { command: 'boss design preview' });
  if (commandContext.values.describe) {
    writeDescription(describeRegisteredCommand('boss design preview'), commandContext);
    return 0;
  }

  const mod: CommandModule = await import('../commands/design/preview.js');
  return mod.main(commandArgv, { cwd: process.cwd() });
}

export async function runGateCommand(argv: string[]): Promise<number> {
  const context = createCliContext(argv, { command: 'boss gate' });
  const subcommand = context.positionals[0];
  if (context.values.describe && context.positionals.length === 0) {
    writeDescription(describeGroup(gateDescription, ['final']), context);
    return 0;
  }

  if (argv.includes('-h') || argv.includes('--help')) {
    process.stdout.write(GATE_USAGE);
    return 0;
  }

  const commandKey = subcommand === 'final' ? 'boss gate final' : 'boss gate';
  const commandArgv = subcommand === 'final' ? removeFirstPositional(argv, subcommand) : argv;
  const normalizedArgv = subcommand === 'final' ? [subcommand, ...commandArgv] : argv;
  const commandContext = createCliContext(commandArgv, { command: commandKey });
  if (commandContext.values.describe) {
    writeDescription(describeRegisteredCommand(commandKey), commandContext);
    return 0;
  }

  const mod: CommandModule = await import('../commands/gate/index.js');
  return mod.main(normalizedArgv, { cwd: process.cwd() });
}

export async function runProjectCommand(argv: string[]): Promise<number> {
  const context = createCliContext(argv, { command: 'boss project' });
  const subcommand = context.positionals[0];
  if (context.values.describe && context.positionals.length === 0) {
    writeDescription(describeGroup(projectDescription, ['init']), context);
    return 0;
  }

  if (!subcommand || subcommand === '-h' || subcommand === '--help') {
    process.stdout.write(PROJECT_USAGE);
    return 0;
  }

  if (subcommand !== 'init') {
    throwUnknownCommand('boss project', subcommand);
  }

  const mod: CommandModule = await import('../commands/project/index.js');
  return mod.main(removeFirstPositional(argv, subcommand), { cwd: process.cwd() });
}

export async function runArtifactCommand(argv: string[]): Promise<number> {
  const context = createCliContext(argv, { command: 'boss artifact' });
  const subcommand = context.positionals[0];
  if (context.values.describe && context.positionals.length === 0) {
    writeDescription(describeGroup(artifactDescription, ['prepare']), context);
    return 0;
  }

  if (!subcommand || subcommand === '-h' || subcommand === '--help') {
    process.stdout.write(ARTIFACT_USAGE);
    return 0;
  }

  if (subcommand !== 'prepare') {
    throwUnknownCommand('boss artifact', subcommand);
  }

  const mod: CommandModule = await import('../commands/artifact/index.js');
  return mod.main(removeFirstPositional(argv, subcommand), { cwd: process.cwd() });
}

export async function runPacksCommand(argv: string[]): Promise<number> {
  const context = createCliContext(argv, { command: 'boss packs' });
  const subcommand = context.positionals[0];
  if (context.values.describe && context.positionals.length === 0) {
    writeDescription(describeGroup(packsDescription, ['detect']), context);
    return 0;
  }

  if (!subcommand || subcommand === '-h' || subcommand === '--help') {
    process.stdout.write(PACKS_USAGE);
    return 0;
  }

  if (subcommand !== 'detect') {
    throwUnknownCommand('boss packs', subcommand);
  }

  const mod: CommandModule = await import('../commands/packs/index.js');
  return mod.main(removeFirstPositional(argv, subcommand), { cwd: process.cwd() });
}

export function runHooksCommand(argv: string[]): number {
  const context = createCliContext(argv, { command: 'boss hooks' });
  const subcommand = context.positionals[0];
  if (context.values.describe && context.positionals.length === 0) {
    writeDescription(describeGroup(hooksDescription, ['run']), context);
    return 0;
  }

  if (!subcommand || subcommand === '-h' || subcommand === '--help') {
    process.stdout.write(HOOKS_USAGE);
    return 0;
  }

  if (subcommand !== 'run') {
    throwUnknownCommand('boss hooks', subcommand);
  }

  const commandArgv = removeFirstPositional(argv, subcommand);
  const commandContext = createCliContext(commandArgv, { command: 'boss hooks run' });
  if (commandContext.values.describe) {
    writeDescription(describeRegisteredCommand('boss hooks run'), commandContext);
    return 0;
  }

  return runHookScript(commandArgv, commandContext);
}
