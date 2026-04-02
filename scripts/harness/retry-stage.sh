#!/bin/bash
set -e

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

info() { echo -e "${BLUE}[HARNESS]${NC} $1"; }
success() { echo -e "${GREEN}[HARNESS]${NC} $1"; }
warn() { echo -e "${YELLOW}[HARNESS]${NC} $1"; }
error() { echo -e "${RED}[HARNESS]${NC} $1" >&2; exit 1; }

show_help() {
    cat << 'EOF'
Boss Harness - 阶段重试

用法: retry-stage.sh <feature> <stage>

将 failed 状态的阶段标记为 retrying，然后转为 running，
准备重新执行。会自动检查重试次数上限。

参数:
  feature   功能名称
  stage     阶段编号 (1-4)

示例:
  retry-stage.sh my-feature 3
EOF
}

if [[ $# -lt 2 ]]; then
    show_help
    exit 1
fi

FEATURE="$1"
STAGE="$2"

[[ "$STAGE" =~ ^[1-4]$ ]] || error "stage 必须是 1-4"

EXEC_JSON=".boss/$FEATURE/.meta/execution.json"
[[ -f "$EXEC_JSON" ]] || error "未找到执行文件: $EXEC_JSON"
command -v jq >/dev/null 2>&1 || error "需要 jq 工具（brew install jq）"

STAGE_STATUS=$(jq -r --arg s "$STAGE" '.stages[$s].status' "$EXEC_JSON")
RETRY_COUNT=$(jq -r --arg s "$STAGE" '.stages[$s].retryCount' "$EXEC_JSON")
MAX_RETRIES=$(jq -r --arg s "$STAGE" '.stages[$s].maxRetries' "$EXEC_JSON")

if [[ "$STAGE_STATUS" != "failed" ]]; then
    error "阶段 $STAGE 状态为 $STAGE_STATUS，只有 failed 状态可以重试"
fi

if [[ "$RETRY_COUNT" -ge "$MAX_RETRIES" ]]; then
    error "阶段 $STAGE 已达最大重试次数（$RETRY_COUNT/$MAX_RETRIES），需要人工介入"
fi

info "开始重试阶段 $STAGE（第 $((RETRY_COUNT + 1)) 次重试，上限 $MAX_RETRIES 次）"

"$SCRIPT_DIR/update-stage.sh" "$FEATURE" "$STAGE" retrying
"$SCRIPT_DIR/update-stage.sh" "$FEATURE" "$STAGE" running

success "阶段 $STAGE 已重置为 running，可以重新执行"
