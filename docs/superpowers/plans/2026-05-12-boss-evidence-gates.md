# Boss Evidence Gates Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make Boss evidence-driven by requiring repo preflight, wave-level TDD evidence, cross-layer contract matrices, real-path QA evidence, and evidence-first final reports.

**Architecture:** This is a prompt/template/report enhancement. Documentation contract tests pin the required language, agent prompts and templates carry the new workflow, and the Markdown summary renderer presents existing execution evidence before document inventory.

**Tech Stack:** TypeScript, Vitest, Markdown skill prompts, Boss runtime report renderer.

---

## File Structure

- Modify `test/runtime/docs-contract.test.ts`: add contract tests for repo preflight, evidence-driven waves, contract matrix, QA attack protocol, and critical-path mock boundaries.
- Modify `test/runtime/report-runtime.test.ts`: add assertions that final Markdown reports render evidence sections before artifact inventory.
- Modify `skill/SKILL.md`: add required repo preflight and code-stage blocking rules for missing preflight, wave gates, or contract matrix.
- Modify `skill/agents/boss-scrum-master.md`: require acceptance waves, red tests, green gates, stop conditions, and contract matrix.
- Modify `skill/agents/boss-qa.md`: add real-path attacker QA requirements and unverified-core-path handling.
- Modify `skill/references/testing-standards.md`: add schema-backed submit tests, red-to-green evidence, and critical-path mock rules.
- Modify `skill/templates/tasks.md.template`: add repo preflight summary, evidence-driven wave plan, contract matrix, and red/green gate tables.
- Modify `skill/templates/qa-report.md.template`: add core journey replay, command evidence, payload/schema evidence, attack checks, and residual risk sections.
- Modify `packages/boss-cli/src/runtime/report/render-markdown.ts`: reorder summary output to put evidence sections before artifacts.

## Task 1: Add Documentation Contract Tests

**Files:**
- Modify: `test/runtime/docs-contract.test.ts`

- [ ] **Step 1: Add source document constants**

Insert these constants after the existing `tasksTemplate` and `scrumMaster` constants:

```ts
const qaTemplate = fs.readFileSync(path.join(REPO_ROOT, 'skill', 'templates', 'qa-report.md.template'), 'utf8');
const qaAgent = fs.readFileSync(path.join(REPO_ROOT, 'skill', 'agents', 'boss-qa.md'), 'utf8');
const testingStandards = fs.readFileSync(
  path.join(REPO_ROOT, 'skill', 'references', 'testing-standards.md'),
  'utf8'
);
```

- [ ] **Step 2: Add failing contract tests**

Append this `describe` block after the existing `subagent orchestration safety contract` block:

```ts
describe('boss evidence gates contract', () => {
  it('documents repo preflight before code-stage planning and dispatch', () => {
    for (const doc of [skill, tasksTemplate]) {
      expect(doc).toContain('Repo Preflight');
      expect(doc).toContain('默认分支');
      expect(doc).toContain('CI');
      expect(doc).toContain('测试脚本');
      expect(doc).toContain('schema enum');
      expect(doc).toContain('计费');
      expect(doc).toContain('migration');
      expect(doc).toContain('unknown');
    }

    expect(skill).toContain('不得派发 code Agent');
    expect(skill).toContain('不得猜测');
  });

  it('requires evidence-driven waves with red tests and green gates', () => {
    for (const doc of [scrumMaster, tasksTemplate]) {
      expect(doc).toContain('Evidence Wave');
      expect(doc).toContain('红测');
      expect(doc).toContain('绿门禁');
      expect(doc).toContain('Stop Condition');
      expect(doc).toContain('下一 Wave');
    }
  });

  it('requires cross-layer contract matrices for UI payload schema and business-rule consistency', () => {
    for (const doc of [scrumMaster, tasksTemplate]) {
      expect(doc).toContain('Contract Matrix');
      expect(doc).toContain('UI / Copy');
      expect(doc).toContain('Client Payload');
      expect(doc).toContain('Server Schema');
      expect(doc).toContain('Business Rule');
      expect(doc).toContain('Test Evidence');
      expect(doc).toContain('积分');
      expect(doc).toContain('remix');
    }
  });

  it('requires QA to replay real core paths and mark mocked critical paths unverified', () => {
    for (const doc of [qaAgent, qaTemplate]) {
      expect(doc).toContain('核心用户路径');
      expect(doc).toContain('真实 payload');
      expect(doc).toContain('服务端响应');
      expect(doc).toContain('schema');
      expect(doc).toContain('越权');
      expect(doc).toContain('第二页');
      expect(doc).toContain('旧数据');
      expect(doc).toContain('未验证');
    }
  });

  it('forbids mocked critical-path tests as the sole proof for core flows', () => {
    expect(testingStandards).toContain('关键路径');
    expect(testingStandards).toContain('Mock');
    expect(testingStandards).toContain('唯一证据');
    expect(testingStandards).toContain('真实 server schema');
    expect(testingStandards).toContain('red-to-green');
  });
});
```

