#!/bin/bash
set -e

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

info() { echo -e "${BLUE}[REPORT]${NC} $1"; }
success() { echo -e "${GREEN}[REPORT]${NC} $1"; }
error() { echo -e "${RED}[REPORT]${NC} $1" >&2; exit 1; }

show_help() {
    cat << 'EOF'
Boss Harness - 流水线报告生成器

用法: generate-summary.sh <feature> [options]

参数:
  feature   功能名称

选项:
  --json     输出 JSON 格式而非 Markdown
  --stdout   输出到标准输出而非文件

默认输出到: .boss/<feature>/summary-report.md

示例:
  generate-summary.sh my-feature
  generate-summary.sh my-feature --json
  generate-summary.sh my-feature --stdout
EOF
}

FEATURE=""
JSON_MODE=false
STDOUT_MODE=false

while [[ $# -gt 0 ]]; do
    case $1 in
        -h|--help) show_help; exit 0 ;;
        --json) JSON_MODE=true; shift ;;
        --stdout) STDOUT_MODE=true; shift ;;
        -*)  error "未知选项: $1" ;;
        *)
            if [[ -z "$FEATURE" ]]; then FEATURE="$1"
            else error "多余的参数: $1"
            fi
            shift ;;
    esac
done

[[ -z "$FEATURE" ]] && error "缺少 feature 参数"

EXEC_JSON=".boss/$FEATURE/.meta/execution.json"
[[ -f "$EXEC_JSON" ]] || error "未找到执行文件: $EXEC_JSON"
command -v jq >/dev/null 2>&1 || error "需要 jq 工具（brew install jq）"

if [[ "$JSON_MODE" == true ]]; then
    SUMMARY=$(jq '{
        feature: .feature,
        status: .status,
        schemaVersion: .schemaVersion,
        stages: [.stages | to_entries[] | {
            stage: .key,
            name: .value.name,
            status: .value.status,
            duration: (.value.endTime as $end | .value.startTime as $start |
                if $start != null and $end != null then "calculated" else null end),
            retryCount: .value.retryCount,
            artifacts: .value.artifacts,
            gateResults: .value.gateResults
        }],
        qualityGates: .qualityGates,
        metrics: .metrics
    }' "$EXEC_JSON")

    if [[ "$STDOUT_MODE" == true ]]; then
        echo "$SUMMARY"
    else
        OUTPUT=".boss/$FEATURE/summary-report.json"
        echo "$SUMMARY" > "$OUTPUT"
        success "JSON 报告已生成: $OUTPUT"
    fi
    exit 0
fi

PIPELINE_STATUS=$(jq -r '.status' "$EXEC_JSON")
SCHEMA_VER=$(jq -r '.schemaVersion // "unknown"' "$EXEC_JSON")
CREATED=$(jq -r '.createdAt' "$EXEC_JSON")
UPDATED=$(jq -r '.updatedAt' "$EXEC_JSON")
RETRY_TOTAL=$(jq -r '.metrics.retryTotal' "$EXEC_JSON")
GATE_PASS_RATE=$(jq -r '.metrics.gatePassRate // "N/A"' "$EXEC_JSON")
NOW="$(date -u +%Y-%m-%dT%H:%M:%SZ)"

REPORT=""
REPORT+="# 流水线执行报告\n\n"
REPORT+="## 摘要\n\n"

case "$PIPELINE_STATUS" in
    completed) STATUS_ICON="✅" ;;
    running)   STATUS_ICON="🔄" ;;
    failed)    STATUS_ICON="❌" ;;
    *)         STATUS_ICON="⏳" ;;
esac

COMPLETED_STAGES=0
TOTAL_STAGES=0
for s in 1 2 3 4; do
    S_STATUS=$(jq -r --arg s "$s" '.stages[$s].status' "$EXEC_JSON")
    TOTAL_STAGES=$((TOTAL_STAGES + 1))
    if [[ "$S_STATUS" == "completed" || "$S_STATUS" == "skipped" ]]; then
        COMPLETED_STAGES=$((COMPLETED_STAGES + 1))
    fi
done

REPORT+="- **流水线状态**：$STATUS_ICON $PIPELINE_STATUS\n"
REPORT+="- **功能名称**：$FEATURE\n"
REPORT+="- **阶段进度**：$COMPLETED_STAGES / $TOTAL_STAGES 已完成\n"
REPORT+="- **门禁通过率**：${GATE_PASS_RATE}%\n"
REPORT+="- **总重试次数**：$RETRY_TOTAL\n"
REPORT+="- **报告生成时间**：$NOW\n\n"

REPORT+="---\n\n"
REPORT+="## 阶段详情\n\n"
REPORT+="| 阶段 | 名称 | 状态 | 耗时 | 重试 | 产物数 |\n"
REPORT+="|------|------|------|------|------|--------|\n"

