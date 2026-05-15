---
name: qa/test-execution
description: 测试执行方法，包含测试框架检测、测试运行、结果解析
version: 1.0.0
agent: qa
type: methodology
user-invocable: false
agent-invocable: true
dependencies:
  - shared/tech-stack-detection
triggers:
  - 需要执行测试时
  - 需要验证测试覆盖率时
---

# 测试执行方法

## 强制要求：真实执行测试

**你必须真正执行测试，禁止生成 Mock 数据！**

## 测试执行流程

1. **检测项目类型和测试框架**
2. **根据项目类型执行测试**
3. **执行 E2E / 集成测试**
4. **解析测试输出**（总数、通过数、失败数、覆盖率）

## 测试框架检测

### JavaScript/TypeScript
- Jest: `jest.config.js`, `"jest"` in package.json
- Vitest: `vitest.config.js`, `"vitest"` in package.json
- Playwright: `playwright.config.js`
- Cypress: `cypress.json`

### Python
- pytest: `pytest.ini`, `"pytest"` in dependencies
- unittest: 内置

### Go
- `*_test.go` 文件

## 测试命令

| 语言 | 单元测试 | E2E测试 |
|------|----------|---------|
| Node.js | `npm test` | `npm run test:e2e` |
| Python | `pytest` | `pytest tests/e2e` |
| Go | `go test ./...` | - |
