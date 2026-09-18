# Knowledge Layer Design

Date: 2026-05-10
Status: Draft for review

## Context

The repository already has a runtime `memory` subsystem under `packages/boss-cli/src/runtime/memory/` and `packages/boss-cli/src/runtime/application/memory.ts`. That subsystem focuses on execution-adjacent records such as gate failures, agent failures, stable decisions, and summaries derived from runtime events.

The requested feature is a broader long-term knowledge layer similar in spirit to the knowledge behavior seen in gstack and trellis:

- project-local knowledge plus global knowledge
- automatic extraction only
- LLM-based extraction, not rule-only extraction
- background processing so the main pipeline never blocks
- input sources include runtime events and dialogue/prompt content

This design keeps the existing execution memory behavior intact and adds a separate knowledge layer beside it.

## Goals

- Add a dedicated knowledge layer that is separate from execution memory.
- Support both project-local and global knowledge.
- Extract knowledge automatically with an LLM.
- Run extraction in the background so runtime stages do not wait on it.
- Capture both user preferences and project facts/decisions/lessons.
- Feed extracted knowledge back into startup summaries and agent-specific query results.

## Non-Goals

- No manual knowledge editor in the first version.
- No synchronous LLM call in the main runtime path.
- No replacement of the existing execution memory subsystem.
- No vector database requirement.
- No user-facing chat UI redesign.

## Recommended Architecture

Introduce a new `knowledge` subsystem that mirrors the current memory layering:

- `execution memory` stays focused on runtime events and stage outcomes.
- `knowledge` stores durable facts, preferences, decisions, and lessons.
- `knowledge` has both project scope and global scope.
- `knowledge` extraction runs in a background worker.
- The worker consumes queued jobs built from runtime events, prompt/dialogue fragments, and artifact summaries.

The background worker produces structured knowledge records, validates them, merges duplicates, and writes them to the project knowledge store. A second pass can promote stable records into the global knowledge store.

## Data Model

Each knowledge record should be structured and queryable. The exact schema can evolve, but the following fields are required:

- `id`
- `scope`: `project` or `global`
- `kind`: `preference`, `fact`, `decision`, or `lesson`
- `category`: normalized type label such as `user_preference`, `project_fact`, or `workflow_decision`
- `subject`: the person, project, agent, or topic the record is about
- `summary`: a short human-readable statement
- `source`: where the record came from, such as `runtime-event`, `prompt`, `dialogue`, or `artifact`
- `evidence`: references back to raw inputs
- `confidence`
- `createdAt`
- `lastSeenAt`
- `expiresAt`
- `decayScore`

Records should be stored as JSON so they can be rebuilt, inspected, and tested without extra infrastructure.

## Storage Layout

Use project-local and global storage paths under `.boss/`:

- `.boss/<feature>/.meta/project-knowledge.json`
- `.boss/<feature>/.meta/knowledge-summary.json`
- `.boss/<feature>/.meta/knowledge-jobs.jsonl`
- `.boss/.knowledge/global-knowledge.json`
- `.boss/.knowledge/global-knowledge-summary.json`
- `.boss/.knowledge/global-knowledge-jobs.jsonl`

Execution memory remains at its current paths and does not move.

## Background Job Flow

Knowledge extraction must never block the main runtime path.

1. Runtime emits events, prompt/dialogue fragments, and artifact summaries.
2. A lightweight enqueue step writes a knowledge job record.
3. A background worker reads pending jobs.
4. The worker sends the collected inputs to the LLM with a strict extraction prompt.
5. The worker validates the JSON response against the knowledge schema.
6. The worker merges new records into project knowledge.
7. A separate promotion pass can lift stable records into global knowledge.
8. Summaries are regenerated after successful writes.

If the worker fails, the main pipeline continues. Knowledge simply does not update for that run.

## LLM Extraction Rules

The LLM is the extractor of record. It should produce only structured JSON, not prose.

The extraction prompt should instruct the model to:

- identify durable user preferences
- identify project facts and decisions
- identify repeated lessons and stable workflow patterns
- include evidence references for every record
- avoid low-confidence guesses
- avoid duplicating existing records when possible

Validation rules:

- reject responses that do not match schema
- reject records without evidence
- reject records below the configured confidence threshold
- merge duplicate records by normalized key instead of appending blindly
- never allow the LLM to overwrite stored records directly

## Promotion To Global Knowledge

Global knowledge is not a second raw transcript store. It should only contain stable cross-project knowledge.

Promotion happens after project knowledge exists and only for records that are repeated, stable, and broadly applicable. The initial rule set should be conservative:

- same normalized category and subject
- seen in more than one feature or project
- confidence above threshold
- not tied to a single transient stage failure

This can be implemented as a background promotion job that reads project knowledge, optionally performs a second LLM consolidation pass, and writes a cleaned global record.

## Query And Summary Behavior

The query layer should prefer the most relevant project knowledge first, then global knowledge.

Ranking should consider:

- current feature before global scope
- current agent and stage relevance
- confidence
- recency
- decay score

Summaries should be regenerated into two forms:

- startup summary: short bullets used when a project or agent starts
- agent section summaries: targeted context for a specific agent and stage

The existing execution memory summaries may remain as-is, but knowledge summaries should be added as a separate layer and can be combined at query time.

## CLI Surface

Add commands for background knowledge operations:

- `boss runtime enqueue-knowledge <feature>`
- `boss runtime process-knowledge-jobs <feature>`
- `boss runtime inspect-knowledge-jobs <feature>`
- `boss runtime build-knowledge-summary <feature>`
- `boss runtime query-knowledge <feature> --agent ... --stage ...`
- `boss runtime rebuild-global-knowledge`

These commands are operational surfaces for the background worker and inspection flows. The normal runtime should only enqueue jobs.

## Error Handling

- Enqueue failures should be non-fatal when possible and should not block runtime progress.
- Worker failures should leave the pending job visible for retry or inspection.
- Invalid LLM output should be rejected with a clear schema error.
- Duplicate or conflicting records should merge conservatively.
- A malformed knowledge file should fail loudly rather than silently dropping data.

## Testing

Add tests that cover:

- knowledge jobs are enqueued without blocking the main runtime
- worker processing writes project knowledge records
- invalid LLM output is rejected
- duplicate records merge correctly
- project knowledge is preferred over global knowledge during query
- global promotion only happens for stable repeated knowledge
- summaries render the expected startup and agent sections
- runtime continues even when background knowledge extraction fails

## Migration Plan

1. Add the new knowledge storage and job schema.
2. Add the background enqueue and worker commands.
3. Wire runtime events, prompt/dialogue fragments, and artifact summaries into the job queue.
4. Implement LLM-based extraction with schema validation and record merging.
5. Implement conservative global promotion.
6. Add knowledge summaries and query ranking.
7. Expand tests for enqueue, extraction, merge, promotion, and query behavior.

## Acceptance Criteria

- The runtime can queue knowledge extraction without waiting for the LLM.
- Project knowledge is persisted separately from execution memory.
- Global knowledge is available and derived only from stable records.
- Knowledge extraction uses LLM output as the primary source of truth.
- Failed knowledge extraction does not break the pipeline.
- Tests cover the background worker and the query path.
