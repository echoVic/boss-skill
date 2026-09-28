export const PIPELINE_STATUS = Object.freeze({
    INITIALIZED: 'initialized',
    RUNNING: 'running',
    PAUSED: 'paused',
    COMPLETED: 'completed',
    FAILED: 'failed',
});
export const STAGE_STATUS = Object.freeze({
    PENDING: 'pending',
    RUNNING: 'running',
    COMPLETED: 'completed',
    FAILED: 'failed',
    RETRYING: 'retrying',
    SKIPPED: 'skipped',
});
export const AGENT_STATUS = Object.freeze({
    PENDING: 'pending',
    RUNNING: 'running',
    COMPLETED: 'completed',
    FAILED: 'failed',
});
export const DEFAULT_SCHEMA_VERSION = '0.2.0';
