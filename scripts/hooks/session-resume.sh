#!/bin/bash
# Boss Harness — SessionStart (resume) hook
# 会话恢复时检测未完成的流水线并注入上下文

INPUT=$(cat)
CWD=$(echo "$INPUT" | jq -r '.cwd // empty')

CONTEXT=""
BOSS_DIR="$CWD/.boss"

if [[ -d "$BOSS_DIR" ]]; then
    PENDING_FEATURES=""
    for feature_dir in "$BOSS_DIR"/*/; do
        [[ -d "$feature_dir" ]] || continue
        exec_json="$feature_dir.meta/execution.json"
        [[ -f "$exec_json" ]] || continue

        status=$(jq -r '.status // "unknown"' "$exec_json" 2>/dev/null)
        feature=$(jq -r '.feature' "$exec_json" 2>/dev/null)

        if [[ "$status" == "running" || "$status" == "initialized" || "$status" == "failed" ]]; then
            NEXT_STAGE=""
            for s in 1 2 3 4; do
                S_STATUS=$(jq -r --arg s "$s" '.stages[$s].status' "$exec_json" 2>/dev/null)
                if [[ "$S_STATUS" == "pending" || "$S_STATUS" == "running" || "$S_STATUS" == "failed" ]]; then
                    NEXT_STAGE="$s"
                    break
                fi
            done
            PENDING_FEATURES="$PENDING_FEATURES  - $feature (status: $status, next stage: ${NEXT_STAGE:-done})\n"
        fi
    done

    if [[ -n "$PENDING_FEATURES" ]]; then
        CONTEXT="[Boss Harness] Session resumed. Unfinished pipelines:\n$PENDING_FEATURES"
        CONTEXT="$CONTEXT\nUse /boss <feature> --continue-from <stage> to resume."
    fi
fi

if [[ -n "$CONTEXT" ]]; then
    jq -n --arg ctx "$CONTEXT" '{
        hookSpecificOutput: {
            hookEventName: "SessionStart",
            additionalContext: $ctx
        }
    }'
fi

exit 0
