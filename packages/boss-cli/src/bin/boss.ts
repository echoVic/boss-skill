#!/usr/bin/env node
import * as fs from 'node:fs';
import * as path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

import { installMain } from '../commands/install.js';
import {
  CliUserError,
  createCliContext,
  describeCommand,
  renderHelp,
  runMain,
  validatePathInside,
  writeOutput
} from '../cli/contract.js';
import { commandDescriptions, runtimeCommandDescriptions, runtimeCommandNames } from '../cli/command-registry.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const PKG_ROOT = path.resolve(__dirname, '..', '..', '..', '..');
const pkg = JSON.parse(fs.readFileSync(path.join(PKG_ROOT, 'package.json'), 'utf8')) as {
  version: string;
};

const rootDescription = {
  command: 'boss',
  summary: 'Boss Skill CLI',
  parameters: [{ name: 'command', type: 'string' as const, required: false }],
  options: [
    { name: 'json', type: 'boolean' as const, default: false },
    { name: 'describe', type: 'boolean' as const, default: false },
    { name: 'json-input', type: 'string' as const },
    { name: 'fields', type: 'string' as const },
    { name: 'limit', type: 'string' as const, default: '100' },
    { name: 'dry-run', type: 'boolean' as const, default: false },
    { name: 'yes', type: 'boolean' as const, short: 'y', default: false }
  ],
  risk_tier: 'low' as const
};

const ROOT_USAGE = [
  renderHelp(rootDescription, 'boss COMMAND [options]'),
  'Commands:',
  '  install',
  '  uninstall',
  '  path',
  '  runtime COMMAND',
  '  project init',
  '  artifact prepare',
  '  packs detect',
  '  hooks run',
  '',
  'Compatibility:',
  '  boss-skill install',
  ''
].join('\n');

const runtimeDescription = {
  ...rootDescription,
  command: 'boss runtime',
  summary: 'Run Boss runtime commands'
};

const projectDescription = {
  ...rootDescription,
  command: 'boss project',
  summary: 'Initialize .boss feature workspaces'
};

const artifactDescription = {
  ...rootDescription,
  command: 'boss artifact',
  summary: 'Prepare artifacts from templates'
};

const packsDescription = {
  ...rootDescription,
  command: 'boss packs',
  summary: 'Detect pipeline packs'
};

const hooksDescription = {
  ...rootDescription,
  command: 'boss hooks',
  summary: 'Run Boss hooks'
};

const RUNTIME_USAGE = [
  renderHelp(runtimeDescription, 'boss runtime COMMAND [args...]'),
  'Commands:',
  ...runtimeCommandNames.map((name) => `  ${name}`),
  ''
].join('\n');

const PROJECT_USAGE = [
  renderHelp(projectDescription, 'boss project init <feature-name> [--template] [--force]'),
  'Commands:',
  '  init',
  ''
].join('\n');

const ARTIFACT_USAGE = [
  renderHelp(artifactDescription, 'boss artifact prepare <feature-name> <artifact-name> [template-name]'),
  'Commands:',
  '  prepare',
  ''
].join('\n');

const PACKS_USAGE = [
  renderHelp(packsDescription, 'boss packs detect [project-dir]'),
  'Commands:',
  '  detect',
  ''
].join('\n');

const HOOKS_USAGE = [
  renderHelp(hooksDescription, 'boss hooks run <hook-id> <script-relative-path> [profiles-csv]'),
  'Commands:',
  '  run',
  ''
].join('\n');

type RuntimeModule = {
  main: (argv: string[], options?: { cwd?: string }) => number | Promise<number>;
};

type CommandModule = {
  main: (argv: string[], options?: { cwd?: string }) => number | Promise<number>;
};

const runtimeCommands: Record<string, () => Promise<RuntimeModule>> = {
  'build-memory-summary': () => import('../runtime/cli/build-memory-summary.js'),
  'check-stage': () => import('../runtime/cli/check-stage.js'),
  'evaluate-gates': () => import('../runtime/cli/evaluate-gates.js'),
  'extract-memory': () => import('../runtime/cli/extract-memory.js'),
  'generate-summary': () => import('../runtime/cli/generate-summary.js'),
  'get-ready-artifacts': () => import('../runtime/cli/get-ready-artifacts.js'),
  'init-pipeline': () => import('../runtime/cli/init-pipeline.js'),
  'inspect-events': () => import('../runtime/cli/inspect-events.js'),
  'inspect-pipeline': () => import('../runtime/cli/inspect-pipeline.js'),
  'inspect-plugins': () => import('../runtime/cli/inspect-plugins.js'),
  'inspect-progress': () => import('../runtime/cli/inspect-progress.js'),
  'query-memory': () => import('../runtime/cli/query-memory.js'),
  'record-artifact': () => import('../runtime/cli/record-artifact.js'),
  'record-feedback': () => import('../runtime/cli/record-feedback.js'),
  'register-plugins': () => import('../runtime/cli/register-plugins.js'),
  'render-diagnostics': () => import('../runtime/cli/render-diagnostics.js'),
  'replay-events': () => import('../runtime/cli/replay-events.js'),
  'retry-agent': () => import('../runtime/cli/retry-agent.js'),
  'retry-stage': () => import('../runtime/cli/retry-stage.js'),
  'run-plugin-hook': () => import('../runtime/cli/run-plugin-hook.js'),
  'update-agent': () => import('../runtime/cli/update-agent.js'),
  'update-stage': () => import('../runtime/cli/update-stage.js')
};

