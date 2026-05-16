import { describe, expect, it } from 'vitest';

import {
  assertSkillBeforeActions,
  parseTranscriptLines,
  summarizeTranscript
} from './transcript-parser.js';

describe('Boss skill transcript parser', () => {
  it('extracts Claude stream-json skill calls and detects no premature action', () => {
    const transcript = parseTranscriptLines([
      JSON.stringify({
        type: 'assistant',
        message: {
          usage: { input_tokens: 12, output_tokens: 7 },
          content: [
            {
              type: 'tool_use',
              id: 'tool-1',
              name: 'Skill',
              input: { skill: 'boss' }
            }
          ]
        }
      }),
      JSON.stringify({
        type: 'assistant',
        message: {
          content: [
            {
              type: 'tool_use',
              id: 'tool-2',
              name: 'Write',
              input: { file_path: '/tmp/app.ts' }
            }
          ]
        }
      })
    ]);

    expect(transcript.toolCalls.map((call) => call.name)).toEqual(['Skill', 'Write']);
    expect(transcript.skillCalls.map((call) => call.skill)).toEqual(['boss']);
    expect(assertSkillBeforeActions(transcript, 'boss')).toEqual({
      ok: true,
      skill: 'boss',
      firstSkillIndex: 0,
      firstActionIndex: 1
    });
    expect(summarizeTranscript(transcript).usage).toEqual({
      inputTokens: 12,
      outputTokens: 7,
      cacheCreationInputTokens: 0,
      cacheReadInputTokens: 0
    });
  });

  it('extracts Codex-style tool calls and flags action before boss skill load', () => {
    const transcript = parseTranscriptLines([
      JSON.stringify({
        type: 'tool_call',
        tool: 'apply_patch',
        arguments: { path: 'src/app.ts' }
      }),
      JSON.stringify({
        type: 'tool_call',
        tool: 'Skill',
        arguments: { skill: 'boss' }
      })
    ]);

    expect(transcript.toolCalls.map((call) => call.name)).toEqual(['apply_patch', 'Skill']);
    expect(assertSkillBeforeActions(transcript, 'boss')).toEqual({
      ok: false,
      skill: 'boss',
      firstSkillIndex: 1,
      firstActionIndex: 0,
      reason: 'tool apply_patch ran before Skill(boss)'
    });
  });

  it('recognizes methodology skill calls separately from boss skill calls', () => {
    const transcript = parseTranscriptLines([
      JSON.stringify({
        type: 'assistant',
        message: {
          content: [
            { type: 'tool_use', name: 'Skill', input: { skill: 'boss' } },
            { type: 'tool_use', name: 'Skill', input: { skill: 'pm/requirement-penetration' } }
          ]
        }
      })
    ]);

    expect(summarizeTranscript(transcript).skills).toEqual(['boss', 'pm/requirement-penetration']);
    expect(summarizeTranscript(transcript).methodologySkills).toEqual(['pm/requirement-penetration']);
  });
});
