# Privacy And Network Boundary

Boss is a **local-first, zero-network-by-default** orchestration skill. This document
states exactly what data Boss reads, where it writes, and the single network surface it
opens — so you can audit it before running in a sensitive environment.

## Network: zero outbound by default

Boss makes **no outbound network requests**. It does not phone home, collect telemetry,
fetch remote models, or upload any artifact. The previous external-LLM `knowledge` module
(and its `BOSS_KNOWLEDGE_API_KEY` / `BOSS_KNOWLEDGE_BASE_URL` / `BOSS_KNOWLEDGE_MODEL`
configuration) has been **removed** — cross-session memory and preference derivation are now
computed deterministically from the local event stream, with no network dependency.

The only network surface Boss can open is an **opt-in, loopback-only** preview server:

- `boss design preview <feature>` starts an HTTP server bound to `127.0.0.1` on an
  ephemeral port to render a generated UI design in your local browser.
- It is never started implicitly by the pipeline, binds only to loopback (not `0.0.0.0`),
  serves the generated HTML plus a `/healthz` endpoint, and is closed when you stop it.

You can verify there is no other network code:

```bash
grep -rn "fetch(\|node:https\|https.request\|net.connect" packages/boss-cli/src
# → only runtime/design/server.ts (the loopback preview server)
```

## Data: everything stays on disk under `.boss/`

All state Boss produces lives inside your project under `.boss/<feature>/`:

- `events.jsonl` — append-only event log (the source of truth).
- `execution.json` — state projected from the event log (fully replayable).
- Pipeline artifacts (`prd.md`, `architecture.md`, `tasks.md`, `qa-report.md`, …).
- `.meta/` bookkeeping (workflow plan, WIP-checkpoint index, locks).

Cross-session memory and user-preference aggregation are derived from these local events
only. Nothing is written outside your project tree except when you explicitly run the
installer (`boss install`), which writes Boss's own skill files into your agent's
configuration directory (e.g. `~/.codex/skills/boss/`) — see the Security-Sensitive
Surfaces section of the README.

## Environment variables Boss reads

Boss reads only a small, documented set of variables — none of them credentials:

| Variable | Purpose |
| --- | --- |
| `BOSS_HOOK_PROFILE` | Reduce hook behavior (e.g. `minimal`) in sensitive environments |
| `BOSS_HOOK_IDS` / `BOSS_DISABLED_HOOKS` | Enable/disable specific hooks |
| `BOSS_DESIGN_PREVIEW_FORCE_INTERACTIVE` | Force interactive preview in non-TTY contexts |
| `GATE_COVERAGE_THRESHOLD` | Coverage threshold passed to gate scripts |

Boss does **not** read or transmit API keys, tokens, or cloud credentials.

## Auditing

`boss doctor` reports the resolved runtime environment and event-stream health without
touching the network. Release provenance (`npm run provenance:verify`) pins SHA-256 digests
of behavior-changing files so you can confirm the shipped code matches the audited source.
