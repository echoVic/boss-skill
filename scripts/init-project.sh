#!/bin/bash
# Boss Mode - 项目初始化脚本
# 用途：初始化 .boss/<feature>/ 目录结构

set -e

# 颜色定义
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# 显示帮助信息
show_help() {
    echo "Boss Mode - 项目初始化脚本"
    echo ""
    echo "用法: $0 <feature-name> [options]"
    echo ""
    echo "参数:"
    echo "  feature-name    功能名称（必需）"
    echo ""
    echo "选项:"
    echo "  -h, --help      显示帮助信息"
    echo "  -f, --force     强制覆盖已存在的目录"
    echo ""
    echo "示例:"
    echo "  $0 user-auth"
    echo "  $0 todo-app --force"
}

# 打印信息
info() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

warn() {
    echo -e "${YELLOW}[WARN]${NC} $1"
}

error() {
    echo -e "${RED}[ERROR]${NC} $1"
    exit 1
}

# 解析参数
FEATURE_NAME=""
FORCE=false

while [[ $# -gt 0 ]]; do
    case $1 in
        -h|--help)
            show_help
            exit 0
            ;;
        -f|--force)
            FORCE=true
            shift
            ;;
        -*)
            error "未知选项: $1"
            ;;
        *)
            if [[ -z "$FEATURE_NAME" ]]; then
                FEATURE_NAME="$1"
            else
                error "多余的参数: $1"
            fi
            shift
            ;;
    esac
done

# 验证参数
if [[ -z "$FEATURE_NAME" ]]; then
    error "请提供功能名称"
fi

# 验证名称格式（仅允许字母、数字、连字符）
if [[ ! "$FEATURE_NAME" =~ ^[a-z0-9][a-z0-9-]*[a-z0-9]$ ]] && [[ ! "$FEATURE_NAME" =~ ^[a-z0-9]$ ]]; then
    error "功能名称格式无效（仅允许小写字母、数字和连字符，不能以连字符开头或结尾）"
fi

# 目标目录
TARGET_DIR=".boss/$FEATURE_NAME"

# 检查目录是否存在
if [[ -d "$TARGET_DIR" ]]; then
    if [[ "$FORCE" == true ]]; then
        warn "目录已存在，将被覆盖: $TARGET_DIR"
        rm -rf "$TARGET_DIR"
    else
        error "目录已存在: $TARGET_DIR（使用 --force 覆盖）"
    fi
fi

# 创建目录结构
info "创建目录: $TARGET_DIR"
mkdir -p "$TARGET_DIR"

# 获取当前日期
DATE=$(date +%Y-%m-%d)

# 创建占位文件
info "创建占位文件..."

# PRD 占位
cat > "$TARGET_DIR/prd.md" << EOF
# 产品需求文档 (PRD)

## 文档信息
- **功能名称**：$FEATURE_NAME
- **创建日期**：$DATE
- **状态**：待填充

---

> 此文件将由 PM Agent 自动填充

EOF

# 架构文档占位
cat > "$TARGET_DIR/architecture.md" << EOF
# 系统架构文档

## 文档信息
- **功能名称**：$FEATURE_NAME
- **创建日期**：$DATE
- **状态**：待填充

---

> 此文件将由 Architect Agent 自动填充

EOF

# UI 规范占位
cat > "$TARGET_DIR/ui-spec.md" << EOF
# UI/UX 规范文档

## 文档信息
- **功能名称**：$FEATURE_NAME
- **创建日期**：$DATE
- **状态**：待填充

---

> 此文件将由 UI Designer Agent 自动填充

EOF

# 用户故事占位
cat > "$TARGET_DIR/stories.md" << EOF
# 用户故事分解文档

## 文档信息
- **功能名称**：$FEATURE_NAME
- **创建日期**：$DATE
- **状态**：待填充

---

> 此文件将由 Tech Lead Agent 自动填充

EOF

# 开发任务占位
cat > "$TARGET_DIR/tasks.md" << EOF
# 开发任务规格文档

## 文档信息
- **功能名称**：$FEATURE_NAME
- **创建日期**：$DATE
- **状态**：待填充

---

> 此文件将由 Scrum Master Agent 自动填充

EOF

# QA 报告占位
cat > "$TARGET_DIR/qa-report.md" << EOF
# QA 测试报告

## 报告信息
- **功能名称**：$FEATURE_NAME
- **创建日期**：$DATE
- **状态**：待填充

---

> 此文件将由 QA Agent 自动填充

EOF

# 部署报告占位
cat > "$TARGET_DIR/deploy-report.md" << EOF
# 部署报告

## 报告信息
- **功能名称**：$FEATURE_NAME
- **创建日期**：$DATE
- **状态**：待填充

---

> 此文件将由 DevOps Agent 自动填充

EOF

# 完成
success "Boss Mode 项目目录初始化完成！"
echo ""
echo "目录结构："
echo "  $TARGET_DIR/"
echo "  ├── prd.md"
echo "  ├── architecture.md"
echo "  ├── ui-spec.md"
echo "  ├── stories.md"
echo "  ├── tasks.md"
echo "  ├── qa-report.md"
echo "  └── deploy-report.md"
echo ""
echo "下一步：运行 /boss 开始开发流程"
