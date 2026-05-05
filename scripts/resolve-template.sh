#!/bin/bash
# Boss Mode - 模板路径解析脚本
# 用途：按项目级模板优先规则解析单个模板文件路径

set -e

error() {
    echo "[ERROR] $1" >&2
    exit 1
}

if [[ $# -ne 1 ]]; then
    error "用法: $0 <template-name>"
fi

TEMPLATE_NAME="$1"
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
DEFAULT_TEMPLATE_DIR="$REPO_ROOT/skill/templates"
PROJECT_TEMPLATE_DIR=".boss/templates"

PROJECT_TEMPLATE_PATH="$PROJECT_TEMPLATE_DIR/$TEMPLATE_NAME"
DEFAULT_TEMPLATE_PATH="$DEFAULT_TEMPLATE_DIR/$TEMPLATE_NAME"

if [[ -f "$PROJECT_TEMPLATE_PATH" ]]; then
    printf '%s\n' "$PROJECT_TEMPLATE_PATH"
    exit 0
fi

if [[ -f "$DEFAULT_TEMPLATE_PATH" ]]; then
    printf '%s\n' "$DEFAULT_TEMPLATE_PATH"
    exit 0
fi

error "未找到模板文件: $TEMPLATE_NAME"
