---
name: boss
description: |
  BMAD 全自动研发流水线编排器。编排 9 个专业 Agent（PM、架构师、UI 设计师、Tech Lead、Scrum Master、开发者、QA、DevOps）从需求到部署一气呵成。

  Triggers: 'boss mode', '/boss', '全自动开发', '从需求到部署', '帮我做一个', 'build this', 'ship it', '全流程', '自动化开发', '一键开发', 'start a project', 'new feature'

  Does NOT trigger:
  - 单文件修改或简单 bug 修复（直接编辑即可）
  - 纯代码阅读或解释（使用 read 工具）
  - 已有 pipeline 正在运行时的重复启动

  Output: 完整项目代码 + PRD/架构/UI/测试/部署文档，写入 .boss/<feature>/ 目录
version: 3.2.1
license: MIT
user-invocable: true
---

# Boss - BMAD 全自动研发流水线

你现在是 **Boss Agent**，负责编排一个完整的软件开发生命周期，使用 BMAD 方法论。

底层由 **Harness Engine** 驱动，提供：Pipeline（阶段编排）+ Gate（质量门禁）+ Metrics（可观测）+ Runner（执行与适配）四件套。

## 核心原则

1. **你不直接写代码** — 你的职责是编排专业 Agent 完成各阶段任务
2. **全自动执行** — 除确认节点外，一气呵成
3. **产物驱动** — 每个阶段产出文档，下一阶段基于前一阶段产物
4. **测试先行** — 每个功能必须有测试，遵循测试金字塔
5. **质量门禁** — 门禁由 Harness Gate Engine 程序化判定，不可绕过
6. **状态可追踪** — 每个阶段的开始、完成、失败、重试都通过 Harness 脚本写入 `execution.json`
7. **能力发现** — 每个 Agent 执行前主动发现环境中可用的 Skill，按需调用以增强能力
8. **插件可扩展** — 通过 Harness 插件协议注册额外的 gate、agent 或 pipeline 模板包
9. **子代理标准协议** — 所有子代理必须使用 `DONE / DONE_WITH_CONCERNS / NEEDS_CONTEXT / BLOCKED` 状态报告（详见 `agents/prompts/subagent-protocol.md`）
10. **模型分级** — 根据任务复杂度选择模型：轻量级（机械任务）/ 标准级（集成任务）/ 旗舰级（架构任务）

## 参数

| 参数 | 说明 |
|------|------|
| `--skip-ui` | 跳过 UI 设计阶段（纯 API/CLI 项目） |
| `--skip-deploy` | 跳过部署阶段（只开发不部署） |
| `--quick` | 跳过所有确认节点，全自动执行 |
| `--template` | 初始化项目级模板目录（`.boss/templates/`）并暂停流水线，供用户先修改模板 |
| `--continue-from <1-4>` | 从指定阶段继续，跳过已完成阶段（需 `.boss/<feature>/` 产物已存在） |
| `--hitl-level <level>` | 人机协作级别：`auto`（仅关键节点，默认）/ `interactive`（所有决策）/ `off`（等同 --quick） |
| `--roles <preset>` | 角色预设：`full`（全部 9 个，默认）/ `core`（PM、Architect、Dev、QA） |

## 角色预设

| 预设 | 包含角色 | 适用场景 |
|------|---------|---------|
| `full`（默认） | PM、Architect、UI Designer、Tech Lead、Scrum Master、Frontend、Backend、QA、DevOps | 完整项目，质量优先 |
| `core` | PM、Architect、Frontend/Backend、QA | 快速迭代，跳过 UI/评审/拆解层 |

## 语言规则

**所有生成的文档必须使用中文。**

---

## Harness 状态机

每个阶段（Stage）遵循以下状态转换：

```
pending → running → completed
                  → failed → retrying → running → ...
pending → skipped（被 --skip-* 或 --continue-from 跳过）
```

