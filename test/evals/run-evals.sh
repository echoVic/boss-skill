#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
SMOKE_CASE="$ROOT_DIR/test/evals/fixtures/smoke-success/case.json"
RELEASE_CASE="$ROOT_DIR/test/evals/fixtures/release-evidence/case.json"

usage() {
  cat <<'USAGE'
Usage:
  test/evals/run-evals.sh [--smoke] [--release] [--case path/to/case.json]

Runs deterministic Boss eval scoring against one or more prepared eval case workspaces.
This script does not launch a real agent or call an LLM judge.

Options:
  --smoke              Run the default deterministic smoke eval set.
  --release            Run the deterministic release-readiness eval set.
  --case <case.json>   Run an explicit eval case. Can be passed more than once.
USAGE
}

ARGS=()
if [[ "$#" -eq 0 ]]; then
  ARGS=(--case "$SMOKE_CASE")
else
  while [[ "$#" -gt 0 ]]; do
    case "$1" in
      --smoke)
        ARGS+=(--case "$SMOKE_CASE")
        shift
        ;;
      --release)
        ARGS+=(--case "$RELEASE_CASE")
        shift
        ;;
      --case)
        ARGS+=(--case "${2:-}")
        shift 2
        ;;
      -h|--help)
        usage
        exit 0
        ;;
      *)
        echo "Unknown option: $1" >&2
        usage >&2
        exit 1
        ;;
    esac
  done
fi

"$ROOT_DIR/node_modules/.bin/vite-node" --script "$ROOT_DIR/test/evals/eval-runner.ts" "${ARGS[@]}"
