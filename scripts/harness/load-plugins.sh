#!/bin/bash
set -e

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

info() { echo -e "${BLUE}[PLUGIN]${NC} $1"; }
success() { echo -e "${GREEN}[PLUGIN]${NC} $1"; }
warn() { echo -e "${YELLOW}[PLUGIN]${NC} $1"; }
error() { echo -e "${RED}[PLUGIN]${NC} $1" >&2; exit 1; }

show_help() {
    cat << 'EOF'
Boss Harness - 插件加载器

用法: load-plugins.sh [options]

选项:
  --list                 列出所有已注册插件
  --type <type>          按类型过滤：gate | agent | pipeline-pack | reporter
  --validate             验证所有插件的 plugin.json 格式
  --register <feature>   将已发现的插件注册到 execution.json
  --run-hook <hook> <feature> [stage]   执行指定 hook

钩子类型:
  pre-stage    阶段执行前
  post-stage   阶段执行后
  pre-gate     门禁检查前
  post-gate    门禁检查后

示例:
  load-plugins.sh --list
  load-plugins.sh --type gate
  load-plugins.sh --validate
  load-plugins.sh --register my-feature
  load-plugins.sh --run-hook pre-stage my-feature 1
EOF
}

PLUGIN_DIR="$REPO_ROOT/harness/plugins"

find_plugins() {
    local type_filter="${1:-}"
    if [[ ! -d "$PLUGIN_DIR" ]]; then
        return
    fi

    for plugin_json in "$PLUGIN_DIR"/*/plugin.json; do
        [[ -f "$plugin_json" ]] || continue

        local name=$(jq -r '.name' "$plugin_json" 2>/dev/null)
        local type=$(jq -r '.type' "$plugin_json" 2>/dev/null)
        local enabled=$(jq -r '.enabled // true' "$plugin_json" 2>/dev/null)

        if [[ "$enabled" != "true" ]]; then
            continue
        fi

        if [[ -n "$type_filter" && "$type" != "$type_filter" ]]; then
            continue
        fi

        echo "$plugin_json"
    done
}

ACTION=""
TYPE_FILTER=""
FEATURE=""
HOOK_NAME=""
STAGE=""

while [[ $# -gt 0 ]]; do
    case $1 in
        -h|--help) show_help; exit 0 ;;
        --list) ACTION="list"; shift ;;
        --type) TYPE_FILTER="$2"; shift 2 ;;
        --validate) ACTION="validate"; shift ;;
        --register) ACTION="register"; FEATURE="$2"; shift 2 ;;
        --run-hook)
            ACTION="run-hook"
            HOOK_NAME="$2"
            FEATURE="$3"
            STAGE="${4:-}"
            shift; shift; shift
            [[ -n "$STAGE" ]] && shift
            ;;
        -*)  error "未知选项: $1" ;;
        *)   error "多余的参数: $1" ;;
    esac
done

[[ -z "$ACTION" ]] && ACTION="list"

case "$ACTION" in
    list)
        FOUND=0
        for pj in $(find_plugins "$TYPE_FILTER"); do
            name=$(jq -r '.name' "$pj")
            version=$(jq -r '.version' "$pj")
            type=$(jq -r '.type' "$pj")
            desc=$(jq -r '.description // "—"' "$pj")
            echo "  $name@$version ($type) — $desc"
            FOUND=$((FOUND + 1))
        done

        if [[ "$FOUND" -eq 0 ]]; then
            info "未发现已注册插件（在 harness/plugins/ 中放置 plugin.json）"
        else
            info "共发现 $FOUND 个插件"
        fi
        ;;

    validate)
        SCHEMA="$REPO_ROOT/harness/plugin-schema.json"
        ALL_VALID=true

        for pj in $(find_plugins "$TYPE_FILTER"); do
            name=$(jq -r '.name' "$pj" 2>/dev/null)
            type=$(jq -r '.type' "$pj" 2>/dev/null)
            version=$(jq -r '.version' "$pj" 2>/dev/null)

            if [[ -z "$name" || "$name" == "null" ]]; then
                warn "无效插件（缺少 name）: $pj"
                ALL_VALID=false
                continue
            fi

            if [[ -z "$type" || "$type" == "null" ]]; then
                warn "无效插件（缺少 type）: $name"
                ALL_VALID=false
                continue
            fi

            if [[ "$type" == "gate" ]]; then
                gate_script=$(jq -r '.hooks.gate // empty' "$pj")
                if [[ -z "$gate_script" ]]; then
                    warn "$name: type=gate 但未定义 hooks.gate"
                    ALL_VALID=false
                else
                    plugin_dir=$(dirname "$pj")
                    if [[ ! -f "$plugin_dir/$gate_script" ]]; then
                        warn "$name: hooks.gate 指向不存在的文件: $gate_script"
                        ALL_VALID=false
                    fi
                fi
            fi

            success "$name@$version ($type) — 有效"
        done

        if [[ "$ALL_VALID" == true ]]; then
            success "所有插件验证通过"
        else
            error "部分插件验证失败"
        fi
        ;;

    register)
        [[ -z "$FEATURE" ]] && error "--register 需要指定 feature"
        EXEC_JSON=".boss/$FEATURE/.meta/execution.json"
        [[ -f "$EXEC_JSON" ]] || error "未找到执行文件: $EXEC_JSON"
        command -v jq >/dev/null 2>&1 || error "需要 jq 工具"

        PLUGINS="[]"
        for pj in $(find_plugins ""); do
            name=$(jq -r '.name' "$pj")
            version=$(jq -r '.version' "$pj")
            type=$(jq -r '.type' "$pj")
            PLUGINS=$(echo "$PLUGINS" | jq --arg n "$name" --arg v "$version" --arg t "$type" \
                '. += [{"name": $n, "version": $v, "type": $t}]')
        done

        TMP_FILE=$(mktemp)
        trap 'rm -f "$TMP_FILE"' EXIT
        jq --argjson plugins "$PLUGINS" '.plugins = $plugins' "$EXEC_JSON" > "$TMP_FILE" && mv "$TMP_FILE" "$EXEC_JSON"

        COUNT=$(echo "$PLUGINS" | jq 'length')
        success "已注册 $COUNT 个插件到 $EXEC_JSON"
        ;;

    run-hook)
        [[ -z "$HOOK_NAME" ]] && error "缺少 hook 名称"
        [[ -z "$FEATURE" ]] && error "缺少 feature 参数"

        info "执行 hook: $HOOK_NAME (feature=$FEATURE, stage=$STAGE)"

        for pj in $(find_plugins ""); do
            name=$(jq -r '.name' "$pj")
            hook_script=$(jq -r ".hooks[\"$HOOK_NAME\"] // empty" "$pj")

            if [[ -z "$hook_script" ]]; then
                continue
            fi

            if [[ -n "$STAGE" ]]; then
                PLUGIN_STAGES=$(jq -r '.stages // [] | .[]' "$pj")
                if [[ -n "$PLUGIN_STAGES" ]]; then
                    if ! echo "$PLUGIN_STAGES" | grep -qw "$STAGE"; then
                        continue
                    fi
                fi
            fi

            plugin_dir=$(dirname "$pj")
            FULL_PATH="$plugin_dir/$hook_script"

            if [[ ! -f "$FULL_PATH" ]]; then
                warn "$name: hook 脚本不存在: $FULL_PATH"
                continue
            fi

            info "执行 $name.$HOOK_NAME: $FULL_PATH"
            bash "$FULL_PATH" "$FEATURE" "$STAGE" || warn "$name.$HOOK_NAME 执行失败（非致命）"
        done
        ;;
esac
