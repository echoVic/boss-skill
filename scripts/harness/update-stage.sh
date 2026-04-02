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
Boss Harness - 阶段状态更新

用法: update-stage.sh <feature> <stage> <status> [options]

参数:
  feature   功能名称
  stage     阶段编号 (1-4)
  status    目标状态: pending | running | completed | failed | retrying | skipped

选项:
  --reason <text>        失败原因（status=failed 时使用）
  --artifact <name>      记录产出的产物文件名（可多次使用）
  --gate <name>          记录关联的 gate 名称
  --gate-passed          标记 gate 通过
  --gate-failed          标记 gate 未通过

示例:
  update-stage.sh my-feature 1 running
  update-stage.sh my-feature 1 completed --artifact prd.md --artifact architecture.md
  update-stage.sh my-feature 3 failed --reason "单元测试覆盖率不足"
  update-stage.sh my-feature 3 completed --gate gate1 --gate-passed
EOF
}

VALID_STATUSES="pending running completed failed retrying skipped"

FEATURE=""
STAGE=""
STATUS=""
REASON=""
ARTIFACTS=()
GATE_NAME=""
GATE_PASSED=""

while [[ $# -gt 0 ]]; do
    case $1 in
        -h|--help) show_help; exit 0 ;;
        --reason) REASON="$2"; shift 2 ;;
        --artifact) ARTIFACTS+=("$2"); shift 2 ;;
        --gate) GATE_NAME="$2"; shift 2 ;;
        --gate-passed) GATE_PASSED="true"; shift ;;
        --gate-failed) GATE_PASSED="false"; shift ;;
        -*)  error "未知选项: $1" ;;
        *)
            if [[ -z "$FEATURE" ]]; then FEATURE="$1"
            elif [[ -z "$STAGE" ]]; then STAGE="$1"
            elif [[ -z "$STATUS" ]]; then STATUS="$1"
            else error "多余的参数: $1"
            fi
            shift ;;
    esac
done

[[ -z "$FEATURE" ]] && error "缺少 feature 参数"
[[ -z "$STAGE" ]] && error "缺少 stage 参数"
[[ -z "$STATUS" ]] && error "缺少 status 参数"
[[ "$STAGE" =~ ^[1-4]$ ]] || error "stage 必须是 1-4"
echo "$VALID_STATUSES" | grep -qw "$STATUS" || error "无效状态: $STATUS（允许: $VALID_STATUSES）"

EXEC_JSON=".boss/$FEATURE/.meta/execution.json"
[[ -f "$EXEC_JSON" ]] || error "未找到执行文件: $EXEC_JSON"

command -v jq >/dev/null 2>&1 || error "需要 jq 工具（brew install jq）"

NOW="$(date -u +%Y-%m-%dT%H:%M:%SZ)"
CURRENT_STATUS=$(jq -r ".stages[\"$STAGE\"].status" "$EXEC_JSON")

validate_transition() {
    local from="$1" to="$2"
    case "${from}:${to}" in
        pending:running|pending:skipped) return 0 ;;
        running:completed|running:failed) return 0 ;;
        failed:retrying) return 0 ;;
        retrying:running) return 0 ;;
        completed:running) return 0 ;;
        *) return 1 ;;
    esac
}

if ! validate_transition "$CURRENT_STATUS" "$STATUS"; then
    error "无效的状态转换: $CURRENT_STATUS → $STATUS（阶段 $STAGE）"
fi

TMP_FILE=$(mktemp)
trap 'rm -f "$TMP_FILE"' EXIT

cp "$EXEC_JSON" "$TMP_FILE"

jq --arg stage "$STAGE" --arg status "$STATUS" --arg now "$NOW" \
    '.stages[$stage].status = $status | .updatedAt = $now' "$TMP_FILE" > "$EXEC_JSON"

if [[ "$STATUS" == "running" ]]; then
    CURRENT_START=$(jq -r ".stages[\"$STAGE\"].startTime" "$EXEC_JSON")
    if [[ "$CURRENT_START" == "null" ]]; then
        jq --arg stage "$STAGE" --arg now "$NOW" \
            '.stages[$stage].startTime = $now' "$EXEC_JSON" > "$TMP_FILE" && mv "$TMP_FILE" "$EXEC_JSON"
    fi
fi

if [[ "$STATUS" == "completed" || "$STATUS" == "failed" || "$STATUS" == "skipped" ]]; then
    jq --arg stage "$STAGE" --arg now "$NOW" \
        '.stages[$stage].endTime = $now' "$EXEC_JSON" > "$TMP_FILE" && mv "$TMP_FILE" "$EXEC_JSON"
