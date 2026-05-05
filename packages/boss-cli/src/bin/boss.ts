#!/usr/bin/env node
import * as fs from 'node:fs';
import * as path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

import { installMain } from '../commands/install.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const PKG_ROOT = path.resolve(__dirname, '..', '..', '..', '..');
const pkg = JSON.parse(fs.readFileSync(path.join(PKG_ROOT, 'package.json'), 'utf8')) as {
  version: string;
};

const USAGE = `
@blade-ai/boss-skill v${pkg.version}
BMAD Harness Engineer - pluggable pipeline skill for coding agents.

Usage:
  boss install              Auto-detect all agents and install
  boss uninstall            Remove boss-skill from all detected agents
  boss path                 Print the installed skill root directory
  boss runtime <command>    Run Boss runtime commands
  boss project init         Initialize .boss feature workspaces
  boss artifact prepare     Prepare an artifact from templates
  boss packs detect         Detect the best pipeline pack
  boss hooks run            Run a Boss hook with profile flags
  boss --version            Print version
  boss --help               Show this help

Compatibility:
  boss-skill install        Same as boss install
`;

const RUNTIME_USAGE = `
boss runtime

Usage:
  boss runtime <command> [args...]

Commands:
  init-pipeline
  update-stage
  update-agent
  record-artifact
  get-ready-artifacts
  evaluate-gates
  check-stage
  replay-events
  inspect-progress
  inspect-pipeline
  inspect-events
  inspect-plugins
  render-diagnostics
  extract-memory
  query-memory
  build-memory-summary
  generate-summary
  register-plugins
  run-plugin-hook
  record-feedback
  retry-agent
  retry-stage
`;

const PROJECT_USAGE = `
boss project

Usage:
  boss project init <feature-name> [--template] [--force]
`;

const ARTIFACT_USAGE = `
boss artifact

Usage:
  boss artifact prepare <feature-name> <artifact-name> [template-name]
`;

const PACKS_USAGE = `
boss packs

Usage:
  boss packs detect [project-dir]
`;

const HOOKS_USAGE = `
boss hooks

Usage:
  boss hooks run <hook-id> <script-relative-path> [profiles-csv]
`;

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
  console.log(USAGE);
}

function showRuntimeHelp(): void {
  console.log(RUNTIME_USAGE);
}

function runNodeScript(scriptPath: string, args: string[]): number {
  const result = spawnSync(process.execPath, [scriptPath, ...args], {
    cwd: process.cwd(),
    env: process.env,
    stdio: 'inherit'
  });

  if (result.error) {
    console.error(result.error.message);
    return 1;
  }

  return result.status ?? 0;
}

async function runRuntimeCommand(argv: string[]): Promise<number> {
  const runtimeCommand = argv[0];
  if (!runtimeCommand || runtimeCommand === '-h' || runtimeCommand === '--help') {
    showRuntimeHelp();
    return 0;
  }

  const load = runtimeCommands[runtimeCommand];
  if (!load) {
    console.error(`Unknown runtime command: ${runtimeCommand}\n`);
    showRuntimeHelp();
    return 1;
  }

  const mod = await load();
  return mod.main(argv.slice(1), { cwd: process.cwd() });
}

async function runProjectCommand(argv: string[]): Promise<number> {
  const subcommand = argv[0];
  if (!subcommand || subcommand === '-h' || subcommand === '--help') {
    console.log(PROJECT_USAGE);
    return 0;
  }

  if (subcommand !== 'init') {
    console.error(`Unknown project command: ${subcommand}\n`);
    console.log(PROJECT_USAGE);
    return 1;
  }

  const mod: CommandModule = await import('../commands/project.js');
  return mod.main(argv.slice(1), { cwd: process.cwd() });
}

async function runArtifactCommand(argv: string[]): Promise<number> {
  const subcommand = argv[0];
  if (!subcommand || subcommand === '-h' || subcommand === '--help') {
    console.log(ARTIFACT_USAGE);
    return 0;
  }

  if (subcommand !== 'prepare') {
    console.error(`Unknown artifact command: ${subcommand}\n`);
    console.log(ARTIFACT_USAGE);
    return 1;
  }

  const mod: CommandModule = await import('../commands/artifact.js');
  return mod.main(argv.slice(1), { cwd: process.cwd() });
}

async function runPacksCommand(argv: string[]): Promise<number> {
  const subcommand = argv[0];
  if (!subcommand || subcommand === '-h' || subcommand === '--help') {
    console.log(PACKS_USAGE);
    return 0;
  }

  if (subcommand !== 'detect') {
    console.error(`Unknown packs command: ${subcommand}\n`);
    console.log(PACKS_USAGE);
    return 1;
  }

  const mod: CommandModule = await import('../commands/packs.js');
  return mod.main(argv.slice(1), { cwd: process.cwd() });
}

function runHooksCommand(argv: string[]): number {
  const subcommand = argv[0];
  if (!subcommand || subcommand === '-h' || subcommand === '--help') {
    console.log(HOOKS_USAGE);
    return 0;
  }

  if (subcommand !== 'run') {
    console.error(`Unknown hooks command: ${subcommand}\n`);
    console.log(HOOKS_USAGE);
    return 1;
  }

  return runNodeScript(path.join(PKG_ROOT, 'scripts', 'lib', 'run-with-flags.js'), argv.slice(1));
}

export async function main(argv: string[] = process.argv.slice(2)): Promise<number> {
  const cmd = argv[0];

  switch (cmd) {
    case undefined:
    case 'install':
    case 'uninstall':
    case 'path':
      return installMain(argv);

    case 'runtime':
      return runRuntimeCommand(argv.slice(1));

    case 'project':
      return runProjectCommand(argv.slice(1));

    case 'artifact':
      return runArtifactCommand(argv.slice(1));

    case 'packs':
      return runPacksCommand(argv.slice(1));

    case 'hooks':
      return runHooksCommand(argv.slice(1));

    case '--version':
    case '-v':
      console.log(pkg.version);
      return 0;

    case '--help':
    case '-h':
      showHelp();
      return 0;

    default:
      console.error(`Unknown command: ${cmd}\n`);
      showHelp();
      return 1;
  }
}

if (process.argv[1] && fs.realpathSync(process.argv[1]) === fs.realpathSync(__filename)) {
  process.exit(await main(process.argv.slice(2)));
}
