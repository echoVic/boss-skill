#!/bin/bash
set -e

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

info() { echo -e "${BLUE}[SECURITY]${NC} $1" >&2; }
pass() { echo -e "${GREEN}[SECURITY]${NC} ✅ $1" >&2; }
fail() { echo -e "${RED}[SECURITY]${NC} ❌ $1" >&2; }

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

info "Security Audit Gate"
info "========================"

SECRET_PATTERNS=(
    "AKIA[0-9A-Z]{16}"
    "(?i)(api[_-]?key|apikey|secret[_-]?key|access[_-]?token)\s*[:=]\s*['\"][a-zA-Z0-9/+]{20,}"
    "-----BEGIN (RSA |EC |DSA )?PRIVATE KEY-----"
    "ghp_[a-zA-Z0-9]{36}"
    "sk-[a-zA-Z0-9]{48}"
)

SECRETS_FOUND=0
for pattern in "${SECRET_PATTERNS[@]}"; do
    if grep -rPl "$pattern" --include="*.ts" --include="*.js" --include="*.py" --include="*.go" --include="*.json" --include="*.env" --include="*.yaml" --include="*.yml" . 2>/dev/null | grep -v node_modules | grep -v ".git" | head -5 | grep -q .; then
        SECRETS_FOUND=$((SECRETS_FOUND + 1))
    fi
done

if [[ "$SECRETS_FOUND" -gt 0 ]]; then
    fail "检测到 $SECRETS_FOUND 类潜在敏感信息泄露"
    add_check "secrets-scan" false "发现 $SECRETS_FOUND 类敏感信息模式"
    ALL_PASSED=false
else
    pass "未检测到敏感信息泄露"
    add_check "secrets-scan" true
fi

if [[ -f "package.json" ]] && command -v npm >/dev/null 2>&1; then
    info "检查 npm 依赖安全漏洞..."
    AUDIT_JSON=$(npm audit --json 2>/dev/null || echo '{}')
    HIGH_VULNS=$(echo "$AUDIT_JSON" | jq '.metadata.vulnerabilities.high // 0' 2>/dev/null || echo "0")
    CRITICAL_VULNS=$(echo "$AUDIT_JSON" | jq '.metadata.vulnerabilities.critical // 0' 2>/dev/null || echo "0")
    TOTAL_SEVERE=$((HIGH_VULNS + CRITICAL_VULNS))

    if [[ "$TOTAL_SEVERE" -gt 0 ]]; then
        fail "发现 $TOTAL_SEVERE 个高危/严重依赖漏洞（高: $HIGH_VULNS, 严重: $CRITICAL_VULNS）"
        add_check "dependency-vulnerabilities" false "$TOTAL_SEVERE 个高危漏洞"
        ALL_PASSED=false
    else
        pass "无高危依赖漏洞"
        add_check "dependency-vulnerabilities" true
    fi
elif [[ -f "requirements.txt" ]] && command -v pip-audit >/dev/null 2>&1; then
    info "检查 Python 依赖安全漏洞..."
    if pip-audit 2>/dev/null; then
        pass "Python 依赖无已知漏洞"
        add_check "dependency-vulnerabilities" true
    else
        fail "Python 依赖存在安全漏洞"
        add_check "dependency-vulnerabilities" false "pip-audit 发现漏洞"
        ALL_PASSED=false
    fi
else
    add_check "dependency-vulnerabilities" true "跳过：无包管理器或审计工具"
fi

UNSAFE_PATTERNS=0
UNSAFE_FILES=""

if grep -rl "eval(" --include="*.js" --include="*.ts" . 2>/dev/null | grep -v node_modules | grep -v ".git" | head -3 | grep -q .; then
    UNSAFE_PATTERNS=$((UNSAFE_PATTERNS + 1))
    UNSAFE_FILES="eval() "
fi

if grep -rl "dangerouslySetInnerHTML" --include="*.jsx" --include="*.tsx" . 2>/dev/null | grep -v node_modules | head -3 | grep -q .; then
    UNSAFE_PATTERNS=$((UNSAFE_PATTERNS + 1))
    UNSAFE_FILES+="dangerouslySetInnerHTML "
fi

if grep -rl "innerHTML\s*=" --include="*.js" --include="*.ts" . 2>/dev/null | grep -v node_modules | grep -v ".git" | head -3 | grep -q .; then
    UNSAFE_PATTERNS=$((UNSAFE_PATTERNS + 1))
    UNSAFE_FILES+="innerHTML "
fi

if [[ "$UNSAFE_PATTERNS" -gt 0 ]]; then
    fail "检测到 $UNSAFE_PATTERNS 类不安全代码模式: $UNSAFE_FILES"
    add_check "unsafe-patterns" false "发现: $UNSAFE_FILES"
    ALL_PASSED=false
else
    pass "未检测到常见不安全代码模式"
    add_check "unsafe-patterns" true
fi

echo "$CHECKS"
[[ "$ALL_PASSED" == true ]] && exit 0 || exit 1
