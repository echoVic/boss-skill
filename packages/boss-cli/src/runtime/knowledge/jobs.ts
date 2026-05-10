import * as fs from 'node:fs';
import * as path from 'node:path';

import {
  saveGlobalKnowledge,
  saveProjectKnowledge,
  type KnowledgeRecord,
  type KnowledgeSource
} from './store.js';
import {
  createDefaultKnowledgeClient,
  type KnowledgeLlmClient
} from './client.js';
import { validateKnowledgeExtractionResult } from './extractor.js';
import { promoteStableRecords } from './promote.js';

export interface KnowledgeJobPayload {
  sources: KnowledgeSource[];
  summary?: unknown;
  [key: string]: unknown;
}

export type KnowledgeJobStatus = 'pending' | 'processing' | 'succeeded' | 'failed';

export interface KnowledgeJob {
  id: string;
  feature: string;
  scope: 'project' | 'global';
  status: KnowledgeJobStatus;
  payload: KnowledgeJobPayload;
  attempts: number;
  createdAt: string;
  updatedAt: string;
  error?: string;
}

export interface ProcessKnowledgeJobsResult {
  processed: number;
  failed: number;
}

function knowledgeJobsPath(cwd: string, feature: string): string {
  return path.join(cwd, '.boss', feature, '.meta', 'knowledge-jobs.jsonl');
}

function appendJsonLine(filePath: string, value: unknown): void {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.appendFileSync(filePath, `${JSON.stringify(value)}\n`, 'utf8');
}

function createJobId(): string {
  return `knowledge-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

function cloneJob(job: KnowledgeJob): KnowledgeJob {
  return {
    ...job,
    payload: {
      ...job.payload,
      sources: job.payload.sources.map((source) => ({ ...source }))
    }
  };
}

function jobUpdate(job: KnowledgeJob, status: KnowledgeJobStatus, error?: string): KnowledgeJob {
  return {
    ...cloneJob(job),
    status,
    attempts: status === 'processing' ? job.attempts + 1 : job.attempts,
    updatedAt: new Date().toISOString(),
    ...(error ? { error } : {})
  };
}

function latestJobs(entries: KnowledgeJob[]): Map<string, KnowledgeJob> {
  const latest = new Map<string, KnowledgeJob>();
  for (const entry of entries) {
    latest.set(entry.id, entry);
  }
  return latest;
}

function splitRecords(records: KnowledgeRecord[]): {
  projectRecords: KnowledgeRecord[];
  globalRecords: KnowledgeRecord[];
} {
  return {
    projectRecords: records.filter((record) => record.scope === 'project'),
    globalRecords: records.filter((record) => record.scope === 'global')
  };
}

export function enqueueKnowledgeJob(
  feature: string,
  payload: KnowledgeJobPayload,
  { cwd = process.cwd() }: { cwd?: string } = {}
): KnowledgeJob {
  const now = new Date().toISOString();
  const job: KnowledgeJob = {
    id: createJobId(),
    feature,
    scope: 'project',
    status: 'pending',
    payload: {
      ...payload,
      sources: payload.sources.map((source) => ({ ...source }))
    },
    attempts: 0,
    createdAt: now,
    updatedAt: now
  };

  appendJsonLine(knowledgeJobsPath(cwd, feature), job);
  return cloneJob(job);
}

export function readKnowledgeJobs(
  feature: string,
  { cwd = process.cwd() }: { cwd?: string } = {}
): KnowledgeJob[] {
  const filePath = knowledgeJobsPath(cwd, feature);
  if (!fs.existsSync(filePath)) return [];

  return fs
    .readFileSync(filePath, 'utf8')
    .split('\n')
    .filter((line) => line.trim().length > 0)
    .map((line) => JSON.parse(line) as KnowledgeJob);
}

export async function processKnowledgeJobs(
  feature: string,
  {
    cwd = process.cwd(),
    client = createDefaultKnowledgeClient()
  }: { cwd?: string; client?: KnowledgeLlmClient } = {}
): Promise<ProcessKnowledgeJobsResult> {
  const filePath = knowledgeJobsPath(cwd, feature);
  const pending = [...latestJobs(readKnowledgeJobs(feature, { cwd })).values()].filter(
    (job) => job.status === 'pending'
  );
  let processed = 0;
  let failed = 0;

  for (const job of pending) {
    const processing = jobUpdate(job, 'processing');
    appendJsonLine(filePath, processing);

    try {
      const extracted = validateKnowledgeExtractionResult(await client.extract(job.payload, job));
      const { projectRecords, globalRecords } = splitRecords(extracted.records);
      if (projectRecords.length > 0) {
        saveProjectKnowledge(feature, projectRecords, { cwd });
      }

      const promotedRecords = promoteStableRecords(projectRecords);
      const allGlobalRecords = [...globalRecords, ...promotedRecords];
      if (allGlobalRecords.length > 0) {
        saveGlobalKnowledge(allGlobalRecords, { cwd });
      }

      appendJsonLine(filePath, jobUpdate(processing, 'succeeded'));
      processed += 1;
    } catch (err) {
      appendJsonLine(filePath, jobUpdate(processing, 'failed', (err as Error).message));
      failed += 1;
    }
  }

  return { processed, failed };
}

export const paths = {
  knowledgeJobsPath
};
