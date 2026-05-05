import type { CommandDescription } from './contract.js';
import { commonOptions } from './common-options.js';

export const commandDescriptions: Record<string, CommandDescription> = {
  'boss project init': {
    command: 'boss project init',
    summary: 'Initialize a Boss feature workspace',
    parameters: [{ name: 'feature', type: 'string', required: true }],
    options: [
      ...commonOptions,
      { name: 'template', type: 'boolean', short: 't', default: false },
      { name: 'force', type: 'boolean', short: 'f', default: false }
    ],
    risk_tier: 'medium'
  },
  'boss artifact prepare': {
    command: 'boss artifact prepare',
    summary: 'Prepare an artifact from project or built-in templates',
    parameters: [
      { name: 'feature', type: 'string', required: true },
      { name: 'artifact', type: 'string', required: true },
      { name: 'template', type: 'string', required: false }
    ],
    options: commonOptions,
    risk_tier: 'medium'
  },
  'boss packs detect': {
    command: 'boss packs detect',
    summary: 'Detect the best pipeline pack for a project directory',
    parameters: [{ name: 'projectDir', type: 'string', required: false, default: '.' }],
    options: commonOptions,
    risk_tier: 'low'
  },
  'boss install': {
    command: 'boss install',
    summary: 'Install the thin Boss skill bundle into detected agents',
    parameters: [],
    options: commonOptions,
    risk_tier: 'medium'
  },
  'boss uninstall': {
    command: 'boss uninstall',
    summary: 'Remove copied Boss skill bundles from detected agents',
    parameters: [],
    options: commonOptions,
    risk_tier: 'high'
  },
  'boss path': {
    command: 'boss path',
    summary: 'Print the package root used for Claude plugin mode',
    parameters: [],
    options: commonOptions,
    risk_tier: 'low'
  },
  'boss hooks run': {
    command: 'boss hooks run',
    summary: 'Run a Boss hook through the hook dispatcher',
    parameters: [
      { name: 'hookId', type: 'string', required: true },
      { name: 'scriptRelativePath', type: 'string', required: true },
      { name: 'profilesCsv', type: 'string', required: false }
    ],
    options: commonOptions,
    risk_tier: 'medium'
  }
};
