export interface TranscriptToolCall {
  index: number;
  name: string;
  input: Record<string, unknown>;
}

export interface TranscriptSkillCall extends TranscriptToolCall {
  skill: string;
}

export interface TranscriptUsage {
  inputTokens: number;
  outputTokens: number;
  cacheCreationInputTokens: number;
  cacheReadInputTokens: number;
}

export interface ParsedTranscript {
  records: unknown[];
  toolCalls: TranscriptToolCall[];
  skillCalls: TranscriptSkillCall[];
  usage: TranscriptUsage;
}

export interface SkillBeforeActionsResult {
  ok: boolean;
  skill: string;
  firstSkillIndex: number;
  firstActionIndex: number;
  reason?: string;
}

const NON_ACTION_TOOLS = new Set(['Skill', 'TodoWrite']);
const METHODOLOGY_SKILL_PATTERN = /^(pm|architect|backend|frontend|qa|devops|scrum-master|tech-lead|ui-designer|shared)\//;

function isObject(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function asObject(value: unknown): Record<string, unknown> {
  return isObject(value) ? value : {};
}

function asString(value: unknown): string {
  return typeof value === 'string' ? value : '';
}

function asNumber(value: unknown): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : 0;
}

function addUsage(target: TranscriptUsage, usage: unknown): void {
  const data = asObject(usage);
  target.inputTokens += asNumber(data.input_tokens ?? data.inputTokens);
  target.outputTokens += asNumber(data.output_tokens ?? data.outputTokens);
  target.cacheCreationInputTokens += asNumber(
    data.cache_creation_input_tokens ?? data.cacheCreationInputTokens
  );
  target.cacheReadInputTokens += asNumber(data.cache_read_input_tokens ?? data.cacheReadInputTokens);
}

function contentItems(record: Record<string, unknown>): unknown[] {
  const message = asObject(record.message);
  const messageContent = message.content;
  if (Array.isArray(messageContent)) return messageContent;
  const content = record.content;
  if (Array.isArray(content)) return content;
  return [];
}

function extractToolCallsFromRecord(record: Record<string, unknown>, nextIndex: () => number): TranscriptToolCall[] {
  const directToolName = asString(record.tool ?? record.name);
  if (record.type === 'tool_call' && directToolName) {
    return [
      {
        index: nextIndex(),
        name: directToolName,
        input: asObject(record.arguments ?? record.input)
      }
    ];
  }

  const calls: TranscriptToolCall[] = [];
  for (const item of contentItems(record)) {
    const content = asObject(item);
    const name = asString(content.name ?? content.tool);
    if (content.type !== 'tool_use' || !name) continue;
    calls.push({
      index: nextIndex(),
      name,
      input: asObject(content.input ?? content.arguments)
    });
  }
  return calls;
}

function skillFromCall(call: TranscriptToolCall): string {
  return asString(call.input.skill ?? call.input.skill_name ?? call.input.skillName);
}

export function parseTranscriptLines(lines: string[]): ParsedTranscript {
  const records: unknown[] = [];
  const toolCalls: TranscriptToolCall[] = [];
  const usage: TranscriptUsage = {
    inputTokens: 0,
    outputTokens: 0,
    cacheCreationInputTokens: 0,
    cacheReadInputTokens: 0
  };

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    let record: unknown;
    try {
      record = JSON.parse(trimmed);
    } catch {
      continue;
    }
    records.push(record);
    if (!isObject(record)) continue;

    addUsage(usage, record.usage);
    addUsage(usage, asObject(record.message).usage);

    let next = toolCalls.length;
    const calls = extractToolCallsFromRecord(record, () => next++);
    toolCalls.push(...calls);
  }

  const skillCalls = toolCalls
    .filter((call) => call.name === 'Skill')
    .map((call) => ({ ...call, skill: skillFromCall(call) }))
    .filter((call) => call.skill.length > 0);

  return { records, toolCalls, skillCalls, usage };
}

export function assertSkillBeforeActions(
  transcript: ParsedTranscript,
  skill: string
): SkillBeforeActionsResult {
  const firstSkill = transcript.skillCalls.find((call) => call.skill === skill);
  const firstAction = transcript.toolCalls.find((call) => !NON_ACTION_TOOLS.has(call.name));
  const firstSkillIndex = firstSkill?.index ?? -1;
  const firstActionIndex = firstAction?.index ?? -1;

  if (!firstSkill) {
    return {
      ok: false,
      skill,
      firstSkillIndex,
      firstActionIndex,
      reason: `Skill(${skill}) was not invoked`
    };
  }

  if (firstAction && firstAction.index < firstSkill.index) {
    return {
      ok: false,
      skill,
      firstSkillIndex,
      firstActionIndex,
      reason: `tool ${firstAction.name} ran before Skill(${skill})`
    };
  }

  return { ok: true, skill, firstSkillIndex, firstActionIndex };
}

export function summarizeTranscript(transcript: ParsedTranscript): {
  skills: string[];
  methodologySkills: string[];
  toolNames: string[];
  usage: TranscriptUsage;
} {
  const skills = [...new Set(transcript.skillCalls.map((call) => call.skill))];
  return {
    skills,
    methodologySkills: skills.filter((skill) => METHODOLOGY_SKILL_PATTERN.test(skill)),
    toolNames: [...new Set(transcript.toolCalls.map((call) => call.name))],
    usage: transcript.usage
  };
}
