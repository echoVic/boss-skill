#!/bin/bash
# Boss Skill - Google Antigravity 适配脚本
# 用途：在当前项目中初始化支持 Google Antigravity 的 Boss Skill 目录结构

set -e

# 颜色定义
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

info() { echo -e "${BLUE}[INFO]${NC} $1"; }
success() { echo -e "${GREEN}[SUCCESS]${NC} $1"; }
warn() { echo -e "${YELLOW}[WARN]${NC} $1"; }
error() { echo -e "${RED}[ERROR]${NC} $1"; exit 1; }

# 1. 确定目标目录
TARGET_DIR=".agent/skills/boss"

# 2. 检查当前是否在 boss-skill 仓库内运行，或者是否已克隆
SRC_DIR="$(cd "$(dirname "$0")/.." && pwd)"

if [[ ! -f "$SRC_DIR/SKILL.md" ]]; then
    error "未找到 SKILL.md，请在 boss-skill 仓库根目录运行此脚本。"
fi

# 3. 创建目标目录
info "正在创建 Antigravity 技能目录: $TARGET_DIR"
mkdir -p "$TARGET_DIR"

# 4. 复制必要文件
info "正在复制技能文件..."
cp -r "$SRC_DIR/agents" "$TARGET_DIR/"
cp -r "$SRC_DIR/references" "$TARGET_DIR/"
cp -r "$SRC_DIR/templates" "$TARGET_DIR/"

# 5. 适配 SKILL.md (处理可能存在的 Markdown 表格元数据)
info "正在适配 SKILL.md 格式..."

# 读取原始 SKILL.md
ORIG_SKILL="$SRC_DIR/SKILL.md"
TARGET_SKILL="$TARGET_DIR/SKILL.md"

# 如果已经是 YAML (以 --- 开头)，直接复制
if head -n 1 "$ORIG_SKILL" | grep -q "^---"; then
    cp "$ORIG_SKILL" "$TARGET_SKILL"
    info "检测到 YAML 头部，直接同步。"
else
    # 尝试从 Markdown 表格中提取 (针对旧版 Claude Code 格式)
    info "检测到 Markdown 表格格式，正在转换为 YAML 头部..."
    
    NAME=$(grep "^|" "$ORIG_SKILL" | grep -v "---" | head -n 2 | tail -n 1 | cut -d'|' -f2 | sed 's/^[[:space:]]*//;s/[[:space:]]*$//' || echo "boss")
    DESC=$(grep "^|" "$ORIG_SKILL" | grep -v "---" | head -n 2 | tail -n 1 | cut -d'|' -f3 | sed 's/^[[:space:]]*//;s/[[:space:]]*$//' || echo "BMAD 全自动项目编排 Skill")
    
    # 写入带有 YAML 头部的新文件
    {
        echo "---"
        echo "name: $NAME"
        echo "description: \"$DESC\""
        echo "---"
        echo ""
        # 排除掉原始表格（通常是前 3 行）
        grep -v "^|" "$ORIG_SKILL"
    } > "$TARGET_SKILL"
fi

# 6. 完成
success "Google Antigravity 适配完成！"
echo ""
echo "技能已安装到：$TARGET_DIR"
echo "现在你可以在当前项目中使用 Google Antigravity 并触发 'boss' 技能了。"
echo ""
