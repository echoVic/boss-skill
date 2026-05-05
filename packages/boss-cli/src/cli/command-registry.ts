import type { CommandDescription } from './contract.js';

const commonOptions = [
  { name: 'json', type: 'boolean' as const, default: false },
  { name: 'describe', type: 'boolean' as const, default: false },
  { name: 'fields', type: 'string' as const },
  { name: 'limit', type: 'string' as const, default: '100' },
  { name: 'json-input', type: 'string' as const },
  { name: 'dry-run', type: 'boolean' as const, default: false },
  { name: 'yes', type: 'boolean' as const, short: 'y', default: false }
];

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

export const runtimeCommandNames = [
  'init-pipeline',
  'update-stage',
  'update-agent',
  'record-artifact',
  'get-ready-artifacts',
  'evaluate-gates',
  'check-stage',
  'replay-events',
  'inspect-progress',
  'inspect-pipeline',
  'inspect-events',
  'inspect-plugins',
  'render-diagnostics',
  'extract-memory',
  'query-memory',
  'build-memory-summary',
  'generate-summary',
  'register-plugins',
  'run-plugin-hook',
  'record-feedback',
  'retry-agent',
  'retry-stage'
] as const;

const runtimeBaseOptions = [
  { name: 'json', type: 'boolean' as const, default: false },
  { name: 'describe', type: 'boolean' as const, default: false }
];

const runtimeFieldOptions = [
  ...runtimeBaseOptions,
  { name: 'fields', type: 'string' as const }
];

const runtimeListOptions = [
  ...runtimeFieldOptions,
  { name: 'limit', type: 'string' as const, default: '20' }
];

const runtimeDryRunOptions = [
  ...runtimeFieldOptions,
  { name: 'dry-run', type: 'boolean' as const, default: false }
];

const runtimeDescriptions: Record<string, CommandDescription> = {};

for (const name of runtimeCommandNames) {
  runtimeDescriptions[name] = {
    command: `boss runtime ${name}`,
    summary: `Run runtime command ${name}`,
    parameters: [{ name: 'feature', type: 'string', required: false }],
    options: runtimeBaseOptions,
    risk_tier: 'low'
  };
}

for (const name of [
  'check-stage',
  'get-ready-artifacts',
  'inspect-pipeline',
  'inspect-plugins',
  'query-memory'
]) {
  runtimeDescriptions[name] = {
    ...runtimeDescriptions[name]!,
    options: runtimeFieldOptions
  };
}

for (const name of ['inspect-events', 'inspect-progress', 'replay-events']) {
  runtimeDescriptions[name] = {
    ...runtimeDescriptions[name]!,
    options: runtimeListOptions
  };
}

for (const name of ['generate-summary', 'render-diagnostics']) {
  runtimeDescriptions[name] = {
    ...runtimeDescriptions[name]!,
    options: [
      ...runtimeDryRunOptions,
      { name: 'stdout', type: 'boolean' as const, default: false }
    ],
    risk_tier: 'medium'
  };
}

for (const name of ['build-memory-summary', 'extract-memory']) {
  runtimeDescriptions[name] = {
    ...runtimeDescriptions[name]!,
    options: runtimeDryRunOptions,
    risk_tier: 'medium'
  };
}

export const runtimeCommandDescriptions: Record<string, CommandDescription> = runtimeDescriptions;
