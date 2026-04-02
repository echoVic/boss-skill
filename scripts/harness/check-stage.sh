#!/bin/bash
set -e

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
Boss Harness - 阶段状态检查

用法: check-stage.sh <feature> [stage] [options]

参数:
  feature   功能名称
  stage     阶段编号 (1-4)，省略则检查全部阶段

选项:
  --can-proceed         检查指定阶段是否可以开始执行
  --can-retry           检查指定阶段是否可以重试
  --json                以 JSON 格式输出
  --summary             输出流水线总体摘要

示例:
  check-stage.sh my-feature                    # 查看全部阶段状态
  check-stage.sh my-feature 2 --can-proceed    # 检查阶段 2 是否可以开始
  check-stage.sh my-feature 3 --can-retry      # 检查阶段 3 是否可以重试
  check-stage.sh my-feature --summary          # 输出流水线摘要
  check-stage.sh my-feature --json             # JSON 格式输出所有状态
EOF
}

FEATURE=""
STAGE=""
CAN_PROCEED=false
CAN_RETRY=false
JSON_OUTPUT=false
SUMMARY=false

while [[ $# -gt 0 ]]; do
    case $1 in
        -h|--help) show_help; exit 0 ;;
        --can-proceed) CAN_PROCEED=true; shift ;;
        --can-retry) CAN_RETRY=true; shift ;;
        --json) JSON_OUTPUT=true; shift ;;
        --summary) SUMMARY=true; shift ;;
        -*)  error "未知选项: $1" ;;
        *)
            if [[ -z "$FEATURE" ]]; then FEATURE="$1"
            elif [[ -z "$STAGE" ]]; then STAGE="$1"
            else error "多余的参数: $1"
            fi
            shift ;;
    esac
done

[[ -z "$FEATURE" ]] && error "缺少 feature 参数"
if [[ -n "$STAGE" ]]; then
    [[ "$STAGE" =~ ^[1-4]$ ]] || error "stage 必须是 1-4"
fi

EXEC_JSON=".boss/$FEATURE/.meta/execution.json"
[[ -f "$EXEC_JSON" ]] || error "未找到执行文件: $EXEC_JSON"
command -v jq >/dev/null 2>&1 || error "需要 jq 工具（brew install jq）"

if [[ "$JSON_OUTPUT" == true && -z "$STAGE" ]]; then
    jq '{ status, stages, qualityGates, metrics }' "$EXEC_JSON"
    exit 0
fi

if [[ "$JSON_OUTPUT" == true && -n "$STAGE" ]]; then
    jq --arg s "$STAGE" '.stages[$s]' "$EXEC_JSON"
    exit 0
fi

if [[ "$CAN_PROCEED" == true ]]; then
    [[ -z "$STAGE" ]] && error "--can-proceed 需要指定 stage"

    STAGE_STATUS=$(jq -r --arg s "$STAGE" '.stages[$s].status' "$EXEC_JSON")

    if [[ "$STAGE_STATUS" == "completed" || "$STAGE_STATUS" == "skipped" ]]; then
        warn "阶段 $STAGE 已经完成（$STAGE_STATUS），无需再执行"
        exit 0
    fi

    if [[ "$STAGE" == "1" ]]; then
        if [[ "$STAGE_STATUS" == "pending" ]]; then
            success "阶段 1 可以开始"
            exit 0
        fi
    else
        PREV_STAGE=$((STAGE - 1))
        PREV_STATUS=$(jq -r --arg s "$PREV_STAGE" '.stages[$s].status' "$EXEC_JSON")
        if [[ "$PREV_STATUS" == "completed" || "$PREV_STATUS" == "skipped" ]]; then
            success "阶段 $STAGE 可以开始（阶段 $PREV_STAGE 状态: $PREV_STATUS）"
            exit 0
        else
            error "阶段 $STAGE 不能开始：阶段 $PREV_STAGE 状态为 $PREV_STATUS（需要 completed 或 skipped）"
        fi
    fi
fi

