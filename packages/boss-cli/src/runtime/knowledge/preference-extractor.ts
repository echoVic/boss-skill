import type { KnowledgeRecord, KnowledgeEvidence } from './store.js';

/**
 * Represents a user choice event that can be turned into a preference record.
 */
export interface UserChoice {
  type: 'design-variant' | 'review-decision' | 'config-preference' | 'gate-override';
  feature: string;
  context: {
    options: string[];
    selected: string;
    reason?: string;
  };
  agent?: string;
  stage?: number | null;
  timestamp?: string;
}

/**
 * Maps choice types to knowledge categories
 */
const CHOICE_TYPE_TO_CATEGORY: Record<UserChoice['type'], string> = {
  'design-variant': 'design-style',
  'review-decision': 'review-preference',
  'config-preference': 'config-preference',
  'gate-override': 'quality-threshold',
};

/**
 * Generates a stable ID for a preference based on category and subject
 */
function preferenceId(category: string, subject: string): string {
  return `pref-${category}-${subject}`.replace(/[^a-z0-9-]/g, '-');
}

/**
 * Extracts a user choice into a KnowledgeRecord of kind='preference'
 */
export function extractPreference(choice: UserChoice): KnowledgeRecord {
  const category = CHOICE_TYPE_TO_CATEGORY[choice.type] || 'general-preference';
  const subject = choice.context.selected;
  const timestamp = choice.timestamp || new Date().toISOString();

  return {
    id: preferenceId(category, subject),
    scope: 'global',
    kind: 'preference',
    category,
    subject,
    summary: buildSummary(choice),
    source: {
      type: 'user-choice',
      ref: `${choice.feature}/${choice.type}`,
    },
    evidence: [
      {
        type: 'user-choice',
        ref: `${choice.feature}/${choice.type}/${timestamp}`,
      },
    ],
    agent: choice.agent ?? null,
    stage: choice.stage ?? null,
    confidence: 0.5,
    createdAt: timestamp,
    lastSeenAt: timestamp,
    expiresAt: null,
    decayScore: 5,
  };
}

function buildSummary(choice: UserChoice): string {
  const reason = choice.context.reason ? ` (原因: ${choice.context.reason})` : '';
  switch (choice.type) {
    case 'design-variant':
      return `用户偏好设计方案「${choice.context.selected}」${reason}`;
    case 'review-decision':
      return `用户在评审中选择了「${choice.context.selected}」${reason}`;
    case 'config-preference':
      return `用户偏好配置「${choice.context.selected}」${reason}`;
    case 'gate-override':
      return `用户覆盖了门禁决策：「${choice.context.selected}」${reason}`;
    default:
      return `用户选择了「${choice.context.selected}」${reason}`;
  }
}

/**
 * Confidence adjustment logic:
 * - Same choice repeated: confidence increases (0.5 → 0.7 → 0.85 → cap at 0.95)
 * - Opposite choice: confidence decreases by 0.2
 */
const CONFIDENCE_INCREMENT = 0.2;
const CONFIDENCE_DECREMENT = 0.2;
const CONFIDENCE_MAX = 0.95;

/**
 * Merges a new user choice into existing preference records.
 * If a matching preference exists, updates its confidence and evidence.
 * If not, creates a new record.
 */
export function aggregatePreferences(
  existingRecords: KnowledgeRecord[],
  newChoice: UserChoice
): KnowledgeRecord[] {
  const category = CHOICE_TYPE_TO_CATEGORY[newChoice.type] || 'general-preference';
  const subject = newChoice.context.selected;
  const id = preferenceId(category, subject);
  const timestamp = newChoice.timestamp || new Date().toISOString();

  const result: KnowledgeRecord[] = [...existingRecords];
  const existingIndex = result.findIndex((r) => r.id === id);

  const newEvidence: KnowledgeEvidence = {
    type: 'user-choice',
    ref: `${newChoice.feature}/${newChoice.type}/${timestamp}`,
  };

  if (existingIndex >= 0) {
    // Same preference repeated → increase confidence
    const existing = result[existingIndex]!;
    const updatedEvidence = [...existing.evidence, newEvidence];
    result[existingIndex] = {
      ...existing,
      confidence: Math.min(CONFIDENCE_MAX, existing.confidence + CONFIDENCE_INCREMENT),
      lastSeenAt: timestamp,
      decayScore: Math.min(20, existing.decayScore + 2),
      evidence: updatedEvidence,
      summary: buildSummary(newChoice) + `（已确认${updatedEvidence.length}次）`,
    };
  } else {
    // Check for opposing preferences in same category
    const opposingIndices = result
      .map((r, i) => ({ r, i }))
      .filter(({ r }) => r.kind === 'preference' && r.category === category && r.id !== id);

    // Decrease confidence of opposing preferences
    for (const { i } of opposingIndices) {
      const opposing = result[i]!;
      result[i] = {
        ...opposing,
        confidence: Math.max(0.1, opposing.confidence - CONFIDENCE_DECREMENT),
        decayScore: Math.max(1, opposing.decayScore - 1),
      };
    }

    // Add new preference
    result.push(extractPreference(newChoice));
  }

  return result;
}

/**
 * Filters records to return only preference-kind records
 */
export function filterPreferences(records: KnowledgeRecord[]): KnowledgeRecord[] {
  return records.filter((r) => r.kind === 'preference');
}

/**
 * Gets the strongest preference for a given category
 */
export function getStrongestPreference(
  records: KnowledgeRecord[],
  category: string
): KnowledgeRecord | null {
  const preferences = records
    .filter((r) => r.kind === 'preference' && r.category === category)
    .sort((a, b) => b.confidence - a.confidence);
  return preferences[0] || null;
}
