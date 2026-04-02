#!/bin/bash
# Boss Harness — SessionStart hook
# 会话启动时注入流水线上下文到 Claude

INPUT=$(cat)
CWD=$(echo "$INPUT" | jq -r '.cwd // empty')

find_active_feature() {
    local boss_dir="$CWD/.boss"
    [[ -d "$boss_dir" ]] || return

    for feature_dir in "$boss_dir"/*/; do
        [[ -d "$feature_dir" ]] || continue
        local exec_json="$feature_dir.meta/execution.json"
        [[ -f "$exec_json" ]] || continue

        local status=$(jq -r '.status // "unknown"' "$exec_json" 2>/dev/null)
        if [[ "$status" == "running" || "$status" == "initialized" ]]; then
            local feature=$(jq -r '.feature' "$exec_json" 2>/dev/null)
            echo "$feature"
            return
        fi
    done
}

CONTEXT=""

ACTIVE_FEATURE=$(find_active_feature)
if [[ -n "$ACTIVE_FEATURE" ]]; then
    EXEC_JSON="$CWD/.boss/$ACTIVE_FEATURE/.meta/execution.json"
    PIPELINE_STATUS=$(jq -r '.status' "$EXEC_JSON" 2>/dev/null)

    STAGES_INFO=""
    for s in 1 2 3 4; do
        S_NAME=$(jq -r --arg s "$s" '.stages[$s].name' "$EXEC_JSON" 2>/dev/null)
        S_STATUS=$(jq -r --arg s "$s" '.stages[$s].status' "$EXEC_JSON" 2>/dev/null)
        STAGES_INFO="$STAGES_INFO  Stage $s ($S_NAME): $S_STATUS\n"
    done

    CONTEXT="[Boss Harness] Active pipeline detected: $ACTIVE_FEATURE (status: $PIPELINE_STATUS)\n$STAGES_INFO"
    CONTEXT="$CONTEXT\nTo continue this pipeline, use: /boss $ACTIVE_FEATURE --continue-from <stage>"
fi

PLUGIN_COUNT=0
PLUGIN_DIR="$CLAUDE_PROJECT_DIR/harness/plugins"
if [[ -d "$PLUGIN_DIR" ]]; then
    for pj in "$PLUGIN_DIR"/*/plugin.json; do
        [[ -f "$pj" ]] || continue
        local_enabled=$(jq -r '.enabled // true' "$pj" 2>/dev/null)
        [[ "$local_enabled" == "true" ]] && PLUGIN_COUNT=$((PLUGIN_COUNT + 1))
    done
fi

if [[ "$PLUGIN_COUNT" -gt 0 ]]; then
    CONTEXT="$CONTEXT\n[Boss Harness] $PLUGIN_COUNT plugin(s) registered"
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