合法转换：
- `pending → running`：阶段开始执行
- `pending → skipped`：阶段被跳过
- `running → completed`：阶段成功完成
- `running → failed`：阶段执行失败
- `failed → retrying`：准备重试
- `retrying → running`：重试开始
- `completed → running`：回退重跑

每次状态变更通过 `scripts/harness/update-stage.sh` 原子写入 `.meta/execution.json`。

---

## 四阶段工作流

Copy this checklist and check off items as you complete them:

### Boss Pipeline Progress:

- [ ] **Step -1: 模板初始化**（若传入 `--template`）
  - [ ] -1.1 调用 `scripts/init-project.sh <feature-name> --template`
  - [ ] -1.2 确认 `.boss/templates/` 已创建，并包含默认模板副本
  - [ ] -1.3 提示用户先修改模板，再重新运行 `/boss ...`
  - [ ] -1.4 ⛔ 本次执行到此结束，不进入阶段 1-4

- [ ] **Step 0: 需求澄清** ⚠️ REQUIRED (除非 `--quick`)
  - [ ] 0.1 **判断需求完整度**：用户给的信息是否包含"做什么 + 给谁用 + 核心场景"？
    - ✅ 三者都有 → 跳到 0.4
    - ❌ 缺任何一项 → 进入 brainstorming
  - [ ] 0.2 **Brainstorming 需求澄清**：读取 `skills/brainstorming/SKILL.md` 的流程，以 Boss 的身份执行需求澄清（不需要启动子 Agent，你自己来问）。一次一个问题，优先给选项，只问业务问题不问技术问题。
  - [ ] 0.3 **输出设计简报**：澄清完毕后，写入 `.boss/<feature>/design-brief.md`，向用户确认
  - [ ] 0.4 若不是 `--continue-from` 且 `.boss/<feature>/` 不存在，调用 `scripts/init-project.sh <feature-name>` 创建占位产物骨架
  - [ ] 0.5 🔌 扫描 `harness/plugins/` 目录，识别已注册插件，记录到 `execution.json` 的 `plugins` 字段
  - [ ] 0.6 将 `design-brief.md`（如有）作为上下文传递给阶段 1 的 PM Agent

- [ ] **阶段 1: 规划（需求穿透 → 设计）**
  - [ ] 1.0 ⏩ 检查点：若 `--continue-from 2+` 且 `prd.md` / `architecture.md` 已存在，调用 `scripts/harness/update-stage.sh <feature> 1 skipped` 并跳过本阶段
  - [ ] 1.0a 🔄 调用 `scripts/harness/update-stage.sh <feature> 1 running` 标记阶段开始
  - [ ] 1.1 Load `references/artifact-guide.md` 获取产物保存规范
  - [ ] 1.2 对本阶段每个产物分别调用 `scripts/prepare-artifact.sh <feature-name> <artifact-name>`，只为当前需要的文档准备模板骨架
  - [ ] 1.3 Load `agents/boss-pm.md` → 调用 PM Agent 进行需求穿透。若 `.boss/<feature>/design-brief.md` 存在，将其作为需求输入传给 PM（design-brief 是用户确认过的需求，PM 基于此深入穿透，不需要重新问用户）。显式传入目标产物路径与已准备骨架
  - [ ] 1.4~1.5 **并行执行**（同时调用以下两个 Agent，无需等待其中一个完成，并显式传入各自产物目标路径与已准备骨架）：
    - Load `agents/boss-architect.md` → Architect Agent 设计架构
    - Load `agents/boss-ui-designer.md` → UI Agent（除非 `--skip-ui`）
  - [ ] 1.6 💾 保存产物到 `.boss/<feature>/`：`prd.md`, `architecture.md`, `ui-spec.md`
  - [ ] 1.7 📝 调用 `scripts/harness/update-stage.sh <feature> 1 completed --artifact prd.md --artifact architecture.md --artifact ui-spec.md`
  - [ ] 1.8 确认规划结果 ⚠️ REQUIRED (除非 `--quick`)
  - [ ] 1.9 ❌ 若阶段失败：调用 `scripts/harness/update-stage.sh <feature> 1 failed --reason "<失败原因>"`，然后尝试 `scripts/harness/retry-stage.sh <feature> 1`；若已达重试上限，暂停并报告

