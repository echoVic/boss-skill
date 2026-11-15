# Boss Skill Behavior Tests

This directory contains the fast, deterministic foundation for Boss skill behavior testing.

## Fast CI Tests

Run:

```bash
npm run test:skills
```

These tests do not launch a real agent. They validate:

- Prompt fixtures used by future headless tests.
- Transcript parsing for Claude-style and Codex-style JSONL.
- Detection of tool actions before `Skill(boss)`.
- Detection of required methodology skill calls.
- The deterministic transcript evaluation runner.

## Evaluate an Existing Transcript

Run:

```bash
test/skills/run-skill-test.sh \
  --id explicit-boss \
  --transcript /path/to/session.jsonl \
  --methodology pm/requirement-penetration
```

The command prints a JSON report and exits non-zero when skill behavior fails.

## Optional Real Claude Headless Run

Run:

```bash
test/skills/run-headless-skill-test.sh \
  --id explicit-boss \
  --prompt boss-explicit-request.txt \
  --methodology pm/requirement-penetration
```

This requires the `claude` CLI and is intentionally opt-in. It runs Claude Code headless,
finds the generated JSONL session transcript, then evaluates it with `run-skill-test.sh`.
