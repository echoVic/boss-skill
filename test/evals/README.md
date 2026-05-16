# Boss Deterministic Evals

This directory contains the first deterministic eval layer for Boss.

Run:

```bash
npm run evals
```

The default command scores the prepared `smoke-success` fixture. It does not launch a
real agent and does not call an LLM judge.

Explicit eval sets:

```bash
test/evals/run-evals.sh --smoke
test/evals/run-evals.sh --release
```

Use `--smoke` for the fast deterministic canary and `--release` for the
release-readiness fixture that checks evidence-wave planning, QA evidence, runtime,
and cost thresholds. Both modes score captured fixtures only.

## Case Format

Each eval case has:

- `case.json`: prompt, feature, required artifacts, required behaviors, and thresholds.
- `transcript.jsonl`: captured Claude/Codex-style tool transcript.
- `workspace/.boss/<feature>/`: produced Boss artifacts and runtime metadata.

## Current Deterministic Checks

- Required artifact existence.
- Boss skill invocation from transcript.
- Test command evidence from transcript.
- QA evidence or honest `未验证`/`unverified` reporting.
- Token usage and rough cost estimate.
- Runtime duration threshold from `execution.json` when available.

Real agent workflow evals can generate a new case workspace, then invoke:

```bash
test/evals/run-evals.sh --case /path/to/case.json
```

Pass `--case` more than once to score several custom cases in one run.
