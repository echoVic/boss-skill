#!/bin/bash
set -e

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

info() { echo -e "${BLUE}[GATE1]${NC} $1" >&2; }
pass() { echo -e "${GREEN}[GATE1]${NC} ✅ $1" >&2; }
fail() { echo -e "${RED}[GATE1]${NC} ❌ $1" >&2; }

FEATURE="${1:-}"
CHECKS="[]"

add_check() {
    local name="$1" passed="$2" detail="${3:-}"
    CHECKS=$(echo "$CHECKS" | jq \
        --arg name "$name" \
        --argjson passed "$passed" \
        --arg detail "$detail" \
        '. += [{"name": $name, "passed": $passed, "detail": $detail}]')
}

ALL_PASSED=true

info "Gate 1: 测试门禁"
info "========================"

TEST_CMD=""
COVERAGE_CMD=""

if [[ -f "package.json" ]]; then
    HAS_VITEST=$(jq -r '.devDependencies.vitest // .dependencies.vitest // empty' package.json 2>/dev/null)
    HAS_JEST=$(jq -r '.devDependencies.jest // .dependencies.jest // empty' package.json 2>/dev/null)

    if [[ -n "$HAS_VITEST" ]]; then
        TEST_CMD="npx vitest run"
        COVERAGE_CMD="npx vitest run --coverage --reporter=json"
    elif [[ -n "$HAS_JEST" ]]; then
        TEST_CMD="npx jest"
        COVERAGE_CMD="npx jest --coverage --coverageReporters=json-summary"
    else
        TEST_SCRIPT=$(jq -r '.scripts.test // empty' package.json 2>/dev/null)
        if [[ -n "$TEST_SCRIPT" && "$TEST_SCRIPT" != "echo \"Error: no test specified\" && exit 1" ]]; then
            TEST_CMD="npm test"
        fi
    fi
elif [[ -f "pyproject.toml" ]]; then
    if command -v pytest >/dev/null 2>&1; then
        TEST_CMD="pytest"
        COVERAGE_CMD="pytest --cov --cov-report=json"
    fi
elif [[ -f "Cargo.toml" ]]; then
    TEST_CMD="cargo test"
elif [[ -f "go.mod" ]]; then
    TEST_CMD="go test ./..."
    COVERAGE_CMD="go test -coverprofile=coverage.out ./..."
fi

if [[ -z "$TEST_CMD" ]]; then
    info "未检测到测试框架，跳过测试门禁"
    add_check "unit-tests" true "跳过：未检测到测试框架"
    add_check "coverage" true "跳过：未检测到测试框架"
    add_check "e2e-tests" true "跳过：未检测到测试框架"
    echo "$CHECKS"
    exit 0
fi

info "执行单元测试: $TEST_CMD"
if eval "$TEST_CMD" 2>/dev/null; then
    pass "单元测试全部通过"
    add_check "unit-tests" true
else
    fail "单元测试有失败"
    add_check "unit-tests" false "$TEST_CMD 执行失败"
    ALL_PASSED=false
fi

if [[ -n "$COVERAGE_CMD" ]]; then
    info "检查测试覆盖率..."
    COVERAGE_OUTPUT=$(eval "$COVERAGE_CMD" 2>/dev/null || true)

    COVERAGE_PCT=""
    if [[ -f "coverage/coverage-summary.json" ]]; then
        COVERAGE_PCT=$(jq -r '.total.lines.pct // .total.statements.pct // empty' coverage/coverage-summary.json 2>/dev/null)
    elif [[ -f "coverage.json" ]]; then
        COVERAGE_PCT=$(jq -r '.totals.percent_covered // empty' coverage.json 2>/dev/null)
    elif [[ -f "coverage.out" ]]; then
        COVERAGE_PCT=$(go tool cover -func=coverage.out 2>/dev/null | tail -1 | awk '{print $NF}' | tr -d '%')
    fi

    if [[ -n "$COVERAGE_PCT" ]]; then
        COVERAGE_INT=${COVERAGE_PCT%.*}
        if [[ "$COVERAGE_INT" -ge 70 ]]; then
            pass "测试覆盖率: ${COVERAGE_PCT}% (≥ 70%)"
            add_check "coverage" true "${COVERAGE_PCT}%"
        else
            fail "测试覆盖率: ${COVERAGE_PCT}% (< 70%)"
            add_check "coverage" false "${COVERAGE_PCT}% < 70%"
            ALL_PASSED=false
        fi
    else
        info "无法解析覆盖率数据"
        add_check "coverage" true "无法解析覆盖率，跳过"
    fi
else
    info "跳过覆盖率检查（无覆盖率命令）"
    add_check "coverage" true "跳过：无覆盖率工具"
fi

E2E_FOUND=false
if [[ -f "playwright.config.ts" || -f "playwright.config.js" ]]; then
    info "执行 Playwright E2E 测试..."
    E2E_FOUND=true
    if npx playwright test 2>/dev/null; then
        pass "Playwright E2E 测试通过"
        add_check "e2e-tests" true "Playwright"
    else
        fail "Playwright E2E 测试失败"
        add_check "e2e-tests" false "Playwright 测试失败"
        ALL_PASSED=false
    fi
elif [[ -f "cypress.config.ts" || -f "cypress.config.js" ]]; then
    info "执行 Cypress E2E 测试..."
    E2E_FOUND=true
    if npx cypress run 2>/dev/null; then
        pass "Cypress E2E 测试通过"
        add_check "e2e-tests" true "Cypress"
    else
        fail "Cypress E2E 测试失败"
        add_check "e2e-tests" false "Cypress 测试失败"
        ALL_PASSED=false
    fi
fi

if [[ "$E2E_FOUND" == false ]]; then
    E2E_DIR_EXISTS=false
    for dir in "tests/e2e" "e2e" "test/e2e" "cypress/e2e"; do
        if [[ -d "$dir" ]] && find "$dir" -name "*.test.*" -o -name "*.spec.*" -o -name "*.cy.*" 2>/dev/null | head -1 | grep -q .; then
            E2E_DIR_EXISTS=true
            break
        fi
    done

    if [[ "$E2E_DIR_EXISTS" == true ]]; then
        info "检测到 E2E 测试目录但无配置文件"
        add_check "e2e-tests" true "检测到 E2E 目录，但无配置文件"
    else
        info "未检测到 E2E 测试"
        add_check "e2e-tests" true "跳过：未检测到 E2E 测试框架"
    fi
fi

echo "$CHECKS"
[[ "$ALL_PASSED" == true ]] && exit 0 || exit 1
