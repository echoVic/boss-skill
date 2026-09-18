#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"

usage() {
  cat <<'USAGE'
Usage:
  test/skills/run-skill-test.sh --id CASE_ID --transcript SESSION.jsonl [--skill boss] [--methodology pm/requirement-penetration]

This deterministic runner evaluates an existing Claude/Codex transcript.
It does not launch a real agent session; generate the transcript separately.
USAGE
}

if [[ "$#" -eq 0 ]]; then
  usage >&2
  exit 1
fi

"$ROOT_DIR/node_modules/.bin/vite-node" --script "$ROOT_DIR/test/skills/skill-test-runner.ts" "$@"
