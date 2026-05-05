#!/bin/bash
set -e

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
source "$SCRIPT_DIR/../lib/common.sh"
LOG_TAG="EVENT"

show_help() {
    cat << 'EOF'
Boss Harness - 事件追加

用法: append-event.sh <feature> <event-type> [--key value ...]

追加一条事件到 .boss/<feature>/.meta/events.jsonl

事件类型:
  PipelineInitialized  StageStarted    StageCompleted
  StageFailed          StageRetrying   StageSkipped
  ArtifactRecorded     GateEvaluated
  AgentStarted         AgentCompleted  AgentFailed
  AgentRetryScheduled  RevisionRequested
  PluginDiscovered     PluginActivated
  PluginsRegistered

选项:
  --stage <n>          阶段编号
  --agent <name>       Agent 名称
  --artifact <name>    产物名称
  --gate <name>        Gate 名称
  --passed <bool>      Gate 是否通过
  --reason <text>      失败原因
  --data <json>        附加 JSON 数据

示例:
  append-event.sh my-feature StageStarted --stage 1
  append-event.sh my-feature ArtifactRecorded --artifact prd.md --stage 1
  append-event.sh my-feature AgentCompleted --agent boss-pm --stage 1
EOF
}

FEATURE=""
EVENT_TYPE=""
STAGE=""
AGENT=""
ARTIFACT=""
GATE=""
PASSED=""
REASON=""
EXTRA_DATA=""

while [[ $# -gt 0 ]]; do
    case $1 in
        -h|--help) show_help; exit 0 ;;
        --stage) STAGE="$2"; shift 2 ;;
        --agent) AGENT="$2"; shift 2 ;;
        --artifact) ARTIFACT="$2"; shift 2 ;;
        --gate) GATE="$2"; shift 2 ;;
        --passed) PASSED="$2"; shift 2 ;;
        --reason) REASON="$2"; shift 2 ;;
        --data) EXTRA_DATA="$2"; shift 2 ;;
        -*)  error "未知选项: $1" ;;
        *)
            if [[ -z "$FEATURE" ]]; then FEATURE="$1"
            elif [[ -z "$EVENT_TYPE" ]]; then EVENT_TYPE="$1"
            else error "多余的参数: $1"
            fi
            shift ;;
    esac
done

[[ -z "$FEATURE" ]] && error "缺少 feature 参数"
[[ -z "$EVENT_TYPE" ]] && error "缺少 event-type 参数"

EVENT_TYPES_JS="$SCRIPT_DIR/../../packages/boss-cli/dist/runtime/domain/event-types.js"
VALID_TYPES="$(node -e "const { EVENT_TYPE_VALUES } = require(process.argv[1]); process.stdout.write(EVENT_TYPE_VALUES.join(' '))" "$EVENT_TYPES_JS")"
echo "$VALID_TYPES" | grep -qw "$EVENT_TYPE" || error "无效事件类型: $EVENT_TYPE"

EVENTS_FILE=".boss/$FEATURE/.meta/events.jsonl"
META_DIR=".boss/$FEATURE/.meta"
[[ -d "$META_DIR" ]] || error "未找到 .meta 目录: $META_DIR"

command -v jq >/dev/null 2>&1 || error "需要 jq 工具（brew install jq）"

NOW="$(date -u +%Y-%m-%dT%H:%M:%SZ)"

# 计算事件 ID（当前行数 + 1）
if [[ -f "$EVENTS_FILE" ]]; then
    EVENT_ID=$(wc -l < "$EVENTS_FILE" | tr -d ' ')
    EVENT_ID=$((EVENT_ID + 1))
else
    EVENT_ID=1
fi

# 构建事件 JSON
EVENT=$(jq -n \
    --argjson id "$EVENT_ID" \
    --arg type "$EVENT_TYPE" \
    --arg timestamp "$NOW" \
    '{ id: $id, type: $type, timestamp: $timestamp, data: {} }')

# 添加可选字段
if [[ -n "$STAGE" ]]; then
    EVENT=$(echo "$EVENT" | jq --arg s "$STAGE" '.data.stage = ($s | tonumber)')
fi

if [[ -n "$AGENT" ]]; then
    EVENT=$(echo "$EVENT" | jq --arg a "$AGENT" '.data.agent = $a')
fi

if [[ -n "$ARTIFACT" ]]; then
    EVENT=$(echo "$EVENT" | jq --arg a "$ARTIFACT" '.data.artifact = $a')
fi

if [[ -n "$GATE" ]]; then
    EVENT=$(echo "$EVENT" | jq --arg g "$GATE" '.data.gate = $g')
fi

if [[ -n "$PASSED" ]]; then
    EVENT=$(echo "$EVENT" | jq --argjson p "$PASSED" '.data.passed = $p')
fi

if [[ -n "$REASON" ]]; then
    EVENT=$(echo "$EVENT" | jq --arg r "$REASON" '.data.reason = $r')
fi

if [[ -n "$EXTRA_DATA" ]]; then
    EVENT=$(echo "$EVENT" | jq --argjson d "$EXTRA_DATA" '.data += $d')
fi

# 原子追加（使用 flock 如果可用，否则直接追加）
COMPACT=$(echo "$EVENT" | jq -c .)
if command -v flock >/dev/null 2>&1; then
    (flock -x 200; echo "$COMPACT" >> "$EVENTS_FILE") 200>"${EVENTS_FILE}.lock"
else
    echo "$COMPACT" >> "$EVENTS_FILE"
fi

info "事件 #$EVENT_ID ($EVENT_TYPE) 已追加到 $EVENTS_FILE" >&2
