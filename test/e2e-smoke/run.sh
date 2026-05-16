#!/usr/bin/env bash
# Playwright E2E 冒烟测试 - 验证框架能否在本地跑通
# 用法: bash test/e2e-smoke/run.sh
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
ROOT_DIR="$(cd "$SCRIPT_DIR/../.." && pwd)"

echo "=== Playwright E2E 冒烟测试 ==="
echo ""

# 1. 检查/安装 Playwright
if ! npx playwright --version >/dev/null 2>&1; then
  echo "[1/3] 安装 @playwright/test..."
  npm install -D @playwright/test
else
  echo "[1/3] Playwright 已安装: $(npx playwright --version)"
fi

# 2. 安装浏览器（仅 chromium 加速）
echo "[2/3] 确保 Chromium 浏览器已安装..."
npx playwright install chromium 2>&1 | tail -3

# 3. 确保 examples/api-auth 依赖就绪
if [ ! -d "$ROOT_DIR/examples/api-auth/node_modules" ]; then
  echo "     安装 examples/api-auth 依赖..."
  (cd "$ROOT_DIR/examples/api-auth" && npm install --silent)
fi

# 4. 运行测试
echo "[3/3] 运行 E2E 冒烟测试..."
echo ""

EXIT_CODE=0
npx playwright test \
  --config="$SCRIPT_DIR/playwright.config.ts" \
  --project=chromium 2>&1 || EXIT_CODE=$?

echo ""
if [ "$EXIT_CODE" -eq 0 ]; then
  echo "✅ Playwright E2E 冒烟测试通过！框架可正常运行。"
else
  echo "❌ 测试失败（exit code: $EXIT_CODE）"
  echo "   调试: npx playwright test --config=$SCRIPT_DIR/playwright.config.ts --debug"
  exit "$EXIT_CODE"
fi