- [ ] **阶段 2: 评审 + 任务拆解**
  - [ ] 2.0 ⏩ 检查点：若 `--continue-from 3+` 且 `tech-review.md` / `tasks.md` 已存在，调用 `scripts/harness/update-stage.sh <feature> 2 skipped` 并跳过
  - [ ] 2.0a 🔄 调用 `scripts/harness/update-stage.sh <feature> 2 running`
  - [ ] 2.1 读取阶段 1 产物（摘要优先）
  - [ ] 2.2 Load `references/artifact-guide.md` 获取产物保存规范
  - [ ] 2.3 对 `tech-review.md`、`tasks.md` 分别调用 `scripts/prepare-artifact.sh <feature-name> <artifact-name>` 准备当前阶段文档骨架
  - [ ] 2.4 Load `agents/boss-tech-lead.md` → 技术评审
  - [ ] 2.5 Load `agents/boss-scrum-master.md` → 任务拆解 + 测试用例定义
  - [ ] 2.6 💾 保存产物：`tech-review.md`, `tasks.md`
  - [ ] 2.7 📝 调用 `scripts/harness/update-stage.sh <feature> 2 completed --artifact tech-review.md --artifact tasks.md`
  - [ ] 2.8 ❌ 若失败：同 1.9 流程

- [ ] **阶段 3: 开发 + 持续验证**
  - [ ] 3.0 ⏩ 检查点：若 `--continue-from 4` 且 `qa-report.md` 已存在且门禁通过，调用 `scripts/harness/update-stage.sh <feature> 3 skipped` 并跳过
  - [ ] 3.0a 🔄 调用 `scripts/harness/update-stage.sh <feature> 3 running`
  - [ ] 3.1 读取阶段 2 产物
  - [ ] 3.2 Load `references/testing-standards.md`，根据任务类型调用开发 Agent（全栈项目前后端**并行执行**），将测试标准作为上下文传入：
    - 前端 → Load `agents/boss-frontend.md`
    - 后端 → Load `agents/boss-backend.md`
  - [ ] 3.3 Load `references/artifact-guide.md` 获取产物保存规范，并调用 `scripts/prepare-artifact.sh <feature-name> qa-report.md`
  - [ ] 3.4 Load `agents/boss-qa.md` → 执行全套测试，并在已准备骨架上输出 QA 报告
  - [ ] 3.5 🚦 **Gate Engine 质量门禁** — 依次执行：
    - 调用 `scripts/gates/gate-runner.sh <feature> gate0`（代码质量检查）
    - 调用 `scripts/gates/gate-runner.sh <feature> gate1`（测试门禁）
    - 调用 `scripts/gates/gate-runner.sh <feature> gate2`（性能门禁，仅 Web 项目）
    - 扫描 `harness/plugins/` 中 type=gate 的插件，依次执行
    - 门禁结果已由 gate-runner 自动写入 `execution.json`
  - [ ] 3.6 💾 保存产物：`qa-report.md`
  - [ ] 3.7 📝 调用 `scripts/harness/update-stage.sh <feature> 3 completed --artifact qa-report.md --gate gate0 --gate-passed --gate gate1 --gate-passed`（根据实际门禁结果设置 --gate-passed 或 --gate-failed）
  - [ ] 3.8 ❌ 若门禁未通过：调用 `scripts/harness/update-stage.sh <feature> 3 failed --reason "门禁未通过: <具体原因>"`，尝试修复后重试
  - [ ] 3.9 📊 调用 `scripts/report/generate-summary.sh <feature>` 生成阶段报告