- [ ] **Step 3: Run tests to verify they fail**

Run:

```bash
npm test -- test/runtime/docs-contract.test.ts
```

Expected: FAIL with missing text such as `Repo Preflight`, `Evidence Wave`, or `Contract Matrix`.

## Task 2: Update Boss Orchestrator Skill

**Files:**
- Modify: `skill/SKILL.md`
- Test: `test/runtime/docs-contract.test.ts`

- [ ] **Step 1: Add repo preflight to core principles**

In `## 核心原则`, add a new item after the existing wave/risk rules:

```md
15. **Repo Preflight 不可猜测** — code 阶段规划前必须探测默认分支、CI、测试脚本、schema enum、计费常量、权限入口、路由约定和 migration 风险；未知事实必须写 `unknown` 并列出已检查命令/文件，不得猜测。
16. **证据优先交付** — 高 Blast Radius 功能必须拆成可验收 Evidence Wave，每个 Wave 有红测、绿门禁、Contract Matrix 和 Stop Condition；缺任一项不得派发 code Agent。
```

- [ ] **Step 2: Add Step 0b Repo Preflight**

After Step `0.4b 📐 加载 Artifact DAG`, add:

```md
  - [ ] 0.4c 🔎 **Repo Preflight**：在 code 阶段规划前探测项目事实，并把摘要传给 Tech Lead、Scrum Master、Frontend、Backend、QA。
    - [ ] Git：默认分支、当前分支、是否存在未提交变更。
    - [ ] CI：`.github/workflows/`、`.gitlab-ci.yml`、`circleci`、`vercel.json`、`netlify.toml` 等配置，以及 CI 实际执行的 lint/test/build 命令。
    - [ ] 包管理与脚本：package manager、install 命令、test/build/lint/typecheck 脚本，确认 `npm test` 或等价命令是否包含 integration/E2E。
    - [ ] 测试工具：单元、集成、E2E、浏览器自动化工具。
    - [ ] 契约来源：真实 schema enum、OpenAPI/JSON Schema、Zod/Yup/Pydantic、Prisma/Drizzle、共享类型、API 路由。
    - [ ] 业务常量：计费、积分、quota、权限策略、publish/remix policy。
    - [ ] 路由与迁移：框架路由约定（如 Next async params）、migration/backfill/silent limit/destructive operation。
    - [ ] 对无法确认的事实写 `unknown`，并列出已检查命令或文件；不得猜测或用模板默认值代替。
```

- [ ] **Step 3: Block code dispatch when evidence sections are missing**

In D.4 before code agent dispatch, add:

```md
    - 若产物为 `code`，必须先确认 `tasks.md` 含 Repo Preflight 摘要、Evidence Wave 表、Contract Matrix（跨层功能适用）、每个 Wave 的红测/绿门禁/Stop Condition。缺失任一项时，暂停并回派 Scrum Master 修订；不得派发 code Agent。
```

- [ ] **Step 4: Run contract tests**

Run:

```bash
npm test -- test/runtime/docs-contract.test.ts
```

Expected: some tests still fail because Scrum Master, QA, templates, and testing standards are not updated yet.