export function showHelp(): void {
  process.stdout.write(ROOT_USAGE);
}

function describeRoot() {
  return {
    ...describeCommand(rootDescription),
    version: pkg.version,
    commands: [
      'install',
      'uninstall',
      'path',
      'runtime COMMAND',
      'project init',
      'artifact prepare',
      'packs detect',
      'hooks run'
    ],
    runtime_commands: runtimeCommandNames
  };
}

function describeGroup(description: typeof rootDescription, commands: readonly string[]) {
  return {
    ...describeCommand(description),
    commands: [...commands]
  };
}

function describeRegisteredCommand(command: string) {
  const description = commandDescriptions[command];
  if (!description) {
    throw new Error(`Missing command description for ${command}`);
  }
  return describeCommand(description);
}

function writeDescription(data: unknown, context = createCliContext([], { command: 'boss' })): void {
  writeOutput(data, context, () => `${JSON.stringify(data, null, 2)}\n`);
}

function showRuntimeHelp(): void {
  process.stdout.write(RUNTIME_USAGE);
}

function removeFirstPositional(argv: string[], positional: string | undefined): string[] {
  if (!positional) return argv;
  const index = argv.indexOf(positional);
  if (index === -1) return argv;
  return [...argv.slice(0, index), ...argv.slice(index + 1)];
}

function throwUnknownCommand(scope: string, command: string | undefined): never {
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

async function runRuntimeCommand(argv: string[]): Promise<number> {
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

async function runProjectCommand(argv: string[]): Promise<number> {
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

  const mod: CommandModule = await import('../commands/project.js');
  return mod.main(removeFirstPositional(argv, subcommand), { cwd: process.cwd() });
}

async function runArtifactCommand(argv: string[]): Promise<number> {
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

  const mod: CommandModule = await import('../commands/artifact.js');
  return mod.main(removeFirstPositional(argv, subcommand), { cwd: process.cwd() });
}

async function runPacksCommand(argv: string[]): Promise<number> {
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

  const mod: CommandModule = await import('../commands/packs.js');
  return mod.main(removeFirstPositional(argv, subcommand), { cwd: process.cwd() });
}

function runHooksCommand(argv: string[]): number {
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

export async function main(argv: string[] = process.argv.slice(2)): Promise<number> {
  const rootContext = createCliContext(argv, { command: 'boss', validateOptionValues: false });

  if (rootContext.values.describe && rootContext.positionals.length === 0) {
    writeDescription(describeRoot(), rootContext);
    return 0;
  }

  const cmd = rootContext.positionals[0];
  const commandArgv = removeFirstPositional(argv, cmd);

  switch (cmd) {
    case undefined:
      if (argv.includes('--version') || argv.includes('-v')) {
        console.log(pkg.version);
        return 0;
      }
      if (argv.includes('--help') || argv.includes('-h')) {
        showHelp();
        return 0;
      }
      return installMain(argv);

    case 'install':
    case 'uninstall':
    case 'path':
      if (rootContext.values.describe && rootContext.positionals.length === 1) {
        writeDescription(describeRegisteredCommand(`boss ${cmd}`), createCliContext(commandArgv, { command: `boss ${cmd}` }));
        return 0;
      }
      return installMain(argv);

    case 'runtime':
      return runRuntimeCommand(commandArgv);

    case 'project':
      return runProjectCommand(commandArgv);

    case 'artifact':
      return runArtifactCommand(commandArgv);

    case 'packs':
      return runPacksCommand(commandArgv);

    case 'hooks':
      return runHooksCommand(commandArgv);

    case '--version':
    case '-v':
      console.log(pkg.version);
      return 0;

    case '--help':
    case '-h':
      showHelp();
      return 0;

    default:
      throwUnknownCommand('boss', cmd);
  }
}

if (process.argv[1] && fs.realpathSync(process.argv[1]) === fs.realpathSync(__filename)) {
  const context = createCliContext(process.argv.slice(2), { command: 'boss', validateOptionValues: false });
  process.exit(await runMain(() => main(process.argv.slice(2)), context));
}