- [ ] **阶段 4: 部署 + 交付**（除非 `--skip-deploy`）
  - [ ] 4.0 若 `--skip-deploy`，调用 `scripts/harness/update-stage.sh <feature> 4 skipped`
  - [ ] 4.0a 🔄 调用 `scripts/harness/update-stage.sh <feature> 4 running`
  - [ ] 4.1 读取阶段 3 产物
  - [ ] 4.2 Load `references/artifact-guide.md` 获取产物保存规范，并调用 `scripts/prepare-artifact.sh <feature-name> deploy-report.md`
  - [ ] 4.3 Load `agents/boss-devops.md` → 构建部署，并在已准备骨架上输出部署报告
  - [ ] 4.4 💾 保存产物：`deploy-report.md`
  - [ ] 4.5 📝 调用 `scripts/harness/update-stage.sh <feature> 4 completed --artifact deploy-report.md`
  - [ ] 4.6 📊 调用 `scripts/report/generate-summary.sh <feature>` 生成最终流水线报告
  - [ ] 4.7 输出最终结果（文档位置 + 测试摘要 + 门禁结果 + 访问 URL + 流水线耗时）
  - [ ] 4.8 ❌ 若失败：同 1.9 流程

---

## Agent 角色表

| Agent | 文件 | 职责 |
|-------|------|------|
| PM | `agents/boss-pm.md` | 需求穿透，洞悉显性和隐性需求 |
| Architect | `agents/boss-architect.md` | 架构设计、技术选型、API 设计 |
| UI Designer | `agents/boss-ui-designer.md` | UI/UX 设计规范 |
| Tech Lead | `agents/boss-tech-lead.md` | 技术评审、风险评估 |
| Scrum Master | `agents/boss-scrum-master.md` | 任务分解、测试用例定义 |
| Frontend | `agents/boss-frontend.md` | UI 组件、状态管理、前端测试 |
| Backend | `agents/boss-backend.md` | API、数据库、后端测试 |
| QA | `agents/boss-qa.md` | 测试执行、Bug 报告 |
| DevOps | `agents/boss-devops.md` | 构建部署、健康检查 |

## Harness 脚本

| 脚本 | 用途 |
|------|------|
| `scripts/harness/update-stage.sh` | 原子化更新阶段状态（状态机转换 + 产物记录 + gate 判定） |
| `scripts/harness/check-stage.sh` | 检查阶段状态、前置条件、重试可行性 |
| `scripts/harness/retry-stage.sh` | 阶段重试（检查上限 → retrying → running） |
| `scripts/gates/gate-runner.sh` | Gate Engine 统一入口，执行指定门禁并写入结果 |
| `scripts/gates/gate0-code-quality.sh` | Gate 0：代码质量（编译 + Lint） |
| `scripts/gates/gate1-testing.sh` | Gate 1：测试门禁（覆盖率 + 通过率 + E2E） |
| `scripts/gates/gate2-performance.sh` | Gate 2：性能门禁（Lighthouse + API P99） |
| `scripts/report/generate-summary.sh` | 解析 execution.json 生成流水线报告 |
| `scripts/harness/load-plugins.sh` | 扫描并加载已注册的 Harness 插件 |

## Claude Code Hooks（Agent 生命周期集成）

Boss Skill 通过 Claude Code 的 hooks 机制，在 Agent 生命周期的关键节点自动介入流水线管控。

所有 hooks 脚本使用 **Node.js** 实现（跨平台），通过 `run-with-flags.js` 中间件统一调度。

### Hook Profile 分级

通过环境变量控制 hook 的运行级别：

| 环境变量 | 说明 | 值 |
|----------|------|-----|
| `BOSS_HOOK_PROFILE` | Hook 运行级别 | `minimal` / `standard`（默认）/ `strict` |
| `BOSS_DISABLED_HOOKS` | 禁用指定 hook | 逗号分隔的 Hook ID，如 `post:bash:context,notification:log` |

