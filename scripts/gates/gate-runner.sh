#!/bin/bash
set -e

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"

show_help() {
    cat << 'EOF'
Boss Gate Engine - 门禁统一入口

用法: evaluate-gates.js <feature> <gate-name> [options]

参数:
  feature     功能名称
  gate-name   门禁名称: gate0 | gate1 | gate2 | <plugin-gate>

选项:
  --dry-run          只检查不写入结果
  --skip-on-error    门禁脚本不存在时跳过而非失败

门禁执行流程:
  1. 定位门禁脚本（内置 scripts/gates/<gate>.sh 或插件 harness/plugins/<name>/gate.sh）
  2. 执行门禁脚本，收集检查结果
  3. 追加 GateEvaluated 事件并物化 .meta/execution.json
  4. 返回 exit code 0 (通过) 或 1 (未通过)

示例:
  evaluate-gates.js my-feature gate0
  evaluate-gates.js my-feature gate1 --dry-run
  evaluate-gates.js my-feature security-audit --skip-on-error
EOF
}

for arg in "$@"; do
  case "$arg" in
    -h|--help)
      show_help
      exit 0
      ;;
  esac
done

if [[ $# -lt 2 ]]; then
  show_help >&2
  exit 1
fi

node "$SCRIPT_DIR/../../packages/boss-cli/dist/bin/boss.js" runtime evaluate-gates "$@"
