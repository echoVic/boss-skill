import { AGENT_REPORT_STATUS_VALUES } from '../runtime/domain/agent-report.js';
export const commonOptions = [
    { name: 'json', type: 'boolean', default: false },
    { name: 'describe', type: 'boolean', default: false },
    { name: 'fields', type: 'string' },
    { name: 'limit', type: 'string', default: '100' },
    { name: 'json-input', type: 'string' },
    { name: 'dry-run', type: 'boolean', default: false },
    { name: 'yes', type: 'boolean', short: 'y', default: false },
];
export const runtimeBaseOptions = [
    { name: 'json', type: 'boolean', default: false },
    { name: 'describe', type: 'boolean', default: false },
];
export const topLevelDriverOptions = [
    ...runtimeBaseOptions,
    { name: 'driver', type: 'string', default: 'generic' },
];
export const runtimeFieldOptions = [
    ...runtimeBaseOptions,
    { name: 'fields', type: 'string' },
];
export const runtimeListOptions = [
    ...runtimeFieldOptions,
    { name: 'limit', type: 'string', default: '20' },
];
export const runtimeDryRunOptions = [
    ...runtimeFieldOptions,
    { name: 'dry-run', type: 'boolean', default: false },
];
export const runtimeMutationOptions = [
    ...runtimeDryRunOptions,
    { name: 'json-input', type: 'string' },
];
export const runtimeHighRiskOptions = [
    ...runtimeMutationOptions,
    { name: 'yes', type: 'boolean', short: 'y', default: false },
];
export const rootDescription = {
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
        { name: 'yes', type: 'boolean', short: 'y', default: false },
    ],
    risk_tier: 'low',
};
export const runtimeDescription = {
    ...rootDescription,
    command: 'boss runtime',
    summary: 'Run Boss runtime commands',
};
export const gateDescription = {
    command: 'boss gate',
    summary: 'Evaluate Boss quality gates',
    parameters: [{ name: 'feature', type: 'string', required: true }],
    options: [...runtimeBaseOptions, { name: 'gate', type: 'string', default: 'gate1' }],
    risk_tier: 'medium',
};
export const qaDescription = {
    command: 'boss qa',
    summary: 'Run Boss QA attack checks',
    parameters: [{ name: 'command', type: 'string', required: false }],
    options: runtimeBaseOptions,
    risk_tier: 'medium',
};
export const designDescription = {
    ...rootDescription,
    command: 'boss design',
    summary: 'Preview Boss UI design artifacts',
};
export const projectDescription = {
    ...rootDescription,
    command: 'boss project',
    summary: 'Initialize .boss feature workspaces',
};
export const artifactDescription = {
    ...rootDescription,
    command: 'boss artifact',
    summary: 'Prepare artifacts from templates',
};
export const packsDescription = {
    ...rootDescription,
    command: 'boss packs',
    summary: 'Detect pipeline packs',
};
export const hooksDescription = {
    ...rootDescription,
    command: 'boss hooks',
    summary: 'Run Boss hooks',
};
export const designPreviewOptions = [
    ...runtimeBaseOptions,
    { name: 'no-open', type: 'boolean', default: false },
    { name: 'port', type: 'string', default: '0' },
];
export const commandDescriptions = {
    'boss design preview': {
        command: 'boss design preview',
        summary: 'Preview .boss/<feature>/ui-design.json in a local browser',
        parameters: [{ name: 'feature', type: 'string', required: true }],
        options: designPreviewOptions,
        risk_tier: 'low',
    },
    'boss project init': {
        command: 'boss project init',
        summary: 'Initialize a Boss feature workspace',
        parameters: [{ name: 'feature', type: 'string', required: true }],
        options: [
            ...commonOptions,
            { name: 'template', type: 'boolean', short: 't', default: false },
            { name: 'force', type: 'boolean', short: 'f', default: false },
        ],
        risk_tier: 'medium',
    },
    'boss artifact prepare': {
        command: 'boss artifact prepare',
        summary: 'Prepare an artifact from project or built-in templates',
        parameters: [
            { name: 'feature', type: 'string', required: true },
            { name: 'artifact', type: 'string', required: true },
            { name: 'template', type: 'string', required: false },
        ],
        options: commonOptions,
        risk_tier: 'medium',
    },
    'boss packs detect': {
        command: 'boss packs detect',
        summary: 'Detect the best pipeline pack for a project directory',
        parameters: [{ name: 'projectDir', type: 'string', required: false, default: '.' }],
        options: commonOptions,
        risk_tier: 'low',
    },
    'boss install': {
        command: 'boss install',
        summary: 'Install the thin Boss skill bundle into detected agents',
        parameters: [],
        options: commonOptions,
        risk_tier: 'medium',
    },
    'boss status': {
        command: 'boss status',
        summary: 'Inspect Boss pipeline state and next checkpoint',
        parameters: [{ name: 'feature', type: 'string', required: true }],
        options: topLevelDriverOptions,
        risk_tier: 'low',
    },
    'boss continue': {
        command: 'boss continue',
        summary: 'Advance a Boss pipeline to the next safe checkpoint',
        parameters: [{ name: 'feature', type: 'string', required: true }],
        options: topLevelDriverOptions,
        risk_tier: 'medium',
    },
    'boss launch': {
        command: 'boss launch',
        summary: 'Launch a Boss pipeline and return a run handle',
        parameters: [{ name: 'feature', type: 'string', required: true }],
        options: runtimeMutationOptions,
        risk_tier: 'medium',
    },
    'boss attach': {
        command: 'boss attach',
        summary: 'Attach to an existing Boss pipeline handle',
        parameters: [{ name: 'feature', type: 'string', required: true }],
        options: runtimeFieldOptions,
        risk_tier: 'low',
    },
    'boss pause': {
        command: 'boss pause',
        summary: 'Pause a Boss pipeline at a checkpoint-safe boundary',
        parameters: [{ name: 'feature', type: 'string', required: true }],
        options: [
            ...runtimeMutationOptions,
            { name: 'reason', type: 'string' },
            { name: 'requested-by', type: 'string' },
        ],
        risk_tier: 'medium',
    },
    'boss gate': {
        command: 'boss gate',
        summary: 'Evaluate a Boss runtime gate',
        parameters: [{ name: 'feature', type: 'string', required: true }],
        options: [...runtimeBaseOptions, { name: 'gate', type: 'string', default: 'gate1' }],
        risk_tier: 'medium',
    },
    'boss gate final': {
        command: 'boss gate final',
        summary: 'Evaluate final Boss completion gate',
        parameters: [{ name: 'feature', type: 'string', required: true }],
        options: runtimeBaseOptions,
        risk_tier: 'low',
    },
    'boss qa': {
        command: 'boss qa',
        summary: 'Run Boss QA commands',
        parameters: [{ name: 'command', type: 'string', required: false }],
        options: runtimeBaseOptions,
        risk_tier: 'medium',
    },
    'boss qa attack': {
        command: 'boss qa attack',
        summary: 'Run structured Boss QA attack checks',
        parameters: [{ name: 'feature', type: 'string', required: true }],
        options: runtimeBaseOptions,
        risk_tier: 'medium',
    },
    'boss uninstall': {
        command: 'boss uninstall',
        summary: 'Remove copied Boss skill bundles from detected agents',
        parameters: [],
        options: commonOptions,
        risk_tier: 'high',
    },
    'boss path': {
        command: 'boss path',
        summary: 'Print the package root used for Claude plugin mode',
        parameters: [],
        options: commonOptions,
        risk_tier: 'low',
    },
    'boss doctor': {
        command: 'boss doctor',
        summary: 'Diagnose install locations, version drift, event-stream integrity, and orphan locks',
        parameters: [],
        options: commonOptions,
        risk_tier: 'low',
    },
    'boss hooks run': {
        command: 'boss hooks run',
        summary: 'Run a Boss hook through the hook dispatcher',
        parameters: [
            { name: 'hookId', type: 'string', required: true },
            { name: 'scriptRelativePath', type: 'string', required: true },
            { name: 'profilesCsv', type: 'string', required: false },
        ],
        options: commonOptions,
        risk_tier: 'medium',
    },
};
export const runtimeCommandNames = [
    'init-pipeline',
    'launch',
    'attach',
    'pause',
    'resume',
    'update-stage',
    'update-agent',
    'report-agent-status',
    'agent-cache',
    'record-artifact',
    'get-ready-artifacts',
    'evaluate-gates',
    'check-stage',
    'rebuild-state',
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
    'record-user-choice',
    'open-conversation',
    'append-conversation-message',
    'resolve-conversation',
    'materialize-todo',
    'list-conversations',
    'list-todos',
    'retry-agent',
    'retry-stage',
    'verify-wave',
    'verify-requirements',
];
const runtimeDescriptions = {};
for (const name of runtimeCommandNames) {
    runtimeDescriptions[name] = {
        command: `boss runtime ${name}`,
        summary: `Run runtime command ${name}`,
        parameters: [{ name: 'feature', type: 'string', required: false }],
        options: runtimeBaseOptions,
        risk_tier: 'low',
    };
}
for (const name of [
    'check-stage',
    'get-ready-artifacts',
    'inspect-pipeline',
    'inspect-plugins',
    'query-memory',
    'list-conversations',
    'list-todos',
]) {
    runtimeDescriptions[name] = {
        ...runtimeDescriptions[name],
        options: runtimeFieldOptions,
    };
}
for (const name of ['inspect-events', 'inspect-progress', 'replay-events']) {
    runtimeDescriptions[name] = {
        ...runtimeDescriptions[name],
        options: runtimeListOptions,
    };
}
for (const name of ['generate-summary', 'render-diagnostics']) {
    runtimeDescriptions[name] = {
        ...runtimeDescriptions[name],
        options: [
            ...runtimeDryRunOptions,
            { name: 'stdout', type: 'boolean', default: false },
        ],
        risk_tier: 'medium',
    };
}
for (const name of ['build-memory-summary', 'extract-memory']) {
    runtimeDescriptions[name] = {
        ...runtimeDescriptions[name],
        options: runtimeDryRunOptions,
        risk_tier: 'medium',
    };
}
for (const name of [
    'init-pipeline',
    'launch',
    'update-stage',
    'update-agent',
    'report-agent-status',
    'pause',
    'resume',
    'record-artifact',
    'record-feedback',
    'record-user-choice',
    'open-conversation',
    'append-conversation-message',
    'resolve-conversation',
    'materialize-todo',
    'register-plugins',
    'run-plugin-hook',
    'verify-wave',
    'verify-requirements',
]) {
    runtimeDescriptions[name] = {
        ...runtimeDescriptions[name],
        options: runtimeMutationOptions,
        risk_tier: 'medium',
    };
}
runtimeDescriptions['record-artifact'] = {
    ...runtimeDescriptions['record-artifact'],
    options: [
        ...runtimeMutationOptions,
        { name: 'no-open', type: 'boolean', default: false },
    ],
    risk_tier: 'medium',
};
runtimeDescriptions['report-agent-status'] = {
    ...runtimeDescriptions['report-agent-status'],
    summary: 'Report a subagent terminal status through a validated enum instead of a prose status block',
    parameters: [
        { name: 'feature', type: 'string', required: true },
        { name: 'stage', type: 'string', required: true },
        { name: 'agent', type: 'string', required: true },
        {
            name: 'status',
            type: 'string',
            required: true,
            enum: [...AGENT_REPORT_STATUS_VALUES],
        },
    ],
    options: [...runtimeMutationOptions, { name: 'reason', type: 'string' }],
    risk_tier: 'medium',
};
runtimeDescriptions['evaluate-gates'] = {
    ...runtimeDescriptions['evaluate-gates'],
    options: [
        ...runtimeMutationOptions,
        { name: 'skip-on-error', type: 'boolean', default: false },
    ],
    risk_tier: 'medium',
};
for (const name of ['retry-agent', 'retry-stage']) {
    runtimeDescriptions[name] = {
        ...runtimeDescriptions[name],
        options: runtimeHighRiskOptions,
        risk_tier: 'high',
    };
}
Object.assign(runtimeDescriptions, {
    'init-pipeline': {
        ...runtimeDescriptions['init-pipeline'],
        summary: 'Initialize a Boss feature pipeline',
        parameters: [{ name: 'feature', type: 'string', required: true }],
    },
    launch: {
        ...runtimeDescriptions.launch,
        summary: 'Launch a Boss pipeline and return a stable run handle',
        parameters: [{ name: 'feature', type: 'string', required: true }],
    },
    attach: {
        ...runtimeDescriptions.attach,
        summary: 'Attach to an existing Boss pipeline handle',
        parameters: [{ name: 'feature', type: 'string', required: true }],
        options: runtimeFieldOptions,
    },
    'update-stage': {
        ...runtimeDescriptions['update-stage'],
        summary: 'Update stage status and optionally record a gate result',
        parameters: [
            { name: 'feature', type: 'string', required: true },
            { name: 'stage', type: 'number', required: true },
            {
                name: 'status',
                type: 'string',
                required: true,
                enum: ['running', 'completed', 'failed', 'retrying', 'skipped'],
            },
        ],
        options: [
            ...runtimeMutationOptions,
            { name: 'reason', type: 'string' },
            { name: 'gate', type: 'string' },
            { name: 'gate-passed', type: 'boolean', default: false },
            { name: 'gate-failed', type: 'boolean', default: false },
        ],
    },
    'update-agent': {
        ...runtimeDescriptions['update-agent'],
        summary: 'Update an agent status within a stage',
        parameters: [
            { name: 'feature', type: 'string', required: true },
            { name: 'stage', type: 'number', required: true },
            { name: 'agent', type: 'string', required: true },
            {
                name: 'status',
                type: 'string',
                required: true,
                enum: ['running', 'completed', 'failed'],
            },
        ],
        options: [
            ...runtimeMutationOptions,
            { name: 'reason', type: 'string' },
            { name: 'prompt', type: 'string' },
            { name: 'prompt-fingerprint', type: 'string' },
            { name: 'depends-on', type: 'string' },
            { name: 'opts', type: 'string' },
        ],
    },
    pause: {
        ...runtimeDescriptions.pause,
        summary: 'Pause a Boss pipeline at a checkpoint-safe boundary',
        parameters: [{ name: 'feature', type: 'string', required: true }],
        options: [
            ...runtimeMutationOptions,
            { name: 'reason', type: 'string' },
            { name: 'requested-by', type: 'string' },
        ],
    },
    resume: {
        ...runtimeDescriptions.resume,
        summary: 'Resume a Boss workflow run and report node-level reuse decisions',
        parameters: [{ name: 'feature', type: 'string', required: true }],
        options: [...runtimeMutationOptions, { name: 'from-run', type: 'string' }],
    },
    'agent-cache': {
        ...runtimeDescriptions['agent-cache'],
        summary: 'Check whether a completed agent run can be reused for the same prompt and inputs',
        parameters: [
            { name: 'feature', type: 'string', required: true },
            { name: 'stage', type: 'number', required: true },
            { name: 'agent', type: 'string', required: true },
        ],
        options: [
            ...runtimeFieldOptions,
            { name: 'prompt', type: 'string' },
            { name: 'prompt-fingerprint', type: 'string' },
            { name: 'depends-on', type: 'string' },
            { name: 'opts', type: 'string' },
        ],
    },
    'record-artifact': {
        ...runtimeDescriptions['record-artifact'],
        summary: 'Record a completed artifact in the event stream',
        parameters: [
            { name: 'feature', type: 'string', required: true },
            { name: 'artifact', type: 'string', required: true },
            { name: 'stage', type: 'number', required: true },
        ],
    },
    'get-ready-artifacts': {
        ...runtimeDescriptions['get-ready-artifacts'],
        summary: 'Inspect artifact DAG readiness',
        parameters: [
            { name: 'feature', type: 'string', required: true },
            { name: 'artifact', type: 'string', required: false },
        ],
        options: [
            ...runtimeFieldOptions,
            { name: 'can-start', type: 'boolean', default: false },
            { name: 'ready', type: 'boolean', default: false },
            { name: 'dag', type: 'string' },
        ],
    },
    'evaluate-gates': {
        ...runtimeDescriptions['evaluate-gates'],
        summary: 'Evaluate a quality gate or preview the gate action',
        parameters: [
            { name: 'feature', type: 'string', required: true },
            { name: 'gate', type: 'string', required: true },
        ],
    },
    'check-stage': {
        ...runtimeDescriptions['check-stage'],
        summary: 'Check stage state, readiness, retryability, or agents',
        parameters: [
            { name: 'feature', type: 'string', required: true },
            { name: 'stage', type: 'number', required: false },
        ],
        options: [
            ...runtimeFieldOptions,
            { name: 'can-proceed', type: 'boolean', default: false },
            { name: 'can-retry', type: 'boolean', default: false },
            { name: 'agents', type: 'boolean', default: false },
            { name: 'summary', type: 'boolean', default: false },
        ],
    },
    'replay-events': {
        ...runtimeDescriptions['replay-events'],
        summary: 'Replay recent events or inspect a snapshot at an event id',
        parameters: [{ name: 'feature', type: 'string', required: true }],
        options: [
            ...runtimeListOptions,
            { name: 'at', type: 'string' },
            { name: 'type', type: 'string' },
            { name: 'compact', type: 'boolean', default: false },
        ],
    },
    'inspect-progress': {
        ...runtimeDescriptions['inspect-progress'],
        summary: 'Inspect recent progress events',
        parameters: [{ name: 'feature', type: 'string', required: true }],
        options: [...runtimeListOptions, { name: 'type', type: 'string' }],
    },
    'inspect-pipeline': {
        ...runtimeDescriptions['inspect-pipeline'],
        summary: 'Inspect current pipeline state',
        parameters: [{ name: 'feature', type: 'string', required: true }],
    },
    'inspect-events': {
        ...runtimeDescriptions['inspect-events'],
        summary: 'Inspect recent runtime events',
        parameters: [{ name: 'feature', type: 'string', required: true }],
        options: [...runtimeListOptions, { name: 'type', type: 'string' }],
    },
    'inspect-plugins': {
        ...runtimeDescriptions['inspect-plugins'],
        summary: 'Inspect plugin lifecycle state',
        parameters: [{ name: 'feature', type: 'string', required: true }],
    },
    'render-diagnostics': {
        ...runtimeDescriptions['render-diagnostics'],
        summary: 'Render an HTML diagnostics report',
        parameters: [{ name: 'feature', type: 'string', required: true }],
    },
    'extract-memory': {
        ...runtimeDescriptions['extract-memory'],
        summary: 'Extract feature memory from events and execution state',
        parameters: [{ name: 'feature', type: 'string', required: true }],
    },
    'query-memory': {
        ...runtimeDescriptions['query-memory'],
        summary: 'Query feature memory summary',
        parameters: [{ name: 'feature', type: 'string', required: true }],
        options: [
            ...runtimeListOptions,
            { name: 'startup', type: 'boolean', default: false },
            { name: 'agent', type: 'string' },
            { name: 'stage', type: 'number' },
        ],
    },
    'build-memory-summary': {
        ...runtimeDescriptions['build-memory-summary'],
        summary: 'Build feature memory startup summary',
        parameters: [{ name: 'feature', type: 'string', required: true }],
    },
    'generate-summary': {
        ...runtimeDescriptions['generate-summary'],
        summary: 'Generate markdown or JSON pipeline summary report',
        parameters: [{ name: 'feature', type: 'string', required: true }],
    },
    'register-plugins': {
        ...runtimeDescriptions['register-plugins'],
        summary: 'List, validate, or register Boss plugins into the event-sourced read model',
        parameters: [{ name: 'feature', type: 'string', required: false }],
        options: [
            ...runtimeMutationOptions,
            { name: 'list', type: 'boolean', default: false },
            { name: 'validate', type: 'boolean', default: false },
            { name: 'register', type: 'string' },
            { name: 'type', type: 'string' },
        ],
    },
    'run-plugin-hook': {
        ...runtimeDescriptions['run-plugin-hook'],
        summary: 'Run matching plugin hooks for a feature',
        parameters: [
            { name: 'hook', type: 'string', required: true },
            { name: 'feature', type: 'string', required: true },
        ],
        options: [...runtimeMutationOptions, { name: 'stage', type: 'number' }],
    },
    'record-feedback': {
        ...runtimeDescriptions['record-feedback'],
        summary: 'Record a feedback loop revision request',
        parameters: [{ name: 'feature', type: 'string', required: true }],
        options: [
            ...runtimeMutationOptions,
            { name: 'from', type: 'string' },
            { name: 'to', type: 'string' },
            { name: 'artifact', type: 'string' },
            { name: 'reason', type: 'string' },
            { name: 'priority', type: 'string', default: 'recommended' },
        ],
    },
    'record-user-choice': {
        ...runtimeDescriptions['record-user-choice'],
        summary: 'Record a user choice as a durable preference in the event stream',
        parameters: [{ name: 'feature', type: 'string', required: true }],
        options: [
            ...runtimeMutationOptions,
            { name: 'choice-type', type: 'string' },
            { name: 'selected', type: 'string' },
            { name: 'options', type: 'string' },
            { name: 'reason', type: 'string' },
            { name: 'agent', type: 'string' },
            { name: 'stage', type: 'string' },
        ],
    },
    'open-conversation': {
        ...runtimeDescriptions['open-conversation'],
        summary: 'Open an execution-time conversation thread',
        parameters: [{ name: 'feature', type: 'string', required: true }],
        options: [
            ...runtimeMutationOptions,
            { name: 'kind', type: 'string', default: 'ask' },
            { name: 'artifact', type: 'string' },
            { name: 'task', type: 'string' },
            { name: 'scope', type: 'string' },
            { name: 'decision', type: 'string' },
            { name: 'initiator', type: 'string' },
            { name: 'participants', type: 'string' },
            { name: 'priority', type: 'string', default: 'medium' },
        ],
    },
    'append-conversation-message': {
        ...runtimeDescriptions['append-conversation-message'],
        summary: 'Append a short message to a conversation thread',
        parameters: [{ name: 'feature', type: 'string', required: true }],
        options: [
            ...runtimeMutationOptions,
            { name: 'thread-id', type: 'string' },
            { name: 'from', type: 'string' },
            { name: 'to', type: 'string' },
            { name: 'intent', type: 'string', default: 'question' },
            { name: 'content', type: 'string' },
        ],
    },
    'resolve-conversation': {
        ...runtimeDescriptions['resolve-conversation'],
        summary: 'Resolve a conversation and optionally materialize follow-up todos',
        parameters: [{ name: 'feature', type: 'string', required: true }],
        options: [
            ...runtimeMutationOptions,
            { name: 'thread-id', type: 'string' },
            { name: 'summary', type: 'string' },
            { name: 'decision', type: 'string' },
            { name: 'todo-title', type: 'string' },
            { name: 'todo-owner', type: 'string' },
            { name: 'todo-type', type: 'string', default: 'change' },
            { name: 'success-criteria', type: 'string' },
            { name: 'escalate-artifact', type: 'string' },
            { name: 'escalate-from', type: 'string' },
            { name: 'escalate-to', type: 'string' },
            { name: 'escalate-reason', type: 'string' },
            { name: 'escalate-priority', type: 'string', default: 'recommended' },
        ],
    },
    'materialize-todo': {
        ...runtimeDescriptions['materialize-todo'],
        summary: 'Materialize a derived todo from a conversation thread',
        parameters: [{ name: 'feature', type: 'string', required: true }],
        options: [
            ...runtimeMutationOptions,
            { name: 'thread-id', type: 'string' },
            { name: 'title', type: 'string' },
            { name: 'owner', type: 'string' },
            { name: 'type', type: 'string', default: 'change' },
            { name: 'success-criteria', type: 'string' },
            { name: 'status', type: 'string', default: 'pending' },
            { name: 'artifacts', type: 'string' },
            { name: 'scope', type: 'string' },
            { name: 'stage', type: 'number' },
            { name: 'agent', type: 'string' },
        ],
    },
    'list-conversations': {
        ...runtimeDescriptions['list-conversations'],
        summary: 'List conversation threads from execution state',
        parameters: [{ name: 'feature', type: 'string', required: true }],
    },
    'list-todos': {
        ...runtimeDescriptions['list-todos'],
        summary: 'List derived todos from execution state',
        parameters: [{ name: 'feature', type: 'string', required: true }],
    },
    'retry-agent': {
        ...runtimeDescriptions['retry-agent'],
        summary: 'Retry a failed agent',
        parameters: [
            { name: 'feature', type: 'string', required: true },
            { name: 'stage', type: 'number', required: true },
            { name: 'agent', type: 'string', required: true },
        ],
    },
    'retry-stage': {
        ...runtimeDescriptions['retry-stage'],
        summary: 'Retry a failed stage',
        parameters: [
            { name: 'feature', type: 'string', required: true },
            { name: 'stage', type: 'number', required: true },
        ],
    },
    'verify-wave': {
        ...runtimeDescriptions['verify-wave'],
        summary: 'Verify TDD red-green cycle for an evidence wave',
        parameters: [
            { name: 'feature', type: 'string', required: true },
            { name: 'waveId', type: 'string', required: true },
        ],
        options: [
            ...runtimeMutationOptions,
            { name: 'phase', type: 'string', default: 'full' },
        ],
    },
    'verify-requirements': {
        ...runtimeDescriptions['verify-requirements'],
        summary: 'Generate requirements traceability matrix from PRD acceptance criteria',
        parameters: [{ name: 'feature', type: 'string', required: true }],
        options: [...runtimeMutationOptions, { name: 'test-dir', type: 'string' }],
    },
});
export const runtimeCommandDescriptions = runtimeDescriptions;
