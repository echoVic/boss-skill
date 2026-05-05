import type { CommandDescription } from './contract.js';
import {
  runtimeBaseOptions,
  runtimeDryRunOptions,
  runtimeFieldOptions,
  runtimeHighRiskOptions,
  runtimeListOptions,
  runtimeMutationOptions
} from './common-options.js';

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

for (const name of [
  'init-pipeline',
  'update-stage',
  'update-agent',
  'record-artifact',
  'record-feedback',
  'register-plugins',
  'run-plugin-hook'
]) {
  runtimeDescriptions[name] = {
    ...runtimeDescriptions[name]!,
    options: runtimeMutationOptions,
    risk_tier: 'medium'
  };
}

runtimeDescriptions['evaluate-gates'] = {
  ...runtimeDescriptions['evaluate-gates']!,
  options: [
    ...runtimeMutationOptions,
    { name: 'skip-on-error', type: 'boolean' as const, default: false }
  ],
  risk_tier: 'medium'
};

for (const name of ['retry-agent', 'retry-stage']) {
  runtimeDescriptions[name] = {
    ...runtimeDescriptions[name]!,
    options: runtimeHighRiskOptions,
    risk_tier: 'high'
  };
}

Object.assign(runtimeDescriptions, {
  'init-pipeline': {
    ...runtimeDescriptions['init-pipeline']!,
    summary: 'Initialize a Boss feature pipeline',
    parameters: [{ name: 'feature', type: 'string' as const, required: true }]
  },
  'update-stage': {
    ...runtimeDescriptions['update-stage']!,
    summary: 'Update stage status and optionally record artifacts or gate result',
    parameters: [
      { name: 'feature', type: 'string' as const, required: true },
      { name: 'stage', type: 'number' as const, required: true },
      { name: 'status', type: 'string' as const, required: true, enum: ['running', 'completed', 'failed', 'retrying', 'skipped'] }
    ],
    options: [
      ...runtimeMutationOptions,
      { name: 'reason', type: 'string' as const },
      { name: 'artifact', type: 'array' as const },
      { name: 'gate', type: 'string' as const },
      { name: 'gate-passed', type: 'boolean' as const, default: false },
      { name: 'gate-failed', type: 'boolean' as const, default: false }
    ]
  },
  'update-agent': {
    ...runtimeDescriptions['update-agent']!,
    summary: 'Update an agent status within a stage',
    parameters: [
      { name: 'feature', type: 'string' as const, required: true },
      { name: 'stage', type: 'number' as const, required: true },
      { name: 'agent', type: 'string' as const, required: true },
      { name: 'status', type: 'string' as const, required: true, enum: ['running', 'completed', 'failed'] }
    ],
    options: [...runtimeMutationOptions, { name: 'reason', type: 'string' as const }]
  },
  'record-artifact': {
    ...runtimeDescriptions['record-artifact']!,
    summary: 'Record a completed artifact in the event stream',
    parameters: [
      { name: 'feature', type: 'string' as const, required: true },
      { name: 'artifact', type: 'string' as const, required: true },
      { name: 'stage', type: 'number' as const, required: true }
    ]
  },
  'get-ready-artifacts': {
    ...runtimeDescriptions['get-ready-artifacts']!,
    summary: 'Inspect artifact DAG readiness',
    parameters: [
      { name: 'feature', type: 'string' as const, required: true },
      { name: 'artifact', type: 'string' as const, required: false }
    ],
    options: [
      ...runtimeFieldOptions,
      { name: 'can-start', type: 'boolean' as const, default: false },
      { name: 'ready', type: 'boolean' as const, default: false },
      { name: 'dag', type: 'string' as const }
    ]
  },
  'evaluate-gates': {
    ...runtimeDescriptions['evaluate-gates']!,
    summary: 'Evaluate a quality gate or preview the gate action',
    parameters: [
      { name: 'feature', type: 'string' as const, required: true },
      { name: 'gate', type: 'string' as const, required: true }
    ]
  },
  'check-stage': {
    ...runtimeDescriptions['check-stage']!,
    summary: 'Check stage state, readiness, retryability, or agents',
    parameters: [
      { name: 'feature', type: 'string' as const, required: true },
      { name: 'stage', type: 'number' as const, required: false }
    ],
    options: [
      ...runtimeFieldOptions,
      { name: 'can-proceed', type: 'boolean' as const, default: false },
      { name: 'can-retry', type: 'boolean' as const, default: false },
      { name: 'agents', type: 'boolean' as const, default: false },
      { name: 'summary', type: 'boolean' as const, default: false }
    ]
  },
  'replay-events': {
    ...runtimeDescriptions['replay-events']!,
    summary: 'Replay recent events or inspect a snapshot at an event id',
    parameters: [{ name: 'feature', type: 'string' as const, required: true }],
    options: [
      ...runtimeListOptions,
      { name: 'at', type: 'string' as const },
      { name: 'type', type: 'string' as const },
      { name: 'compact', type: 'boolean' as const, default: false }
    ]
  },
  'inspect-progress': {
    ...runtimeDescriptions['inspect-progress']!,
    summary: 'Inspect recent progress events',
    parameters: [{ name: 'feature', type: 'string' as const, required: true }],
    options: [...runtimeListOptions, { name: 'type', type: 'string' as const }]
  },
  'inspect-pipeline': {
    ...runtimeDescriptions['inspect-pipeline']!,
    summary: 'Inspect current pipeline state',
    parameters: [{ name: 'feature', type: 'string' as const, required: true }]
  },
  'inspect-events': {
    ...runtimeDescriptions['inspect-events']!,
    summary: 'Inspect recent runtime events',
    parameters: [{ name: 'feature', type: 'string' as const, required: true }],
    options: [...runtimeListOptions, { name: 'type', type: 'string' as const }]
  },
  'inspect-plugins': {
    ...runtimeDescriptions['inspect-plugins']!,
    summary: 'Inspect plugin lifecycle state',
    parameters: [{ name: 'feature', type: 'string' as const, required: true }]
  },
  'render-diagnostics': {
    ...runtimeDescriptions['render-diagnostics']!,
    summary: 'Render an HTML diagnostics report',
    parameters: [{ name: 'feature', type: 'string' as const, required: true }]
  },
  'extract-memory': {
    ...runtimeDescriptions['extract-memory']!,
    summary: 'Extract feature memory from events and execution state',
    parameters: [{ name: 'feature', type: 'string' as const, required: true }]
  },
  'query-memory': {
    ...runtimeDescriptions['query-memory']!,
    summary: 'Query feature memory summary',
    parameters: [{ name: 'feature', type: 'string' as const, required: true }],
    options: [...runtimeFieldOptions, { name: 'startup', type: 'boolean' as const, default: false }]
  },
  'build-memory-summary': {
    ...runtimeDescriptions['build-memory-summary']!,
    summary: 'Build feature memory startup summary',
    parameters: [{ name: 'feature', type: 'string' as const, required: true }]
  },
  'generate-summary': {
    ...runtimeDescriptions['generate-summary']!,
    summary: 'Generate markdown or JSON pipeline summary report',
    parameters: [{ name: 'feature', type: 'string' as const, required: true }]
  },
  'register-plugins': {
    ...runtimeDescriptions['register-plugins']!,
    summary: 'List, validate, or register Boss plugins into the event-sourced read model',
    parameters: [],
    options: [
      ...runtimeMutationOptions,
      { name: 'list', type: 'boolean' as const, default: false },
      { name: 'validate', type: 'boolean' as const, default: false },
      { name: 'register', type: 'string' as const },
      { name: 'type', type: 'string' as const }
    ]
  },
  'run-plugin-hook': {
    ...runtimeDescriptions['run-plugin-hook']!,
    summary: 'Run matching plugin hooks for a feature',
    parameters: [
      { name: 'hook', type: 'string' as const, required: true },
      { name: 'feature', type: 'string' as const, required: true }
    ],
    options: [...runtimeMutationOptions, { name: 'stage', type: 'number' as const }]
  },
  'record-feedback': {
    ...runtimeDescriptions['record-feedback']!,
    summary: 'Record a feedback loop revision request',
    parameters: [{ name: 'feature', type: 'string' as const, required: true }],
    options: [
      ...runtimeMutationOptions,
      { name: 'from', type: 'string' as const },
      { name: 'to', type: 'string' as const },
      { name: 'artifact', type: 'string' as const },
      { name: 'reason', type: 'string' as const },
      { name: 'priority', type: 'string' as const, default: 'recommended' }
    ]
  },
  'retry-agent': {
    ...runtimeDescriptions['retry-agent']!,
    summary: 'Retry a failed agent',
    parameters: [
      { name: 'feature', type: 'string' as const, required: true },
      { name: 'stage', type: 'number' as const, required: true },
      { name: 'agent', type: 'string' as const, required: true }
    ]
  },
  'retry-stage': {
    ...runtimeDescriptions['retry-stage']!,
    summary: 'Retry a failed stage',
    parameters: [
      { name: 'feature', type: 'string' as const, required: true },
      { name: 'stage', type: 'number' as const, required: true }
    ]
  }
});

export const runtimeCommandDescriptions: Record<string, CommandDescription> = runtimeDescriptions;
