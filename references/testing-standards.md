# 测试标准

## 测试金字塔

| 测试类型 | 占比 | 要求 | 测试目录 |
|----------|------|------|----------|
| **单元测试** | ~70% | 每个函数/组件必须有测试，覆盖率 ≥70% | `tests/` 或 `__tests__/` |
| **集成测试** | ~20% | API 端点、组件交互、数据库操作 | `tests/integration/` |
| **E2E 测试** | ~10% | **必须编写**，覆盖核心用户流程 | `tests/e2e/` 或 `e2e/` |

## E2E 测试必须覆盖

问自己：**用户最常用的 5 个操作是什么？** 这些必须有 E2E 测试。

至少覆盖：
- 创建流程（如：添加数据）
- 编辑流程（如：修改数据）
- 删除流程（如：删除数据）
- 列表展示（如：查看列表）
- 核心业务流程

## 测试执行命令

```bash
# 单元测试
npm test 或 vitest run --coverage

# 集成测试
npm run test:integration

# E2E 测试
npx playwright test 或 npx cypress run
```

## 测试失败处理

⚠️ 任何测试失败则暂停，修复后继续。不允许跳过失败的测试。

---

## 测试命名规范

- **describe 块**：以被测模块/组件/函数命名
- **it/test 块**：用行为描述命名，格式为 "[动作] when [条件]" 或 "[期望行为]"
- 避免 "should" 前缀 — 直接描述预期行为
- 示例：`it('returns empty array when no items match')` 而非 `it('should return empty array')`

## Mock 策略

| 原则 | 说明 |
|------|------|
| **Mock 边界** | 只 Mock 外部依赖（网络、文件系统、数据库），不 Mock 被测模块内部 |
| **避免过度 Mock** | 如果需要 Mock 超过 3 个依赖，考虑重构被测代码 |
| **真实优先** | 能用真实实现就不用 Mock（如内存数据库代替 Mock DB） |
| **Mock 验证** | Mock 的返回值应反映真实行为，定期与实际依赖同步 |

## 异步测试模式

- 始终 `await` 异步操作，不使用 `.then()` 链
- 为异步测试设置合理超时（避免默认 5s 不够的情况）
- 使用 `vi.useFakeTimers()` / `jest.useFakeTimers()` 测试定时器逻辑
- 警惕竞态条件：不依赖事件顺序，使用 `waitFor` / `eventually` 模式

## 测试隔离

- **无共享状态**：每个测试独立运行，beforeEach 重建上下文
- **确定性**：测试结果不依赖运行顺序或时间
- **清理**：afterEach 清理临时文件、恢复环境变量
- **独立数据**：每个测试生成自己的测试数据

## 多语言测试命令

| 语言 | 单元测试 | 集成测试 | 覆盖率 |
|------|---------|---------|--------|
| Node.js | `vitest run` / `jest` / `mocha` | `vitest run tests/integration` | `vitest run --coverage` |
| Python | `pytest` | `pytest tests/integration` | `pytest --cov` |
| Go | `go test ./...` | `go test -tags=integration ./...` | `go test -coverprofile=coverage.out ./...` |
| Rust | `cargo test` | `cargo test --test integration` | `cargo tarpaulin` |
| Java | `mvn test` / `gradle test` | `mvn verify` | `mvn jacoco:report` |
