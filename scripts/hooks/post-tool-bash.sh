#!/bin/bash
# Boss Harness — PostToolUse (Bash) hook
# Bash 命令执行后，捕获测试/构建/门禁相关结果

INPUT=$(cat)
COMMAND=$(echo "$INPUT" | jq -r '.tool_input.command // empty')
TOOL_RESPONSE=$(echo "$INPUT" | jq -r '.tool_response // empty')
CWD=$(echo "$INPUT" | jq -r '.cwd // empty')

[[ -z "$COMMAND" ]] && exit 0

is_gate_command() {
    [[ "$COMMAND" == *"gate-runner.sh"* || "$COMMAND" == *"gate0-"* || "$COMMAND" == *"gate1-"* || "$COMMAND" == *"gate2-"* ]]
}

is_harness_command() {
    [[ "$COMMAND" == *"update-stage.sh"* || "$COMMAND" == *"check-stage.sh"* || "$COMMAND" == *"retry-stage.sh"* || "$COMMAND" == *"generate-summary.sh"* || "$COMMAND" == *"load-plugins.sh"* ]]
}

is_test_command() {
    [[ "$COMMAND" == *"npm test"* || "$COMMAND" == *"npx vitest"* || "$COMMAND" == *"npx jest"* || "$COMMAND" == *"pytest"* || "$COMMAND" == *"cargo test"* || "$COMMAND" == *"go test"* || "$COMMAND" == *"npx playwright"* || "$COMMAND" == *"npx cypress"* ]]
}

CONTEXT=""

if is_gate_command; then
    CONTEXT="[Harness] 门禁命令已执行，结果已写入 execution.json"
fi

if is_harness_command; then
    CONTEXT="[Harness] 流水线状态已更新"
fi

if is_test_command; then
    BOSS_DIR="$CWD/.boss"
    if [[ -d "$BOSS_DIR" ]]; then
        for feature_dir in "$BOSS_DIR"/*/; do
            exec_json="$feature_dir.meta/execution.json"
            [[ -f "$exec_json" ]] || continue
            status=$(jq -r '.status' "$exec_json" 2>/dev/null)
            if [[ "$status" == "running" ]]; then
                feature=$(jq -r '.feature' "$exec_json" 2>/dev/null)
                CONTEXT="[Harness] 测试命令在活跃流水线 '$feature' 上下文中执行"
                break
            fi
        done
    fi
fi

if [[ -n "$CONTEXT" ]]; then
    jq -n --arg ctx "$CONTEXT" '{
        hookSpecificOutput: {
            hookEventName: "PostToolUse",
            additionalContext: $ctx
        }
    }'
fi

exit 0