if [[ "$CAN_RETRY" == true ]]; then
    [[ -z "$STAGE" ]] && error "--can-retry 需要指定 stage"

    STAGE_STATUS=$(jq -r --arg s "$STAGE" '.stages[$s].status' "$EXEC_JSON")
    RETRY_COUNT=$(jq -r --arg s "$STAGE" '.stages[$s].retryCount' "$EXEC_JSON")
    MAX_RETRIES=$(jq -r --arg s "$STAGE" '.stages[$s].maxRetries' "$EXEC_JSON")

    if [[ "$STAGE_STATUS" != "failed" ]]; then
        error "阶段 $STAGE 状态为 $STAGE_STATUS，只有 failed 状态可以重试"
    fi

    if [[ "$RETRY_COUNT" -ge "$MAX_RETRIES" ]]; then
        error "阶段 $STAGE 已达到最大重试次数（$RETRY_COUNT/$MAX_RETRIES）"
    fi

    success "阶段 $STAGE 可以重试（$RETRY_COUNT/$MAX_RETRIES）"
    exit 0
fi

if [[ "$SUMMARY" == true ]]; then
    PIPELINE_STATUS=$(jq -r '.status' "$EXEC_JSON")
    echo ""
    echo "═══════════════════════════════════════════"
    echo "  Boss Pipeline 摘要: $FEATURE"
    echo "═══════════════════════════════════════════"
    echo ""

    for s in 1 2 3 4; do
        S_NAME=$(jq -r --arg s "$s" '.stages[$s].name' "$EXEC_JSON")
        S_STATUS=$(jq -r --arg s "$s" '.stages[$s].status' "$EXEC_JSON")
        S_RETRY=$(jq -r --arg s "$s" '.stages[$s].retryCount' "$EXEC_JSON")
        S_TIMING=$(jq -r --arg s "$s" '.metrics.stageTimings[$s] // empty' "$EXEC_JSON")
        S_ARTIFACTS=$(jq -r --arg s "$s" '.stages[$s].artifacts | length' "$EXEC_JSON")

        case "$S_STATUS" in
            completed) ICON="✅" ;;
            running)   ICON="🔄" ;;
            failed)    ICON="❌" ;;
            retrying)  ICON="🔁" ;;
            skipped)   ICON="⏭️" ;;
            pending)   ICON="⏳" ;;
            *)         ICON="❓" ;;
        esac

        TIMING_STR=""
        if [[ -n "$S_TIMING" && "$S_TIMING" != "null" ]]; then
            TIMING_STR=" (${S_TIMING}s)"
        fi

        RETRY_STR=""
        if [[ "$S_RETRY" -gt 0 ]]; then
            RETRY_STR=" [重试 ${S_RETRY}x]"
        fi

        echo "  $ICON 阶段 $s ($S_NAME): $S_STATUS$TIMING_STR$RETRY_STR  [$S_ARTIFACTS 产物]"
    done

    echo ""

    GATE_PASS=0
    GATE_FAIL=0
    GATE_PENDING=0
    for g in gate0 gate1 gate2; do
        G_STATUS=$(jq -r ".qualityGates.$g.status" "$EXEC_JSON")
        G_PASSED=$(jq -r ".qualityGates.$g.passed" "$EXEC_JSON")
        if [[ "$G_STATUS" == "completed" ]]; then
            if [[ "$G_PASSED" == "true" ]]; then
                GATE_PASS=$((GATE_PASS + 1))
            else
                GATE_FAIL=$((GATE_FAIL + 1))
            fi
        else
            GATE_PENDING=$((GATE_PENDING + 1))
        fi
    done

    echo "  门禁: ✅ $GATE_PASS 通过 | ❌ $GATE_FAIL 失败 | ⏳ $GATE_PENDING 待执行"

    TOTAL_RETRY=$(jq -r '.metrics.retryTotal' "$EXEC_JSON")
    echo "  重试: 共 ${TOTAL_RETRY} 次"

    echo ""
    echo "  流水线状态: $PIPELINE_STATUS"
    echo "═══════════════════════════════════════════"
    echo ""
    exit 0
fi

if [[ -n "$STAGE" ]]; then
    S_STATUS=$(jq -r --arg s "$STAGE" '.stages[$s].status' "$EXEC_JSON")
    S_NAME=$(jq -r --arg s "$STAGE" '.stages[$s].name' "$EXEC_JSON")
    echo "阶段 $STAGE ($S_NAME): $S_STATUS"
else
    for s in 1 2 3 4; do
        S_STATUS=$(jq -r --arg s "$s" '.stages[$s].status' "$EXEC_JSON")
        S_NAME=$(jq -r --arg s "$s" '.stages[$s].name' "$EXEC_JSON")
        echo "阶段 $s ($S_NAME): $S_STATUS"
    done
fi
