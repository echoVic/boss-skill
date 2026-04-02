#!/bin/bash
# Boss Harness — SessionEnd hook
# 会话结束时生成最终报告（如果有活跃流水线）

INPUT=$(cat)
REASON=$(echo "$INPUT" | jq -r '.reason // empty')
CWD=$(echo "$INPUT" | jq -r '.cwd // empty')

BOSS_DIR="$CWD/.boss"
[[ -d "$BOSS_DIR" ]] || exit 0

REPORT_SCRIPT="$CLAUDE_PROJECT_DIR/scripts/report/generate-summary.sh"
[[ -x "$REPORT_SCRIPT" ]] || exit 0

for feature_dir in "$BOSS_DIR"/*/; do
    [[ -d "$feature_dir" ]] || continue
    exec_json="$feature_dir.meta/execution.json"
    [[ -f "$exec_json" ]] || continue

    status=$(jq -r '.status' "$exec_json" 2>/dev/null)
    feature=$(jq -r '.feature' "$exec_json" 2>/dev/null)

    if [[ "$status" == "running" || "$status" == "completed" || "$status" == "failed" ]]; then
        bash "$REPORT_SCRIPT" "$feature" >/dev/null 2>&1 || true
    fi
done

exit 0
