#!/bin/bash
# Boss Skill - OpenAI Codex 适配脚本
# 用途：在当前项目中初始化支持 OpenAI Codex 的 Boss Skill 目录结构

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

# 1. 确定目标目录 (Codex 默认扫描 .agents/skills/)
TARGET_DIR=".agents/skills/boss"

# 2. 检查当前是否在 boss-skill 仓库内运行
SRC_DIR="$(cd "$(dirname "$0")/.." && pwd)"

if [[ ! -f "$SRC_DIR/SKILL.md" ]]; then
    error "未找到 SKILL.md，请在 boss-skill 仓库根目录运行此脚本。"
fi

# 3. 创建目标目录
info "正在创建 OpenAI Codex 技能目录: $TARGET_DIR"
mkdir -p "$TARGET_DIR"

# 4. 复制必要文件
info "正在复制技能文件..."
cp -r "$SRC_DIR/agents" "$TARGET_DIR/"
cp -r "$SRC_DIR/references" "$TARGET_DIR/"
cp -r "$SRC_DIR/templates" "$TARGET_DIR/"
cp "$SRC_DIR/SKILL.md" "$TARGET_DIR/"

# 5. 提示
success "OpenAI Codex 适配完成！"
echo ""
echo "技能已安装到：$TARGET_DIR"
echo "现在你可以在当前项目中使用 OpenAI Codex 并通过 'boss mode' 触发技能了。"
echo "提示：如果是在全局安装，请手动复制到 ~/.codex/skills/boss"
echo ""
