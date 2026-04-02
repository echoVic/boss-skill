#!/bin/bash
# Boss Harness — PostToolUse (Write) hook
# 文件写入成功后，自动追踪产物到 execution.json

INPUT=$(cat)
FILE_PATH=$(echo "$INPUT" | jq -r '.tool_input.file_path // empty')
CWD=$(echo "$INPUT" | jq -r '.cwd // empty')

[[ -z "$FILE_PATH" ]] && exit 0

if [[ "$FILE_PATH" != *".boss/"* ]]; then
    exit 0
fi

FEATURE=$(echo "$FILE_PATH" | sed -n 's|.*\.boss/\([^/]*\)/.*|\1|p')
ARTIFACT=$(basename "$FILE_PATH")
[[ -z "$FEATURE" || -z "$ARTIFACT" ]] && exit 0

if [[ "$ARTIFACT" == "execution.json" || "$ARTIFACT" == "summary-report.md" || "$ARTIFACT" == "summary-report.json" ]]; then
    exit 0
fi

EXEC_JSON="$CWD/.boss/$FEATURE/.meta/execution.json"
[[ -f "$EXEC_JSON" ]] || exit 0
command -v jq >/dev/null 2>&1 || exit 0

STAGE=""
case "$ARTIFACT" in
    prd.md|architecture.md|ui-spec.md) STAGE=1 ;;
    tech-review.md|tasks.md) STAGE=2 ;;
    qa-report.md) STAGE=3 ;;
    deploy-report.md) STAGE=4 ;;
esac
[[ -z "$STAGE" ]] && exit 0

ALREADY=$(jq -r --arg s "$STAGE" --arg art "$ARTIFACT" \
    '.stages[$s].artifacts | index($art) // empty' "$EXEC_JSON" 2>/dev/null)

if [[ -z "$ALREADY" ]]; then
    TMP_FILE=$(mktemp)
    trap 'rm -f "$TMP_FILE"' EXIT
    jq --arg s "$STAGE" --arg art "$ARTIFACT" \
        '.stages[$s].artifacts += [$art] | .stages[$s].artifacts |= unique' \
        "$EXEC_JSON" > "$TMP_FILE" && mv "$TMP_FILE" "$EXEC_JSON"

    jq -n --arg art "$ARTIFACT" --arg stage "$STAGE" '{
        hookSpecificOutput: {
            hookEventName: "PostToolUse",
            additionalContext: ("[Harness] 产物 " + $art + " 已自动记录到阶段 " + $stage)
        }
    }'
fi

exit 0
