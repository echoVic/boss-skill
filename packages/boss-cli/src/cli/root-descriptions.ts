import type { CommandDescription } from './contract.js';

export const rootDescription: CommandDescription = {
  command: 'boss',
  summary: 'Boss Skill CLI',
  parameters: [{ name: 'command', type: 'string', required: false }],
  options: [
    { name: 'json', type: 'boolean', default: false },
    { name: 'describe', type: 'boolean', default: false },
    { name: 'json-input', type: 'string' },
    { name: 'fields', type: 'string' },
    { name: 'limit', type: 'string', default: '100' },
    { name: 'dry-run', type: 'boolean', default: false },
    { name: 'yes', type: 'boolean', short: 'y', default: false }
  ],
  risk_tier: 'low'
};

export const runtimeDescription: CommandDescription = {
  ...rootDescription,
  command: 'boss runtime',
  summary: 'Run Boss runtime commands'
};

export const projectDescription: CommandDescription = {
  ...rootDescription,
  command: 'boss project',
  summary: 'Initialize .boss feature workspaces'
};

export const artifactDescription: CommandDescription = {
  ...rootDescription,
  command: 'boss artifact',
  summary: 'Prepare artifacts from templates'
};

export const packsDescription: CommandDescription = {
  ...rootDescription,
  command: 'boss packs',
  summary: 'Detect pipeline packs'
};

export const hooksDescription: CommandDescription = {
  ...rootDescription,
  command: 'boss hooks',
  summary: 'Run Boss hooks'
};
