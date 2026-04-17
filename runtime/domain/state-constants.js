const PIPELINE_STATUS = Object.freeze({
  INITIALIZED: 'initialized',
  RUNNING: 'running',
  COMPLETED: 'completed',
  FAILED: 'failed'
});

const STAGE_STATUS = Object.freeze({
  PENDING: 'pending',
  RUNNING: 'running',
  COMPLETED: 'completed',
  FAILED: 'failed',
  RETRYING: 'retrying',
  SKIPPED: 'skipped'
});

const AGENT_STATUS = Object.freeze({
  PENDING: 'pending',
  RUNNING: 'running',
  COMPLETED: 'completed',
  FAILED: 'failed'
});

const DEFAULT_SCHEMA_VERSION = '0.2.0';

export {
  PIPELINE_STATUS,
  STAGE_STATUS,
  AGENT_STATUS,
  DEFAULT_SCHEMA_VERSION
};
