#!/bin/bash
set -e

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
HARNESS_DIR="$(cd "$SCRIPT_DIR/../harness" && pwd)"

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

info() { echo -e "${BLUE}[GATE]${NC} $1"; }
success() { echo -e "${GREEN}[GATE]${NC} $1"; }
warn() { echo -e "${YELLOW}[GATE]${NC} $1"; }
error() { echo -e "${RED}[GATE]${NC} $1" >&2; exit 1; }

show_help() {
    cat << 'EOF'
Boss Gate Engine - 门禁统一入口

用法: gate-runner.sh <feature> <gate-name> [options]

参数:
  feature     功能名称
  gate-name   门禁名称: gate0 | gate1 | gate2 | <plugin-gate>

选项:
  --dry-run          只检查不写入结果
  --skip-on-error    门禁脚本不存在时跳过而非失败

门禁执行流程:
  1. 定位门禁脚本（内置 scripts/gates/<gate>.sh 或插件 harness/plugins/<name>/gate.sh）
  2. 执行门禁脚本，收集检查结果
  3. 将结果写入 .meta/execution.json 的 qualityGates 字段
  4. 返回 exit code 0 (通过) 或 1 (未通过)

示例:
  gate-runner.sh my-feature gate0
  gate-runner.sh my-feature gate1 --dry-run
  gate-runner.sh my-feature security-audit --skip-on-error
EOF
}

FEATURE=""
GATE_NAME=""
DRY_RUN=false
SKIP_ON_ERROR=false

while [[ $# -gt 0 ]]; do
    case $1 in
        -h|--help) show_help; exit 0 ;;
        --dry-run) DRY_RUN=true; shift ;;
        --skip-on-error) SKIP_ON_ERROR=true; shift ;;
        -*)  error "未知选项: $1" ;;
        *)
            if [[ -z "$FEATURE" ]]; then FEATURE="$1"
            elif [[ -z "$GATE_NAME" ]]; then GATE_NAME="$1"
            else error "多余的参数: $1"
            fi
            shift ;;
    esac
done

[[ -z "$FEATURE" ]] && error "缺少 feature 参数"
[[ -z "$GATE_NAME" ]] && error "缺少 gate-name 参数"

EXEC_JSON=".boss/$FEATURE/.meta/execution.json"
[[ -f "$EXEC_JSON" ]] || error "未找到执行文件: $EXEC_JSON"
command -v jq >/dev/null 2>&1 || error "需要 jq 工具（brew install jq）"

GATE_SCRIPT=""
case "$GATE_NAME" in
    gate0) GATE_SCRIPT="$SCRIPT_DIR/gate0-code-quality.sh" ;;
    gate1) GATE_SCRIPT="$SCRIPT_DIR/gate1-testing.sh" ;;
    gate2) GATE_SCRIPT="$SCRIPT_DIR/gate2-performance.sh" ;;
    *)
        PLUGIN_GATE="harness/plugins/$GATE_NAME/gate.sh"
        if [[ -f "$PLUGIN_GATE" ]]; then
            GATE_SCRIPT="$PLUGIN_GATE"
        fi
        ;;
esac

if [[ -z "$GATE_SCRIPT" || ! -f "$GATE_SCRIPT" ]]; then
    if [[ "$SKIP_ON_ERROR" == true ]]; then
        warn "门禁脚本未找到: $GATE_NAME，已跳过"
        exit 0
    fi
    error "门禁脚本未找到: $GATE_NAME"
fi

info "执行门禁: $GATE_NAME ($GATE_SCRIPT)"

NOW="$(date -u +%Y-%m-%dT%H:%M:%SZ)"
RESULT_FILE=$(mktemp)
trap 'rm -f "$RESULT_FILE"' EXIT

GATE_PASSED=true
GATE_CHECKS="[]"

if bash "$GATE_SCRIPT" "$FEATURE" > "$RESULT_FILE" 2>&1; then
    GATE_PASSED=true
    success "门禁 $GATE_NAME: ✅ 通过"
else
    GATE_PASSED=false
    warn "门禁 $GATE_NAME: ❌ 未通过"
fi

if [[ -s "$RESULT_FILE" ]]; then
    FIRST_CHAR=$(head -c 1 "$RESULT_FILE")
    if [[ "$FIRST_CHAR" == "[" ]]; then
        GATE_CHECKS=$(cat "$RESULT_FILE")
    else
        GATE_CHECKS="[]"
        while IFS= read -r line; do
            if [[ -n "$line" ]]; then
                GATE_CHECKS=$(echo "$GATE_CHECKS" | jq --arg check "$line" '. += [$check]')
            fi
        done < "$RESULT_FILE"
    fi
fi

if [[ "$DRY_RUN" == true ]]; then
    info "[dry-run] 不写入结果"
    echo "门禁: $GATE_NAME"
    echo "通过: $GATE_PASSED"
    echo "检查项:"
    echo "$GATE_CHECKS" | jq .
    [[ "$GATE_PASSED" == true ]] && exit 0 || exit 1
fi

TMP_FILE=$(mktemp)
trap 'rm -f "$RESULT_FILE" "$TMP_FILE"' EXIT

jq --arg gate "$GATE_NAME" --argjson passed "$GATE_PASSED" --arg now "$NOW" --argjson checks "$GATE_CHECKS" \
    '.qualityGates[$gate] = { "status": "completed", "passed": $passed, "checks": $checks, "executedAt": $now }' \
    "$EXEC_JSON" > "$TMP_FILE" && mv "$TMP_FILE" "$EXEC_JSON"

TOTAL_GATES=0
PASSED_GATES=0
for g in $(jq -r '.qualityGates | keys[]' "$EXEC_JSON"); do
    G_STATUS=$(jq -r ".qualityGates.$g.status" "$EXEC_JSON")
    G_PASSED=$(jq -r ".qualityGates.$g.passed" "$EXEC_JSON")
    if [[ "$G_STATUS" == "completed" ]]; then
        TOTAL_GATES=$((TOTAL_GATES + 1))
        if [[ "$G_PASSED" == "true" ]]; then
            PASSED_GATES=$((PASSED_GATES + 1))
        fi
    fi
done

if [[ "$TOTAL_GATES" -gt 0 ]]; then
    PASS_RATE=$(echo "scale=2; $PASSED_GATES * 100 / $TOTAL_GATES" | bc)
    jq --argjson rate "$PASS_RATE" '.metrics.gatePassRate = $rate' "$EXEC_JSON" > "$TMP_FILE" && mv "$TMP_FILE" "$EXEC_JSON"
fi

info "结果已写入: $EXEC_JSON"
[[ "$GATE_PASSED" == true ]] && exit 0 || exit 1
