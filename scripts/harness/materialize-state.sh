#!/bin/bash
set -e

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"

show_help() {
    cat << 'EOF'
Boss Harness - 状态物化

用法: materialize-state.sh <feature>

从 .boss/<feature>/.meta/events.jsonl 重建 execution.json。
这是事件溯源的"物化视图"生成器。

参数:
  feature   功能名称

示例:
  materialize-state.sh my-feature
EOF
}

[[ "$1" == "-h" || "$1" == "--help" ]] && { show_help; exit 0; }

node "$SCRIPT_DIR/../../packages/boss-cli/dist/runtime/projectors/materialize-state.js" "$@"