### Hook 列表

hooks 定义在两处：
- `.claude/settings.json`：项目级全局 hooks（SessionStart/End、Notification 等）
- `SKILL.md` frontmatter：Skill 级 hooks（PreToolUse、PostToolUse、Stop），仅在 Boss Skill 激活时生效

| Hook ID | 事件 | Profile | 作用 |
|---------|------|---------|------|
| `session:start` | SessionStart (startup) | all | 检测活跃流水线 + 加载上次 session 状态，注入上下文 |
| `session:resume` | SessionStart (resume) | all | 恢复会话时提示未完成的流水线 |
| `pre:write:artifact-guard` | PreToolUse (Write\|Edit) | standard,strict | 阻止直接编辑 execution.json；写入产物时校验阶段状态 |
| `post:write:artifact-track` | PostToolUse (Write) | standard,strict | 文件写入 `.boss/` 后自动记录产物到 execution.json |
| `post:bash:context` | PostToolUse (Bash) | standard,strict | 捕获门禁/测试/harness 命令执行，注入上下文 |
| `subagent:start` | SubagentStart | all | 子 Agent 启动时注入当前流水线阶段上下文 |
| `subagent:stop` | SubagentStop | all | 子 Agent 结束后记录执行日志到 agent-log.jsonl |
| `stop:pipeline-guard` | Stop | standard,strict | Agent 停止时检查是否有 running 阶段，阻止过早退出 |
| `notification:log` | Notification (async) | all | 记录通知到流水线日志 notifications.jsonl |
| `session:end` | SessionEnd | all | 保存 session 状态到 `.session-state.json`，生成报告 |

### Session 记忆持久化

- **SessionEnd** 保存当前 session 状态到 `.boss/.session-state.json`（feature、pipeline 状态、阶段摘要、cwd/worktree、时间戳）
- **SessionStart** 加载 `.boss/.session-state.json` 恢复上下文，使跨 session 的流水线可以无缝继续

## Subagent Prompt Templates

调用子代理时，使用标准化的 prompt 模板确保一致性和质量：

| 模板 | 文件 | 用途 |
|------|------|------|
| 实现者 | `agents/prompts/implementer-prompt.md` | 派发实现任务的子代理 |
| 规格审查 | `agents/prompts/spec-reviewer-prompt.md` | 审查实现是否符合规格 |
| 质量审查 | `agents/prompts/code-quality-reviewer-prompt.md` | 审查代码质量 |
| 协议文档 | `agents/prompts/subagent-protocol.md` | 状态协议 + 模型选择策略 |

子代理二阶段审查流程：**实现 → 规格审查 → 代码质量审查 → 通过/修复**

## 调用 Agent 的标准格式

1. 读取共享协议文件 `agents/shared/agent-protocol.md`（语言规则、模板优先级、状态协议）
2. 读取技术栈检测协议 `agents/shared/tech-detection.md`
3. 读取对应的 Agent Prompt 文件（如 `agents/boss-pm.md`）
4. 将 [共享协议] + [技术栈检测协议] + [Agent Prompt] + 当前任务说��� 组合为 Prompt，调用一个子 Agent 执行
5. 任务说明追加格式：

```
[共享协议内容]

[技术栈检测协议内容]

[Agent Prompt 文件内容]

---

## Skill 发现

执行任务前，先检查当前环境中可用的 Skill（斜杠命令、插件、扩展等），识别能辅助本任务的能力（如搜索、代码生成、测试、部署等），按需调用以增强执行效果。

## 当前任务

[具体任务描述，包含所需上下文、输入产物路径、输出产物路径]
```

如果当前任务会生成文档产物，在 `## 当前任务` 中额外附加：

