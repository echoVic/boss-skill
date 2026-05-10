import type { KnowledgeJob } from './jobs.js';
import type { KnowledgeRecord } from './store.js';

export interface KnowledgeExtractionResult {
  records: KnowledgeRecord[];
}

export interface KnowledgeLlmClient {
  extract(
    input: KnowledgeJob['payload'],
    job?: KnowledgeJob
  ): Promise<KnowledgeExtractionResult>;
}

interface OpenAIResponsesPayload {
  output?: Array<{
    content?: Array<{
      type?: string;
      text?: string;
    }>;
  }>;
  output_text?: string;
  error?: { message?: string };
}

function buildPrompt(input: KnowledgeJob['payload'], job?: KnowledgeJob): string {
  return [
    'Extract durable knowledge as strict JSON with the shape { "records": [...] }.',
    'Only include records that are factual, preference, decision, or lesson level durable knowledge.',
    'Every record must include id, scope, kind, category, subject, summary, source, evidence, confidence, createdAt, lastSeenAt, expiresAt, decayScore.',
    'Include agent and stage when the source clearly ties the knowledge to a specific agent or pipeline stage.',
    'Confidence must be between 0 and 1. decayScore must be non-negative.',
    'Prefer concise summaries and evidence that points back to the supplied sources.',
    `Job feature: ${job?.feature ?? 'unknown'}.`,
    `Sources: ${JSON.stringify(input.sources ?? [])}`,
    input.summary != null ? `Summary context: ${JSON.stringify(input.summary)}` : '',
    'Return JSON only.'
  ]
    .filter(Boolean)
    .join('\n');
}

function readConfig(): { apiKey: string; baseUrl: string; model: string } | null {
  const apiKey = process.env.BOSS_KNOWLEDGE_API_KEY || process.env.OPENAI_API_KEY;
  if (!apiKey) return null;

  return {
    apiKey,
    baseUrl: process.env.BOSS_KNOWLEDGE_BASE_URL || 'https://api.openai.com/v1',
    model: process.env.BOSS_KNOWLEDGE_MODEL || process.env.OPENAI_MODEL || 'gpt-4.1-mini'
  };
}

function extractText(payload: OpenAIResponsesPayload): string {
  if (typeof payload.output_text === 'string' && payload.output_text.trim()) {
    return payload.output_text;
  }

  for (const item of payload.output ?? []) {
    for (const content of item.content ?? []) {
      if (content.type === 'output_text' && typeof content.text === 'string' && content.text.trim()) {
        return content.text;
      }
    }
  }

  throw new Error(payload.error?.message || 'No text content returned from knowledge client');
}

export class OpenAIKnowledgeClient implements KnowledgeLlmClient {
  constructor(
    private readonly config: {
      apiKey: string;
      baseUrl: string;
      model: string;
    }
  ) {}

  async extract(
    input: KnowledgeJob['payload'],
    job?: KnowledgeJob
  ): Promise<KnowledgeExtractionResult> {
    const response = await fetch(`${this.config.baseUrl.replace(/\/$/, '')}/responses`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${this.config.apiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: this.config.model,
        input: [
          {
            role: 'system',
            content: [
              {
                type: 'input_text',
                text: 'You extract durable knowledge for a coding agent runtime. Return JSON only.'
              }
            ]
          },
          {
            role: 'user',
            content: [
              {
                type: 'input_text',
                text: buildPrompt(input, job)
              }
            ]
          }
        ],
        temperature: 0
      })
    });

    if (!response.ok) {
      const text = await response.text();
      throw new Error(`Knowledge client request failed (${response.status}): ${text}`);
    }

    const payload = (await response.json()) as OpenAIResponsesPayload;
    const text = extractText(payload);
    return JSON.parse(text) as KnowledgeExtractionResult;
  }
}

export function createDefaultKnowledgeClient(): KnowledgeLlmClient | null {
  const config = readConfig();
  if (!config) return null;
  return new OpenAIKnowledgeClient(config);
}
