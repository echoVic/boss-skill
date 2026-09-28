export function normalizeDriverName(value) {
    if (value === 'claude-code' || value === 'codex' || value === 'generic') {
        return value;
    }
    return 'generic';
}
export function resolveDriverCapabilities(value) {
    const name = normalizeDriverName(value);
    if (name === 'claude-code') {
        return {
            name,
            hooks: true,
            checkpointPrompt: false,
            stopGuards: true,
            subagents: true,
        };
    }
    return {
        name,
        hooks: false,
        checkpointPrompt: true,
        stopGuards: false,
        subagents: false,
    };
}
