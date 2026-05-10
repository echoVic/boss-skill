import type { KnowledgeRecord } from './store.js';
import type { KnowledgeJob } from './jobs.js';

export interface KnowledgeExtractionResult {
  records: KnowledgeRecord[];
}

export interface KnowledgeLlmClient {
  extract(
    input: KnowledgeJob['payload'],
    job?: KnowledgeJob
  ): Promise<KnowledgeExtractionResult>;
}

export class MissingKnowledgeClient implements KnowledgeLlmClient {
  async extract(): Promise<KnowledgeExtractionResult> {
    throw new Error('No knowledge LLM client configured');
  }
}

export function createDefaultKnowledgeClient(): KnowledgeLlmClient {
  return new MissingKnowledgeClient();
}