fi

if [[ "$STATUS" == "failed" && -n "$REASON" ]]; then
    jq --arg stage "$STAGE" --arg reason "$REASON" \
        '.stages[$stage].failureReason = $reason' "$EXEC_JSON" > "$TMP_FILE" && mv "$TMP_FILE" "$EXEC_JSON"
fi

if [[ "$STATUS" == "retrying" ]]; then
    jq --arg stage "$STAGE" \
        '.stages[$stage].retryCount += 1 | .metrics.retryTotal += 1' "$EXEC_JSON" > "$TMP_FILE" && mv "$TMP_FILE" "$EXEC_JSON"
fi

for artifact in "${ARTIFACTS[@]}"; do
    jq --arg stage "$STAGE" --arg art "$artifact" \
        '.stages[$stage].artifacts += [$art] | .stages[$stage].artifacts |= unique' "$EXEC_JSON" > "$TMP_FILE" && mv "$TMP_FILE" "$EXEC_JSON"
done

if [[ -n "$GATE_NAME" && -n "$GATE_PASSED" ]]; then
    jq --arg stage "$STAGE" --arg gate "$GATE_NAME" --argjson passed "$GATE_PASSED" --arg now "$NOW" \
        '.stages[$stage].gateResults[$gate] = { "passed": $passed, "executedAt": $now }' "$EXEC_JSON" > "$TMP_FILE" && mv "$TMP_FILE" "$EXEC_JSON"
fi

ALL_COMPLETED=true
ALL_COUNT=0
COMPLETED_COUNT=0
for s in 1 2 3 4; do
    S_STATUS=$(jq -r ".stages[\"$s\"].status" "$EXEC_JSON")
    ALL_COUNT=$((ALL_COUNT + 1))
    if [[ "$S_STATUS" == "completed" || "$S_STATUS" == "skipped" ]]; then
        COMPLETED_COUNT=$((COMPLETED_COUNT + 1))
    else
        ALL_COMPLETED=false
    fi
done

if [[ "$ALL_COMPLETED" == true ]]; then
    CREATED=$(jq -r '.createdAt' "$EXEC_JSON")
    jq --arg now "$NOW" --arg status "completed" \
        '.status = $status | .updatedAt = $now' "$EXEC_JSON" > "$TMP_FILE" && mv "$TMP_FILE" "$EXEC_JSON"
elif [[ "$STATUS" == "failed" ]]; then
    jq --arg status "failed" --arg now "$NOW" \
        '.status = $status | .updatedAt = $now' "$EXEC_JSON" > "$TMP_FILE" && mv "$TMP_FILE" "$EXEC_JSON"
elif [[ "$STATUS" == "running" ]]; then
    jq --arg status "running" --arg now "$NOW" \
        '.status = $status | .updatedAt = $now' "$EXEC_JSON" > "$TMP_FILE" && mv "$TMP_FILE" "$EXEC_JSON"
fi

for s in 1 2 3 4; do
    S_START=$(jq -r ".stages[\"$s\"].startTime" "$EXEC_JSON")
    S_END=$(jq -r ".stages[\"$s\"].endTime" "$EXEC_JSON")
    if [[ "$S_START" != "null" && "$S_END" != "null" ]]; then
        if date -j -f "%Y-%m-%dT%H:%M:%SZ" "$S_START" +%s >/dev/null 2>&1; then
            START_EPOCH=$(date -j -f "%Y-%m-%dT%H:%M:%SZ" "$S_START" +%s 2>/dev/null)
            END_EPOCH=$(date -j -f "%Y-%m-%dT%H:%M:%SZ" "$S_END" +%s 2>/dev/null)
        else
            START_EPOCH=$(date -d "$S_START" +%s 2>/dev/null || echo "0")
            END_EPOCH=$(date -d "$S_END" +%s 2>/dev/null || echo "0")
        fi
        if [[ "$START_EPOCH" != "0" && "$END_EPOCH" != "0" ]]; then
            DURATION=$((END_EPOCH - START_EPOCH))
            jq --arg s "$s" --argjson d "$DURATION" \
                '.metrics.stageTimings[$s] = $d' "$EXEC_JSON" > "$TMP_FILE" && mv "$TMP_FILE" "$EXEC_JSON"
        fi
    fi
done

success "阶段 $STAGE: $CURRENT_STATUS → $STATUS"
info "文件: $EXEC_JSON"
