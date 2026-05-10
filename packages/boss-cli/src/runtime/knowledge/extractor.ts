import type { KnowledgeExtractionResult } from './client.js';
import type { KnowledgeRecord } from './store.js';

const KNOWLEDGE_SCOPES = new Set(['project', 'global']);
const KNOWLEDGE_KINDS = new Set(['preference', 'fact', 'decision', 'lesson']);

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isString(value: unknown): value is string {
  return typeof value === 'string' && value.length > 0;
}

function isNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value);
}

function validateEvidence(value: unknown): boolean {
  return isObject(value) && isString(value.type) && isString(value.ref);
}

function validateConfidence(value: unknown): boolean {
  return isNumber(value) && value >= 0 && value <= 1;
}

function validateDecayScore(value: unknown): boolean {
  return isNumber(value) && value >= 0;
}

export function validateKnowledgeRecord(value: unknown, index = 0): KnowledgeRecord {
  if (!isObject(value)) {
    throw new Error(`Invalid knowledge record at index ${index}: expected object`);
  }

  const failures: string[] = [];
  if (!isString(value.id)) failures.push('id');
  if (!isString(value.scope) || !KNOWLEDGE_SCOPES.has(value.scope)) failures.push('scope');
  if (!isString(value.kind) || !KNOWLEDGE_KINDS.has(value.kind)) failures.push('kind');
  if (!isString(value.category)) failures.push('category');
  if (!isString(value.subject)) failures.push('subject');
  if (!isString(value.summary)) failures.push('summary');
  if (!isObject(value.source) || !isString(value.source.type)) failures.push('source');
  if (!Array.isArray(value.evidence) || !value.evidence.every(validateEvidence)) failures.push('evidence');
  if (!validateConfidence(value.confidence)) failures.push('confidence');
  if (!isString(value.createdAt)) failures.push('createdAt');
  if (!isString(value.lastSeenAt)) failures.push('lastSeenAt');
  if (!(value.expiresAt === null || isString(value.expiresAt))) failures.push('expiresAt');
  if (!validateDecayScore(value.decayScore)) failures.push('decayScore');

  if (failures.length > 0) {
    throw new Error(`Invalid knowledge record at index ${index}: missing or invalid ${failures.join(', ')}`);
  }

  return value as unknown as KnowledgeRecord;
}

export function validateKnowledgeExtractionResult(value: unknown): KnowledgeExtractionResult {
  if (!isObject(value) || !Array.isArray(value.records)) {
    throw new Error('Invalid knowledge extraction result: expected records array');
  }

  return {
    records: value.records.map((record, index) => validateKnowledgeRecord(record, index))
  };
}
