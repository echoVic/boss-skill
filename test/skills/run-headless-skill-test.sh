#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
PROMPTS_DIR="$ROOT_DIR/test/skills/prompts"
RUNNER="$ROOT_DIR/test/skills/run-skill-test.sh"

usage() {
  cat <<'USAGE'
Usage:
  test/skills/run-headless-skill-test.sh --id CASE_ID --prompt PROMPT.txt [--methodology pm/requirement-penetration] [--timeout 900]

Runs a real Claude Code headless session, finds the generated session JSONL transcript,
then evaluates it with test/skills/run-skill-test.sh.

This is opt-in and requires the `claude` CLI. It is not used by default CI.
USAGE
}

CASE_ID=""
PROMPT_FILE=""
TIMEOUT_SECONDS="900"
METHODOLOGY_ARGS=()

while [[ "$#" -gt 0 ]]; do
  case "$1" in
    --id)
      CASE_ID="${2:-}"
      shift 2
      ;;
    --prompt)
      PROMPT_FILE="${2:-}"
      shift 2
      ;;
    --methodology)
      METHODOLOGY_ARGS+=(--methodology "${2:-}")
      shift 2
      ;;
    --timeout)
      TIMEOUT_SECONDS="${2:-}"
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

if [[ -z "$CASE_ID" || -z "$PROMPT_FILE" ]]; then
  usage >&2
  exit 1
fi

if ! command -v claude >/dev/null 2>&1; then
  echo "Claude CLI not found. Install Claude Code or evaluate an existing transcript with test/skills/run-skill-test.sh." >&2
  exit 127
fi

if [[ "$PROMPT_FILE" != /* ]]; then
  PROMPT_FILE="$PROMPTS_DIR/$PROMPT_FILE"
fi
if [[ ! -f "$PROMPT_FILE" ]]; then
  echo "Prompt fixture not found: $PROMPT_FILE" >&2
  exit 1
fi

WORK_DIR="$(mktemp -d "${TMPDIR:-/tmp}/boss-headless-skill-XXXXXX")"
OUTPUT_FILE="$WORK_DIR/claude-output.txt"
PROMPT="$(cat "$PROMPT_FILE")"

echo "Running Claude Code headless skill test: $CASE_ID" >&2
echo "Workspace: $WORK_DIR" >&2

timeout "$TIMEOUT_SECONDS" claude -p "$PROMPT" \
  --allowed-tools=all \
  --add-dir "$WORK_DIR" \
  --permission-mode bypassPermissions \
  2>&1 | tee "$OUTPUT_FILE" >&2

SESSION_DIR_NAME="$(printf '%s' "$ROOT_DIR" | sed 's#/#-#g' | sed 's#^-##')"
SESSION_DIR="$HOME/.claude/projects/$SESSION_DIR_NAME"
SESSION_FILE="$(find "$SESSION_DIR" -name "*.jsonl" -type f -mmin -60 2>/dev/null | sort -r | head -1)"

if [[ -z "$SESSION_FILE" ]]; then
  echo "Could not find Claude session transcript under: $SESSION_DIR" >&2
  exit 1
fi

"$RUNNER" --id "$CASE_ID" --transcript "$SESSION_FILE" --skill boss "${METHODOLOGY_ARGS[@]}"