## Task 3: Update Scrum Master Prompt and Tasks Template

**Files:**
- Modify: `skill/agents/boss-scrum-master.md`
- Modify: `skill/templates/tasks.md.template`
- Test: `test/runtime/docs-contract.test.ts`

- [ ] **Step 1: Add Scrum Master responsibilities**

In `skill/agents/boss-scrum-master.md`, extend `## 你的职责` with:

```md
7. **Repo Preflight 落表**：把 Boss 探测到的默认分支、CI、测试脚本、schema enum、计费常量、权限入口、路由约定和 migration 风险写入任务规格；未知项保留 `unknown` 并列出证据。
8. **Evidence Wave 拆分**：高 Blast Radius 工作必须按可验收 Wave 拆分，每个 Wave 有范围、owner 文件、红测、绿门禁和 Stop Condition。
9. **Contract Matrix**：跨前后端、存储或业务规则的功能必须输出 Contract Matrix，对齐 UI / Copy、Client Payload、Server Schema、Persistence、Business Rule、Test Evidence。
```

- [ ] **Step 2: Add wave decomposition rules**

After `### 分解步骤`, add:

```md
### Evidence Wave 规则

- 高 Blast Radius 任务不得压成单个大 Wave；优先按可独立验收的用户路径切分。
- 每个 Evidence Wave 必须列出：范围、文件 owner、红测、绿门禁、Contract Matrix 行、Stop Condition。
- 红测必须在实现前运行并失败；绿门禁必须在该 Wave 实现后运行并通过。
- Stop Condition 失败时不得进入下一 Wave。
- 典型顺序：数据模型/迁移 → 主创建路径 → 发布/广场/互动 → 衍生/派生路径 → legacy 入口隐藏与 CI。
```

- [ ] **Step 3: Add contract matrix rules**

After `### Evidence Wave 规则`, add:

```md
### Contract Matrix 规则

跨层功能必须输出 Contract Matrix。每行描述一个用户可见或 API 可见承诺，并在 Test Evidence 中列出真实测试文件、命令或 QA 步骤。

| Contract | UI / Copy | Client Payload | Server Schema | Persistence | Business Rule | Test Evidence |
|----------|-----------|----------------|---------------|-------------|---------------|---------------|

必须覆盖：
- 表单选项文案与真实 schema enum 一致，例如 `可爱` 不得发送到只接受 `软萌可爱` 的 schema。
- 用户看到的积分、价格、quota 与服务端扣费常量一致。
- publish/remix 文案与服务端 policy 一致。
- 创建/生成类主路径必须验证最终资产存在并可用。
- 匿名、owner、non-owner 权限与 API 行为一致。
```

- [ ] **Step 4: Add tasks template repo preflight section**

In `skill/templates/tasks.md.template`, after `## 摘要`, add:

