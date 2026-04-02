#!/bin/bash
# Boss Harness — Notification hook (async)
# 记录通知到流水线日志

INPUT=$(cat)
MESSAGE=$(echo "$INPUT" | jq -r '.message // empty')
NOTIF_TYPE=$(echo "$INPUT" | jq -r '.notification_type // empty')
CWD=$(echo "$INPUT" | jq -r '.cwd // empty')

[[ -z "$MESSAGE" ]] && exit 0

BOSS_DIR="$CWD/.boss"
[[ -d "$BOSS_DIR" ]] || exit 0

for feature_dir in "$BOSS_DIR"/*/; do
    [[ -d "$feature_dir" ]] || continue
    exec_json="$feature_dir.meta/execution.json"
    [[ -f "$exec_json" ]] || continue
    status=$(jq -r '.status' "$exec_json" 2>/dev/null)

    if [[ "$status" == "running" ]]; then
        LOG_FILE="$feature_dir.meta/notifications.jsonl"
        NOW=$(date -u +%Y-%m-%dT%H:%M:%SZ)
        jq -n --arg ts "$NOW" --arg type "$NOTIF_TYPE" --arg msg "$MESSAGE" \
            '{ timestamp: $ts, type: $type, message: $msg }' >> "$LOG_FILE" 2>/dev/null
        break
    fi
done

exit 0
