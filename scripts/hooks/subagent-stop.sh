#!/bin/bash
# Boss Harness — SubagentStop hook
# 子 Agent 完成后记录执行日志

INPUT=$(cat)
AGENT_TYPE=$(echo "$INPUT" | jq -r '.agent_type // empty')
AGENT_ID=$(echo "$INPUT" | jq -r '.agent_id // empty')
STOP_HOOK_ACTIVE=$(echo "$INPUT" | jq -r '.stop_hook_active // false')
LAST_MSG=$(echo "$INPUT" | jq -r '.last_assistant_message // empty' | head -c 500)
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

LOG_DIR="$CWD/.boss/${ACTIVE_FEATURE:-.harness-logs}"
mkdir -p "$LOG_DIR/.meta" 2>/dev/null

LOG_FILE="$LOG_DIR/.meta/agent-log.jsonl"
NOW=$(date -u +%Y-%m-%dT%H:%M:%SZ)

jq -n --arg ts "$NOW" --arg type "$AGENT_TYPE" --arg id "$AGENT_ID" --arg msg "$LAST_MSG" \
    '{ timestamp: $ts, agentType: $type, agentId: $id, event: "stop", summary: $msg }' >> "$LOG_FILE" 2>/dev/null

exit 0