for s in 1 2 3 4; do
    S_NAME=$(jq -r --arg s "$s" '.stages[$s].name' "$EXEC_JSON")
    S_STATUS=$(jq -r --arg s "$s" '.stages[$s].status' "$EXEC_JSON")
    S_RETRY=$(jq -r --arg s "$s" '.stages[$s].retryCount' "$EXEC_JSON")
    S_TIMING=$(jq -r --arg s "$s" '.metrics.stageTimings[$s] // "—"' "$EXEC_JSON")
    S_ARTIFACTS=$(jq -r --arg s "$s" '.stages[$s].artifacts | length' "$EXEC_JSON")

    case "$S_STATUS" in
        completed) S_ICON="✅" ;;
        running)   S_ICON="🔄" ;;
        failed)    S_ICON="❌" ;;
        retrying)  S_ICON="🔁" ;;
        skipped)   S_ICON="⏭️" ;;
        pending)   S_ICON="⏳" ;;
        *)         S_ICON="❓" ;;
    esac

    TIMING_STR="$S_TIMING"
    if [[ "$S_TIMING" != "—" && "$S_TIMING" != "null" ]]; then
        TIMING_STR="${S_TIMING}s"
    fi

    REPORT+="| $s | $S_NAME | $S_ICON $S_STATUS | $TIMING_STR | $S_RETRY | $S_ARTIFACTS |\n"
done

REPORT+="\n"

REPORT+="## 质量门禁\n\n"
REPORT+="| 门禁 | 状态 | 通过 | 检查项数 | 执行时间 |\n"
REPORT+="|------|------|------|----------|----------|\n"

for g in gate0 gate1 gate2; do
    G_STATUS=$(jq -r ".qualityGates.$g.status" "$EXEC_JSON")
    G_PASSED=$(jq -r ".qualityGates.$g.passed" "$EXEC_JSON")
    G_CHECKS=$(jq -r ".qualityGates.$g.checks | length" "$EXEC_JSON")
    G_TIME=$(jq -r ".qualityGates.$g.executedAt // \"—\"" "$EXEC_JSON")

    case "$g" in
        gate0) G_LABEL="Gate 0 (代码质量)" ;;
        gate1) G_LABEL="Gate 1 (测试)" ;;
        gate2) G_LABEL="Gate 2 (性能)" ;;
    esac

    if [[ "$G_STATUS" == "completed" ]]; then
        if [[ "$G_PASSED" == "true" ]]; then
            G_ICON="✅"
        else
            G_ICON="❌"
        fi
    else
        G_ICON="⏳"
        G_PASSED="—"
    fi

    REPORT+="| $G_LABEL | $G_ICON $G_STATUS | $G_PASSED | $G_CHECKS | $G_TIME |\n"
done

REPORT+="\n"

HAS_FAILED_CHECKS=false
for g in gate0 gate1 gate2; do
    FAILED=$(jq -r ".qualityGates.$g.checks[] | select(.passed == false) | .name" "$EXEC_JSON" 2>/dev/null)
    if [[ -n "$FAILED" ]]; then
        if [[ "$HAS_FAILED_CHECKS" == false ]]; then
            REPORT+="### 失败的检查项\n\n"
            HAS_FAILED_CHECKS=true
        fi
        while IFS= read -r check_name; do
            CHECK_DETAIL=$(jq -r ".qualityGates.$g.checks[] | select(.name == \"$check_name\") | .detail" "$EXEC_JSON" 2>/dev/null)
            REPORT+="- **$g / $check_name**：$CHECK_DETAIL\n"
        done <<< "$FAILED"
    fi
done

if [[ "$HAS_FAILED_CHECKS" == true ]]; then
    REPORT+="\n"
fi

REPORT+="## 产物清单\n\n"
for s in 1 2 3 4; do
    S_NAME=$(jq -r --arg s "$s" '.stages[$s].name' "$EXEC_JSON")
    ARTIFACTS=$(jq -r --arg s "$s" '.stages[$s].artifacts[]' "$EXEC_JSON" 2>/dev/null)
    if [[ -n "$ARTIFACTS" ]]; then
        REPORT+="### 阶段 $s ($S_NAME)\n\n"
        while IFS= read -r art; do
            ART_PATH=".boss/$FEATURE/$art"
            if [[ -f "$ART_PATH" ]]; then
                REPORT+="- ✅ \`$art\`\n"
            else
                REPORT+="- ⚠️ \`$art\`（文件不存在）\n"
            fi
        done <<< "$ARTIFACTS"
        REPORT+="\n"
    fi
done

HAS_FAILURES=false
for s in 1 2 3 4; do
    S_REASON=$(jq -r --arg s "$s" '.stages[$s].failureReason // empty' "$EXEC_JSON")
    if [[ -n "$S_REASON" ]]; then
        if [[ "$HAS_FAILURES" == false ]]; then
            REPORT+="## 失败原因\n\n"
            HAS_FAILURES=true
        fi
        S_NAME=$(jq -r --arg s "$s" '.stages[$s].name' "$EXEC_JSON")
        REPORT+="- **阶段 $s ($S_NAME)**：$S_REASON\n"
    fi
done

if [[ "$HAS_FAILURES" == true ]]; then
    REPORT+="\n"
fi

REPORT+="---\n\n"
REPORT+="_报告由 Boss Harness Engine $SCHEMA_VER 自动生成_\n"

if [[ "$STDOUT_MODE" == true ]]; then
    echo -e "$REPORT"
else
    OUTPUT=".boss/$FEATURE/summary-report.md"
    echo -e "$REPORT" > "$OUTPUT"
    success "流水线报告已生成: $OUTPUT"
fi
