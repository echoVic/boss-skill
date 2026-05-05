#!/bin/bash
# Boss Mode - 项目初始化脚本
# 用途：初始化 .boss/<feature>/ 目录结构，并按需初始化项目级模板目录

set -e

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
source "$SCRIPT_DIR/lib/common.sh"
LOG_TAG="BOSS"

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
    echo "  -t, --template  初始化项目级模板目录（.boss/templates）"
    echo "  -f, --force     强制覆盖已存在的目录"
    echo ""
    echo "示例:"
    echo "  $0 user-auth"
    echo "  $0 user-auth --template"
    echo "  $0 todo-app --force"
}

# 解析参数
FEATURE_NAME=""
FORCE=false
INIT_TEMPLATES=false
SKIP_FEATURE_BOOTSTRAP=false
DEFAULT_TEMPLATE_DIR="$REPO_ROOT/templates"
PROJECT_TEMPLATE_DIR=".boss/templates"

init_templates() {
    if [[ ! -d "$DEFAULT_TEMPLATE_DIR" ]]; then
        error "未找到内置模板目录: $DEFAULT_TEMPLATE_DIR"
    fi

    if [[ -d "$PROJECT_TEMPLATE_DIR" ]]; then
        if [[ "$FORCE" == true ]]; then
            warn "模板目录已存在，将被覆盖: $PROJECT_TEMPLATE_DIR"
            rm -rf "$PROJECT_TEMPLATE_DIR"
        else
            error "模板目录已存在: '$PROJECT_TEMPLATE_DIR'. 为避免覆盖，已停止初始化。你可以先删除 templates 目录后重试。"
        fi
    fi

    info "初始化项目级模板目录: $PROJECT_TEMPLATE_DIR"
    mkdir -p "$PROJECT_TEMPLATE_DIR"

    while IFS= read -r template_path; do
        local_rel_path="${template_path#$DEFAULT_TEMPLATE_DIR/}"
        target_path="$PROJECT_TEMPLATE_DIR/$local_rel_path"

        mkdir -p "$(dirname "$target_path")"

        cp "$template_path" "$target_path"
        info "写入模板: $target_path"
    done < <(find "$DEFAULT_TEMPLATE_DIR" -type f -name '*.template' | sort)

    cat > "$PROJECT_TEMPLATE_DIR/README.md" << EOF
# Boss 项目模板说明

此目录中的模板会覆盖 Skill 内置模板。

模板查找优先级：
1. \`.boss/templates/<name>.template\`
2. Skill 内置 \`templates/<name>.template\`

建议：
- 保留 \`## 摘要\` section，方便下游 Agent 摘要优先读取
- 保留核心文件名（如 \`prd.md\`、\`tasks.md\`），避免破坏流水线约定
- 可以根据团队规范自由调整章节结构、字段顺序和文案风格

说明：
- \`scripts/init-project.sh\` 只负责初始化轻量占位文件
- Boss 在真正生成某个产物前，会调用 \`scripts/prepare-artifact.sh\` 按相同优先级准备当前文档骨架
EOF

    success "项目级模板初始化完成"
}

while [[ $# -gt 0 ]]; do
    case $1 in
        -h|--help)
            show_help
            exit 0
            ;;
        -t|--template)
            INIT_TEMPLATES=true
            shift
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

# 初始化项目级模板
if [[ "$INIT_TEMPLATES" == true ]]; then
    init_templates
    echo ""
    echo "模板目录："
    echo "  $PROJECT_TEMPLATE_DIR/"
    echo "你可以先修改模板，再运行 /boss 或重新执行初始化脚本。"
    echo ""
fi

# 目标目录
TARGET_DIR=".boss/$FEATURE_NAME"

# 检查目录是否存在
if [[ -d "$TARGET_DIR" ]]; then
    if [[ "$FORCE" == true ]]; then
        warn "目录已存在，将被覆盖: $TARGET_DIR"
        rm -rf "$TARGET_DIR"
    elif [[ "$INIT_TEMPLATES" == true ]]; then
        warn "目录已存在，将保留现有产物: $TARGET_DIR"
        SKIP_FEATURE_BOOTSTRAP=true
    else
        error "目录已存在: $TARGET_DIR（使用 --force 覆盖）"
    fi
fi

if [[ "$SKIP_FEATURE_BOOTSTRAP" != true ]]; then
    # 创建目录结构
    info "创建目录: $TARGET_DIR"
    mkdir -p "$TARGET_DIR"
    mkdir -p "$TARGET_DIR/.meta"

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

# 技术评审占位
cat > "$TARGET_DIR/tech-review.md" << EOF
# 技术评审报告

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

# 初始化运行时元数据与事件流
command -v node >/dev/null 2>&1 || error "需要 node 才能运行初始化流程"
node "$REPO_ROOT/packages/boss-cli/dist/bin/boss.js" runtime init-pipeline "$FEATURE_NAME" >/dev/null

    # 完成
    success "Boss Mode 项目目录初始化完成！"
    echo ""
    echo "目录结构："
    echo "  $TARGET_DIR/"
    echo "  ├── prd.md"
    echo "  ├── architecture.md"
    echo "  ├── ui-spec.md"
    echo "  ├── tech-review.md"
    echo "  ├── tasks.md"
    echo "  ├── qa-report.md"
    echo "  ├── deploy-report.md"
    echo "  └── .meta/"
    echo "      └── execution.json"
    echo ""
else
    info "跳过 feature 初始化，继续保留现有目录内容: $TARGET_DIR"
    echo ""
fi

if [[ "$INIT_TEMPLATES" == true ]]; then
    echo "下一步：先修改 .boss/templates/ 中的模板，再运行 /boss 开始开发流程"
else
    echo "提示：如需自定义文档模板，可先运行 $0 <feature-name> --template"
    echo "下一步：运行 /boss 开始开发流程"
fi