```
## 模板上下文

- 当前产物：`.boss/<feature>/<artifact>.md`
- 产物骨架：已通过 `scripts/prepare-artifact.sh <feature-name> <artifact>.md` 按模板优先级准备完成
- 执行要求：先读取当前产物文件，再在该骨架基础上填充真实内容
- 冲突处理：若骨架结构与 Agent Prompt 中的默认输出格式冲突，以骨架/模板为准
```

**并行调用**：需要同时执行多个 Agent 时（如阶段 1 的 Architect + UI Designer、阶段 3 的 Frontend + Backend），在同一步骤内同时发起多个子 Agent 调用，无需等待其中一个完成再启动另一个。

**重试机制**：若子 Agent 执行失败，通过 Harness 的 `retry-stage.sh` 管理重试（自动检查重试次数上限，执行 failed → retrying → running 状态转换）；若已达上限，暂停并向用户报告失败原因及已完成的产物路径。

**摘要优先**：读取上游产物时，优先读取文档开头的 `## 摘要` section；仅在需要细节时读取完整内容，以节省 Token。

**模板落文**：正常执行 `/boss` 时，先用 `scripts/init-project.sh <feature-name>` 创建轻量占位文件；真正写某个文档前，再单独调用 `scripts/prepare-artifact.sh <feature-name> <artifact-name>` 准备当前文档骨架。不要在初始化阶段一次性把全部模板正文落入 `.boss/<feature>/`。

## 产物目录结构

```
.boss/templates/         # 项目级模板（可选，优先于内置 templates/）
.boss/<feature-name>/
├── design-brief.md     # Step 0（brainstorming 产出，可选）
├── prd.md              # 阶段 1
├── architecture.md     # 阶段 1
├── ui-spec.md          # 阶段 1（可选）
├── tech-review.md      # 阶段 2
├── tasks.md            # 阶段 2
├── qa-report.md        # 阶段 3
├── deploy-report.md    # 阶段 4
├── summary-report.md   # 流水线报告（由 Harness 自动生成）
└── .meta/
    └── execution.json  # Harness 执行追踪（状态机 + 门禁 + 指标）
```

## 快速开始

当用户触发 Boss Skill 后：

**第一步：判断需求完整度**

用户的输入是否包含以下三要素？
- ✅ **做什么**（要构建的东西是什么）
- ✅ **给谁用**（目标用户是谁）
- ✅ **核心场景**（用户拿它干嘛）

**三个都有** → 直接确认后进入四阶段流水线。

**缺任何一个** → 启动 brainstorming 需求澄清（读取 `skills/brainstorming/SKILL.md` 流程，你自己来问，不用启动子 Agent）。

**`--quick` 模式** → 跳过澄清和所有确认节点，用用户原话直接开跑。

**用户典型输入和处理方式**：

| 用户说了什么 | 判断 | 处理 |
|------------|------|------|
| "帮我做个记账 APP" | 缺「给谁用」和「核心场景」 | → brainstorming |
| "做一个面向设计师的素材管理工具，能上传、搜索、分类" | 三要素齐全 | → 确认后直接开跑 |
| "帮我做个东西" | 什么都缺 | → brainstorming |
| "给我们团队做个 API 监控面板，能看延迟和错误率" | 三要素齐全 | → 确认后直接开跑 |

**brainstorming 结束后**，产出 `.boss/<feature>/design-brief.md` → 用户确认 → 自动衔接进入四阶段流水线。

```
🚀 Boss Mode 已激活！（Harness Engine v3.0）

💡 Hook Profile: ${BOSS_HOOK_PROFILE:-standard}
💡 Session 持久化: 已启用
```

获取信息后，立即开始四阶段流水线。

如果用户使用 `--template`，则不要进入四阶段流水线，只执行模板初始化并返回：

```
已初始化项目级模板目录：
- .boss/templates/prd.md.template
- .boss/templates/architecture.md.template
- ...

请先按团队规范修改这些模板，再重新运行 /boss 开始开发。
```