```md
## 0. Repo Preflight 摘要

| 事实 | 发现结果 | 证据命令/文件 |
|------|----------|---------------|
| 默认分支 | `unknown` | `git symbolic-ref refs/remotes/origin/HEAD` 或 `git remote show origin` |
| 当前分支 | `unknown` | `git branch --show-current` |
| CI 命令 | `unknown` | `.github/workflows/*` / `.gitlab-ci.yml` / 其他 CI 配置 |
| 测试脚本 | `unknown` | `package.json` / `pyproject.toml` / `go.mod` / 等价文件 |
| Integration/E2E 覆盖 | `unknown` | 测试脚本与 E2E 配置 |
| schema enum 来源 | `unknown` | Zod/Yup/OpenAPI/JSON Schema/Prisma/Drizzle/Pydantic |
| 计费/积分常量 | `unknown` | pricing/credits/quota 常量文件 |
| 权限入口 | `unknown` | auth middleware / policy / route guard |
| 路由约定 | `unknown` | framework route files and docs in repo |
| migration 风险 | `unknown` | migration/backfill files |

> `unknown` 只能表示已检查但无法确认；不得用猜测值替代。
```

- [ ] **Step 5: Add evidence wave and contract matrix sections to tasks template**

After `## 4. 任务依赖图`, add:

```md
## 4.2 Evidence Wave 验收计划

| Evidence Wave | 范围 | Owner 文件 | 红测 | 绿门禁 | Contract Matrix 行 | Stop Condition |
|---------------|------|------------|------|--------|--------------------|----------------|
| Wave 1 | [数据模型/迁移/存储] | `path/to/file` | `npm test -- path/to/red.test.ts` | `npm run typecheck && npm test -- path/to/red.test.ts` | C-001 | schema 和 migration 测试未通过则停止 |
| Wave 2 | [主创建路径] | `path/to/file` | `npm test -- path/to/create.test.ts` | `npm test -- path/to/create.test.ts && npm run test:e2e` | C-002 | 核心用户路径未跑通则停止 |

## 4.3 Contract Matrix

| ID | Contract | UI / Copy | Client Payload | Server Schema | Persistence | Business Rule | Test Evidence |
|----|----------|-----------|----------------|---------------|-------------|---------------|---------------|
| C-001 | 表单枚举合法 | 展示 `软萌可爱` | `{ "styleTags": ["soft-cute"] }` | schema 接受 `soft-cute` | 保存标准枚举值 | 非法枚举返回 422 | `npm test -- tests/integration/schema.test.ts` |
| C-002 | 积分展示与扣费一致 | 显示 16 积分 | `{ "costPreview": 16 }` | 创建接口校验 cost | ledger 记录 -16 | 用户余额扣 16 | `npm test -- tests/integration/credits.test.ts` |

> 跨层功能不得删除本节。没有 Test Evidence 的行视为未验证。
```

- [ ] **Step 6: Run documentation contract tests**

Run:

```bash
npm test -- test/runtime/docs-contract.test.ts
```

Expected: QA and testing-standards assertions still fail until Task 4.

## Task 4: Update QA Prompt, QA Template, and Testing Standards

**Files:**
- Modify: `skill/agents/boss-qa.md`
- Modify: `skill/templates/qa-report.md.template`
- Modify: `skill/references/testing-standards.md`
- Test: `test/runtime/docs-contract.test.ts`

- [ ] **Step 1: Add QA attack protocol**

In `skill/agents/boss-qa.md`, after `## 你的职责`, add:

```md
## QA Attack Protocol

QA 的目标是证明核心用户路径真实可用，而不是证明文件齐全。

必须执行：
- 重放核心用户路径：从用户入口开始，完成创建/提交/发布/查看等主链路，并记录步骤、证据和结果。
- 捕获真实 payload 与服务端响应：关键 submit 不能只 mock fetch；必须用真实 server schema、共享 schema 或真实 API 响应验证。
- 攻击权限边界：匿名用户、owner、non-owner、过期登录态和越权访问。
- 攻击数据边界：空态、分页第二页、旧数据迁移、非法 enum、超长输入、重复提交。
- 攻击业务一致性：用户看到的积分/价格/quota 与服务端扣费一致，publish/remix 文案与 policy 一致。
- 生成类功能必须验证最终资产存在、可展示、可继续用于下游流程。

如果关键路径唯一证据来自 Mock，必须标记为 `未验证`，不得写 `通过`。
```

- [ ] **Step 2: Add QA report evidence sections**

In `skill/templates/qa-report.md.template`, after `## 摘要`, add:

```md
## 0. Evidence Summary

| 证据类别 | 状态 | 证据 |
|----------|------|------|
| 核心用户路径 | 通过 / 失败 / 未验证 | 浏览器步骤、API 步骤、截图或日志 |
| 真实 payload | 通过 / 失败 / 未验证 | 请求体与服务端响应 |
| schema 校验 | 通过 / 失败 / 未验证 | schema 文件、测试命令、响应码 |
| Contract Matrix | 通过 / 失败 / 未验证 | `tasks.md` 中 C-XXX 行 |
| 红测转绿 | 通过 / 失败 / 未验证 | 失败输出与通过输出 |
| 权限攻击 | 通过 / 失败 / 未验证 | 匿名/owner/non-owner 结果 |
| 分页/空态/旧数据 | 通过 / 失败 / 未验证 | 测试命令或浏览器步骤 |

## 0.1 核心用户路径 Replay

| Path ID | 用户路径 | 执行方式 | 关键步骤 | 结果 | 证据 |
|---------|----------|----------|----------|------|------|
| PATH-001 | 创建主资源并看到生成资产 | Browser/API/E2E | 登录 → 填表 → 提交 → 等待生成 → 查看资产 | 通过 / 失败 / 未验证 | 截图路径、日志、测试命令 |

## 0.2 Payload 与 Schema Evidence

| Submit | 真实 payload | Server Schema | 响应 | 状态 |
|--------|--------------|---------------|------|------|
| 创建提交 | `{ "styleTags": ["soft-cute"] }` | `src/server/schema.ts` | `201` / `422` | 通过 / 失败 / 未验证 |

## 0.3 QA Attack Checks

| 攻击面 | 场景 | 预期 | 实际 | 状态 |
|--------|------|------|------|------|
| 越权 | non-owner 修改 owner 资源 | 403 | [记录真实响应] | 通过 / 失败 / 未验证 |
| 第二页 | 列表进入 page=2 | 数据和分页状态正确 | [记录真实结果] | 通过 / 失败 / 未验证 |
| 旧数据 | migration 前数据读取 | 不丢失且字段兼容 | [记录真实结果] | 通过 / 失败 / 未验证 |
| 计费一致 | UI 显示积分与 ledger 扣费 | 数字一致 | [记录真实结果] | 通过 / 失败 / 未验证 |
```

- [ ] **Step 3: Add testing standards for critical paths**

Append to `skill/references/testing-standards.md`:

```md
## 关键路径证据规则

- 关键路径测试必须覆盖真实用户行为或真实 API/schema 行为；Mock 可以辅助隔离外部服务，但不得作为核心流程的唯一证据。
- UI submit payload 必须通过真实 server schema、共享 schema 或 API 集成测试验证。只断言 `fetch` 被调用不算通过。
- 对 schema enum、计费/积分、权限、publish/remix policy、生成资产存在性，必须有跨层测试或 QA replay 证据。
- red-to-green 证据必须记录：先运行失败的测试命令、失败原因、实现后通过的同一命令。
- 如果外部 AI、支付或第三方服务必须 Mock，测试仍需验证本系统发出的真实 payload、状态转移、持久化结果和错误处理。
```

- [ ] **Step 4: Run documentation contract tests**

Run:

```bash
npm test -- test/runtime/docs-contract.test.ts
```

Expected: PASS for `boss evidence gates contract`.

## Task 5: Make Final Markdown Report Evidence-First

**Files:**
- Modify: `test/runtime/report-runtime.test.ts`
- Modify: `packages/boss-cli/src/runtime/report/render-markdown.ts`

- [ ] **Step 1: Write failing report test assertions**

In `direct TS report modules build and render summary output from execution state`, add these assertions after `expect(markdown).toMatch(/# 流水线执行报告/);`:

```ts
const evidenceIndex = markdown.indexOf('## 证据链');
const artifactsIndex = markdown.indexOf('## 产物清单');
expect(evidenceIndex).toBeGreaterThan(-1);
expect(artifactsIndex).toBeGreaterThan(evidenceIndex);
expect(markdown).toContain('### Gate 命令与检查项');
expect(markdown).toContain('### 红测转绿证据');
expect(markdown).toContain('### Contract Matrix 状态');
expect(markdown).toContain('### 已知失败与遗留风险');
expect(markdown).toContain('详见 `qa-report.md`');
expect(markdown).toContain('详见 `tasks.md`');
```

- [ ] **Step 2: Run report test to verify it fails**

Run:

```bash
npm test -- test/runtime/report-runtime.test.ts
```

Expected: FAIL because `## 证据链` is not rendered.

- [ ] **Step 3: Update renderer**

In `packages/boss-cli/src/runtime/report/render-markdown.ts`, after the summary metrics and before `## 阶段详情`, insert evidence sections using existing model data:

```ts
  lines.push(
    '',
    '---',
    '',
    '## 证据链',
    '',
    '### 核心用户路径',
    '',
    '- **状态**：详见 `qa-report.md` 的 Evidence Summary 与核心用户路径 Replay。',
    '- **要求**：核心路径必须包含真实浏览器/API/schema 证据；Mock 关键路径不得单独标记通过。',
    '',
    '### Gate 命令与检查项',
    '',
    '| 门禁 | 状态 | 通过 | 检查项 | 失败项 | 执行时间 |',
    '|------|------|------|--------|--------|----------|'
  );

  for (const [name, gate] of Object.entries(model.qualityGates || {})) {
    const checks = Array.isArray(gate.checks) ? gate.checks : [];
    const failedChecks = checks.filter((check) => check && typeof check === 'object' && 'passed' in check && check.passed === false).length;
    lines.push(
      `| ${gateLabel(name)} | ${statusIcon(gate.status)} ${gate.status} | ${gate.passed == null ? '—' : gate.passed} | ${checks.length} | ${failedChecks} | ${gate.executedAt || '—'} |`
    );
  }

  lines.push(
    '',
    '### 红测转绿证据',
    '',
    '- 详见 `tasks.md` 的 Evidence Wave 验收计划，以及 `qa-report.md` 的红测转绿证据。',
    '',
    '### Contract Matrix 状态',
    '',
    '- 详见 `tasks.md` 的 Contract Matrix 与 `qa-report.md` 的 Contract Matrix 验证结果。',
    '',
    '### 已知失败与遗留风险',
    '',
    `- **门禁通过率**：${model.metrics.gatePassRate ?? 'N/A'}%`,
    `- **Agent 失败数**：${model.metrics.agentFailureCount ?? 0}`,
    `- **插件失败数**：${model.metrics.pluginFailureCount ?? 0}`,
    '- 详细阻塞问题、跳过检查和残余风险详见 `qa-report.md`。',
    '',
    '---'
  );
```

Then keep the existing `## 阶段详情`, `## 质量门禁`, and `## 产物清单` sections after the new evidence section.

- [ ] **Step 4: Run report tests**

Run:

```bash
npm test -- test/runtime/report-runtime.test.ts
```

Expected: PASS.

## Task 6: Full Verification and Commit

**Files:**
- All modified files from Tasks 1-5

- [ ] **Step 1: Run focused tests**

Run:

```bash
npm test -- test/runtime/docs-contract.test.ts test/runtime/report-runtime.test.ts
```

Expected: PASS.

- [ ] **Step 2: Run typecheck**

Run:

```bash
npm run typecheck
```

Expected: PASS.

- [ ] **Step 3: Run full test suite**

Run:

```bash
npm test
```

Expected: PASS.

- [ ] **Step 4: Review diff**

Run:

```bash
git diff -- skill/SKILL.md skill/agents/boss-scrum-master.md skill/agents/boss-qa.md skill/references/testing-standards.md skill/templates/tasks.md.template skill/templates/qa-report.md.template packages/boss-cli/src/runtime/report/render-markdown.ts test/runtime/docs-contract.test.ts test/runtime/report-runtime.test.ts
```

Expected: diff only covers evidence-gates behavior from the spec.

- [ ] **Step 5: Commit**

Run:

```bash
git add skill/SKILL.md skill/agents/boss-scrum-master.md skill/agents/boss-qa.md skill/references/testing-standards.md skill/templates/tasks.md.template skill/templates/qa-report.md.template packages/boss-cli/src/runtime/report/render-markdown.ts test/runtime/docs-contract.test.ts test/runtime/report-runtime.test.ts
git commit -m "feat: require boss evidence gates"
```

Expected: commit succeeds.

## Self-Review

- Spec coverage: repo preflight is covered by Tasks 1-3; evidence waves and Contract Matrix are covered by Task 3; QA attack protocol and real payload/schema evidence are covered by Task 4; evidence-first final report is covered by Task 5; verification is covered by Task 6.
- Type consistency: new report code uses existing `SummaryModel`, `GateState`, `statusIcon`, and `gateLabel` structures.
- Scope check: the plan does not add new runtime CLI gates, matching the approved scope.
