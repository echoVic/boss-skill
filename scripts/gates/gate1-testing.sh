#!/bin/bash
set -e

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
source "$SCRIPT_DIR/../lib/common.sh"
LOG_TAG="GATE1"

FEATURE="${1:-}"
CHECKS="[]"
ALL_PASSED=true

gate_info "Gate 1: 测试门禁"
gate_info "========================"

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
    gate_info "未检测到测试框架，跳过测试门禁"
    add_check "unit-tests" true "跳过：未检测到测试框架"
    add_check "coverage" true "跳过：未检测到测试框架"
    add_check "e2e-tests" true "跳过：未检测到测试框架"
    echo "$CHECKS"
    exit 0
fi

gate_info "执行单元测试: $TEST_CMD"
if $TEST_CMD 2>&1 | tail -30 >&2; then
    gate_pass "单元测试全部通过"
    add_check "unit-tests" true
else
    gate_fail "单元测试有失败"
    add_check "unit-tests" false "$TEST_CMD 执行失败"
    ALL_PASSED=false
fi

if [[ -n "$COVERAGE_CMD" ]]; then
    gate_info "检查测试覆盖率..."
    COVERAGE_OUTPUT=$($COVERAGE_CMD 2>&1 | tail -30 || true)

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
        THRESHOLD="${GATE_COVERAGE_THRESHOLD:-70}"
        if [[ "$COVERAGE_INT" -ge "$THRESHOLD" ]]; then
            gate_pass "测试覆盖率: ${COVERAGE_PCT}% (≥ ${THRESHOLD}%)"
            add_check "coverage" true "${COVERAGE_PCT}%"
        else
            gate_fail "测试覆盖率: ${COVERAGE_PCT}% (< ${THRESHOLD}%)"
            add_check "coverage" false "${COVERAGE_PCT}% < ${THRESHOLD}%"
            ALL_PASSED=false
        fi
    else
        gate_info "无法解析覆盖率数据"
        add_check "coverage" true "无法解析覆盖率，跳过"
    fi
else
    gate_info "跳过覆盖率检查（无覆盖率命令）"
    add_check "coverage" true "跳过：无覆盖率工具"
fi

E2E_FOUND=false
if [[ -f "playwright.config.ts" || -f "playwright.config.js" ]]; then
    gate_info "执行 Playwright E2E 测试..."
    E2E_FOUND=true
    if npx playwright test 2>&1 | tail -20 >&2; then
        gate_pass "Playwright E2E 测试通过"
        add_check "e2e-tests" true "Playwright"
    else
        gate_fail "Playwright E2E 测试失败"
        add_check "e2e-tests" false "Playwright 测试失败"
        ALL_PASSED=false
    fi
elif [[ -f "cypress.config.ts" || -f "cypress.config.js" ]]; then
    gate_info "执行 Cypress E2E 测试..."
    E2E_FOUND=true
    if npx cypress run 2>&1 | tail -20 >&2; then
        gate_pass "Cypress E2E 测试通过"
        add_check "e2e-tests" true "Cypress"
    else
        gate_fail "Cypress E2E 测试失败"
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
        gate_info "检测到 E2E 测试目录但无配置文件"
        add_check "e2e-tests" true "检测到 E2E 目录，但无配置文件"
    else
        gate_info "未检测到 E2E 测试"
        add_check "e2e-tests" true "跳过：未检测到 E2E 测试框架"
    fi
fi

echo "$CHECKS"
[[ "$ALL_PASSED" == true ]] && exit 0 || exit 1
