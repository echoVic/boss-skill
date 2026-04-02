#!/bin/bash
# Boss Harness — SubagentStart hook
# 子 Agent 启动时注入流水线上下文

INPUT=$(cat)
AGENT_TYPE=$(echo "$INPUT" | jq -r '.agent_type // empty')
CWD=$(echo "$INPUT" | jq -r '.cwd // empty')

find_active_feature() {
    local boss_dir="$CWD/.boss"
    [[ -d "$boss_dir" ]] || return
    for feature_dir in "$boss_dir"/*/; do
        [[ -d "$feature_dir" ]] || continue
        local exec_json="$feature_dir.meta/execution.json"
        [[ -f "$exec_json" ]] || continue
        local status=$(jq -r '.status' "$exec_json" 2>/dev/null)
        if [[ "$status" == "running" ]]; then
            jq -r '.feature' "$exec_json" 2>/dev/null
            return
        fi
    done
}

ACTIVE_FEATURE=$(find_active_feature)
[[ -z "$ACTIVE_FEATURE" ]] && exit 0

EXEC_JSON="$CWD/.boss/$ACTIVE_FEATURE/.meta/execution.json"
[[ -f "$EXEC_JSON" ]] || exit 0

CURRENT_STAGE=""
for s in 1 2 3 4; do
    S_STATUS=$(jq -r --arg s "$s" '.stages[$s].status' "$EXEC_JSON" 2>/dev/null)
    if [[ "$S_STATUS" == "running" ]]; then
        CURRENT_STAGE="$s"
        break
    fi
done

CONTEXT="[Boss Harness] 当前流水线: $ACTIVE_FEATURE"
if [[ -n "$CURRENT_STAGE" ]]; then
    STAGE_NAME=$(jq -r --arg s "$CURRENT_STAGE" '.stages[$s].name' "$EXEC_JSON" 2>/dev/null)
    CONTEXT="$CONTEXT, 活跃阶段: $CURRENT_STAGE ($STAGE_NAME)"
fi
CONTEXT="$CONTEXT\n子 Agent 类型: $AGENT_TYPE"

jq -n --arg ctx "$CONTEXT" '{
    hookSpecificOutput: {
        hookEventName: "SubagentStart",
        additionalContext: $ctx
    }
}'

exit 0
