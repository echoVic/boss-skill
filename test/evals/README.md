# Boss Deterministic Evals

This directory contains the deterministic eval layer for Boss.

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
release-readiness fixtures:

- `release-evidence` — evidence-wave planning, QA evidence, runtime duration/cost thresholds
- `pipeline-compliance` — runtime-first orchestration transcript checks

Both modes score captured fixtures only.

## Case Format

Each eval case has:

- `case.json`: prompt, feature, required artifacts, required behaviors, and thresholds.
- `transcript.jsonl`: captured Claude/Codex-style tool transcript.
- `workspace/.boss/<feature>/`: produced Boss artifacts and runtime metadata.

## Behavior Checks

| Behavior | Meaning |
|----------|---------|
| `uses-boss-skill` | Transcript invokes the `boss` skill |
| `runs-tests` | Transcript runs a project test command |
| `records-qa-evidence` | `qa-report.md` contains verified or honest unverified evidence |
| `produces-evidence-wave` | `tasks.md` includes Evidence Wave + Contract Matrix |
| `uses-runtime-cli` | Transcript calls `boss runtime`, `boss project`, `boss packs`, etc. |
| `records-artifacts-via-runtime` | Every `requiredArtifact` has a matching `boss runtime record-artifact <feature> <artifact>` call |
| `avoids-direct-execution-write` | Transcript does not directly manipulate `.meta/execution.json` (only read-only access like `cat`/`jq`/`boss status` allowed) |
| `has-workflow-scheduler` | `execution.json` exposes `workflow.nextNodeIds` or `workflow.nodes` |

## Capturing A New Case From A Real Run

1. Complete a Boss run in a project workspace.
2. Export the agent transcript as `transcript.jsonl` (tool calls with Bash commands).
3. Copy `.boss/<feature>/` into `fixtures/<case-id>/workspace/.boss/<feature>/`.
4. Add `case.json` with `requiredArtifacts` and `requiredBehaviors`.
5. Score locally:

```bash
test/evals/run-evals.sh --case test/evals/fixtures/<case-id>/case.json
```

Real agent workflow evals can generate a new case workspace, then invoke:

```bash
test/evals/run-evals.sh --case /path/to/case.json
```

Pass `--case` more than once to score several custom cases in one run.