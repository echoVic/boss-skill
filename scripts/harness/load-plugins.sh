#!/bin/bash
set -e

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
source "$SCRIPT_DIR/../lib/common.sh"
LOG_TAG="PLUGIN"

show_help() {
    cat << 'EOF'
Boss Harness - 插件加载器

用法: load-plugins.sh [options]

选项:
  --list                 列出所有已注册插件
  --type <type>          按类型过滤：gate | agent | pipeline-pack | reporter
  --validate             验证所有插件的 plugin.json 格式
  --register <feature>   追加插件注册事件并物化 read model（execution.json）
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

resolve_plugin_dir() {
    local cwd_plugin_dir="$(pwd)/harness/plugins"
    if [[ -d "$cwd_plugin_dir" ]]; then
        echo "$cwd_plugin_dir"
        return
    fi
    echo "$REPO_ROOT/harness/plugins"
}

PLUGIN_DIR="$(resolve_plugin_dir)"

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
            [[ -z "${2:-}" ]] && error "--run-hook 需要指定 hook 名称"
            [[ -z "${3:-}" ]] && error "--run-hook 需要指定 feature 参数"
            HOOK_NAME="$2"
            FEATURE="$3"
            STAGE="${4:-}"
            shift 3
            [[ -n "$STAGE" ]] && shift
            ;;
        -*)  error "未知选项: $1" ;;
        *)   error "多余的参数: $1" ;;
    esac
done

[[ -z "$ACTION" ]] && ACTION="list"

case "$ACTION" in
    list)
        CLI_ARGS=(--list)
        [[ -n "$TYPE_FILTER" ]] && CLI_ARGS+=(--type "$TYPE_FILTER")
        node "$REPO_ROOT/packages/boss-cli/dist/bin/boss.js" runtime register-plugins "${CLI_ARGS[@]}"
        ;;

    validate)
        CLI_ARGS=(--validate)
        [[ -n "$TYPE_FILTER" ]] && CLI_ARGS+=(--type "$TYPE_FILTER")
        node "$REPO_ROOT/packages/boss-cli/dist/bin/boss.js" runtime register-plugins "${CLI_ARGS[@]}"
        ;;

    register)
        [[ -z "$FEATURE" ]] && error "--register 需要指定 feature"
        CLI_ARGS=(--register "$FEATURE")
        [[ -n "$TYPE_FILTER" ]] && CLI_ARGS+=(--type "$TYPE_FILTER")
        node "$REPO_ROOT/packages/boss-cli/dist/bin/boss.js" runtime register-plugins "${CLI_ARGS[@]}"
        ;;

    run-hook)
        [[ -z "$HOOK_NAME" ]] && error "缺少 hook 名称"
        [[ -z "$FEATURE" ]] && error "缺少 feature 参数"
        CLI_ARGS=("$HOOK_NAME" "$FEATURE")
        [[ -n "$STAGE" ]] && CLI_ARGS+=(--stage "$STAGE")
        node "$REPO_ROOT/packages/boss-cli/dist/bin/boss.js" runtime run-plugin-hook "${CLI_ARGS[@]}"
        ;;
esac
