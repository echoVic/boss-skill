#!/bin/bash
# Boss Harness — PreToolUse (Write|Edit) hook
# 写入/编辑文件前校验：
# 1. 如果写入 .boss/<feature>/ 下的产物，检查对应阶段是否 running
# 2. 如果门禁未通过，阻止修改生产代码（仅限 gate 阶段后）

INPUT=$(cat)
TOOL_NAME=$(echo "$INPUT" | jq -r '.tool_name // empty')
FILE_PATH=$(echo "$INPUT" | jq -r '.tool_input.file_path // empty')
CWD=$(echo "$INPUT" | jq -r '.cwd // empty')

[[ -z "$FILE_PATH" ]] && exit 0

if [[ "$FILE_PATH" == *".boss/"*"/.meta/execution.json" ]]; then
    jq -n '{
        hookSpecificOutput: {
            hookEventName: "PreToolUse",
            permissionDecision: "deny",
            permissionDecisionReason: "execution.json 由 Harness 脚本管理，不允许直接编辑。请使用 scripts/harness/update-stage.sh"
        }
    }'
    exit 0
fi

if [[ "$FILE_PATH" == *".boss/"* ]]; then
    FEATURE=$(echo "$FILE_PATH" | sed -n 's|.*\.boss/\([^/]*\)/.*|\1|p')
    ARTIFACT=$(basename "$FILE_PATH")

    if [[ -n "$FEATURE" ]]; then
        EXEC_JSON="$CWD/.boss/$FEATURE/.meta/execution.json"
        if [[ -f "$EXEC_JSON" ]]; then
            PIPELINE_STATUS=$(jq -r '.status' "$EXEC_JSON" 2>/dev/null)

            declare EXPECTED_STAGE=""
            case "$ARTIFACT" in
                prd.md|architecture.md|ui-spec.md) EXPECTED_STAGE=1 ;;
                tech-review.md|tasks.md) EXPECTED_STAGE=2 ;;
                qa-report.md) EXPECTED_STAGE=3 ;;
                deploy-report.md) EXPECTED_STAGE=4 ;;
            esac

            if [[ -n "$EXPECTED_STAGE" ]]; then
                STAGE_STATUS=$(jq -r --arg s "$EXPECTED_STAGE" '.stages[$s].status' "$EXEC_JSON" 2>/dev/null)
                if [[ "$STAGE_STATUS" != "running" && "$STAGE_STATUS" != "retrying" ]]; then
                    jq -n --arg art "$ARTIFACT" --arg stage "$EXPECTED_STAGE" --arg status "$STAGE_STATUS" '{
                        hookSpecificOutput: {
                            hookEventName: "PreToolUse",
                            permissionDecision: "ask",
                            permissionDecisionReason: ("产物 " + $art + " 属于阶段 " + $stage + "，但该阶段状态为 " + $status + "（非 running）。确认要写入吗？")
                        }
                    }'
                    exit 0
                fi
            fi
        fi
    fi
fi

exit 0
