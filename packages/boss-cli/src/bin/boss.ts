#!/usr/bin/env node
import * as fs from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';

import { main as continueMain } from '../commands/continue.js';
import { installMain } from '../commands/install/index.js';
import { main as statusMain } from '../commands/status.js';
import { createCliContext, describeCommand, runMain } from '../cli/contract.js';
import { runtimeCommandNames } from '../cli/registry.js';
import {
  describeRegisteredCommand,
  removeFirstPositional,
  runArtifactCommand,
  runDesignCommand,
  runHooksCommand,
  runPacksCommand,
  runProjectCommand,
  runRuntimeCommand,
  throwUnknownCommand,
  writeDescription
} from '../cli/dispatcher.js';
import { showRootHelp } from '../cli/help.js';
import { rootDescription } from '../cli/registry.js';
import { readJsonFile } from '../infrastructure/fs.js';
import { packageRootFromImportMeta } from '../infrastructure/paths.js';

const __filename = fileURLToPath(import.meta.url);
const PKG_ROOT = packageRootFromImportMeta(import.meta.url, 4);
const pkg = readJsonFile<{
  version: string;
}>(path.join(PKG_ROOT, 'package.json'));

export function showHelp(): void {
  showRootHelp();
}

function describeRoot() {
  return {
    ...describeCommand(rootDescription),
    version: pkg.version,
    commands: [
      'install',
      'uninstall',
      'path',
      'status FEATURE',
      'continue FEATURE',
      'runtime COMMAND',
      'design preview',
      'project init',
      'artifact prepare',
      'packs detect',
      'hooks run'
    ],
    runtime_commands: runtimeCommandNames
  };
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

    case 'status':
      return statusMain(commandArgv, { cwd: process.cwd() });

    case 'continue':
      return continueMain(commandArgv, { cwd: process.cwd() });

    case 'runtime':
      return runRuntimeCommand(commandArgv);

    case 'design':
      return runDesignCommand(commandArgv);

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
