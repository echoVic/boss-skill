#!/bin/bash
# Boss Harness — Stop hook
# Agent 停止时检查流水线状态，决定是否需要继续

INPUT=$(cat)
STOP_HOOK_ACTIVE=$(echo "$INPUT" | jq -r '.stop_hook_active // false')
LAST_MSG=$(echo "$INPUT" | jq -r '.last_assistant_message // empty')
CWD=$(echo "$INPUT" | jq -r '.cwd // empty')

if [[ "$STOP_HOOK_ACTIVE" == "true" ]]; then
    exit 0
fi

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

PENDING_STAGES=()
for s in 1 2 3 4; do
    S_STATUS=$(jq -r --arg s "$s" '.stages[$s].status' "$EXEC_JSON" 2>/dev/null)
    S_NAME=$(jq -r --arg s "$s" '.stages[$s].name' "$EXEC_JSON" 2>/dev/null)
    if [[ "$S_STATUS" == "running" ]]; then
        PENDING_STAGES+=("Stage $s ($S_NAME) is still running")
    fi
done

if [[ ${#PENDING_STAGES[@]} -gt 0 ]]; then
    REASON="[Boss Harness] 流水线 '$ACTIVE_FEATURE' 有未完成的阶段:\n"
    for stage_info in "${PENDING_STAGES[@]}"; do
        REASON="$REASON  - $stage_info\n"
    done
    REASON="$REASON请先完成当前阶段或使用 update-stage.sh 更新状态后再停止。"

    jq -n --arg reason "$REASON" '{
        decision: "block",
        reason: $reason
    }'
    exit 0
fi

exit 0
