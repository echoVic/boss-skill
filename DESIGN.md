# Boss Skill 设计与实现文档

## 1. 项目概述

### 1.1 什么是 Boss Skill

Boss Skill 是一个基于 **BMAD 方法论**（Breakthrough Method of Agile AI-Driven Development）的全自动研发流水线编排系统。它通过编排多个专业 Agent，实现从需求到部署的完整软件开发生命周期自动化。

### 1.2 核心价值

| 价值 | 说明 |
|------|------|
| **全自动化** | 无需人工干预，一键完成从需求到部署 |
| **专业分工** | 9 个专业 Agent 各司其职，模拟真实研发团队 |
| **质量保障** | 测试门禁机制，确保交付质量 |
| **产物驱动** | 每阶段产出文档，可追溯、可审计 |
| **需求穿透** | PM Agent 深度挖掘用户真实需求 |

### 1.3 触发方式

| 触发词 | 说明 |
|--------|------|
| `/boss` | 主要触发词 |
| `boss mode` | 自然语言触发 |
| `全自动开发` | 中文触发 |
| `从需求到部署` | 场景触发 |

---

## 2. 架构设计

### 2.1 整体架构

```
┌─────────────────────────────────────────────────────────────────┐
│                         Boss Agent                               │
│                    （编排层 - 流水线控制）                         │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐        │
│  │    PM    │  │ Architect│  │UI Designer│  │Tech Lead │        │
│  │  Agent   │  │  Agent   │  │  Agent   │  │  Agent   │        │
│  └──────────┘  └──────────┘  └──────────┘  └──────────┘        │
│                                                                  │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐                      │
│  │  Scrum   │  │ Frontend │  │ Backend  │                      │
│  │  Master  │  │  Agent   │  │  Agent   │                      │
│  └──────────┘  └──────────┘  └──────────┘                      │
│                                                                  │
│  ┌──────────┐  ┌──────────┐                                    │
│  │    QA    │  │  DevOps  │                                    │
│  │  Agent   │  │  Agent   │                                    │
│  └──────────┘  └──────────┘                                    │
│                                                                  │
├─────────────────────────────────────────────────────────────────┤
│                       产物存储层                                  │
│                   .boss/<feature>/                               │
└─────────────────────────────────────────────────────────────────┘
```

### 2.2 Agent 职责矩阵

| Agent | 角色定位 | 核心能力 | 输入 | 输出 |
|-------|----------|----------|------|------|
| PM | 20 年产品经验，受乔布斯/张小龙认可 | 需求穿透、4 层需求挖掘 | 用户原始需求 | prd.md |
| UI Designer | Apple 20 年设计师 | 像素级设计、前端友好规范 | prd.md | ui-spec.md |
| Architect | 系统架构师 | 架构设计、技术选型 | prd.md | architecture.md |
| Tech Lead | 技术负责人 | 技术评审、风险评估 | prd.md + architecture.md | tech-review.md |
| Scrum Master | 敏捷教练 | 任务拆解、工作量估算 | prd.md + tech-review.md | tasks.md |
| Frontend | 前端专家 | UI 实现、状态管理 | tasks.md + ui-spec.md | 前端代码 |
| Backend | 后端专家 | API 开发、数据库 | tasks.md + architecture.md | 后端代码 |
| QA | 测试工程师 | 测试执行、质量验证 | 代码 + prd.md | qa-report.md |
| DevOps | 运维工程师 | 构建部署、健康检查 | 代码 | deploy-report.md |

### 2.3 数据流设计

```
用户需求
    │
    ▼
┌─────────────────────────────────────────────────────────────┐
│ 阶段 1：规划（需求穿透 → 设计）                               │
│                                                              │
│   用户需求 ──→ [PM Agent] ──→ prd.md（含用户故事）           │
│                    │                                         │
│                    ▼                                         │
│              ┌─────┴─────┐                                   │
│              ▼           ▼                                   │
│        [Architect]  [UI Designer]                            │
│              │           │                                   │
│              ▼           ▼                                   │
│       architecture.md  ui-spec.md                            │
└─────────────────────────────────────────────────────────────┘
                    │
                    ▼
┌─────────────────────────────────────────────────────────────┐
│ 阶段 2：评审 + 任务拆解                                       │
│                                                              │
│   prd.md + architecture.md ──→ [Tech Lead] ──→ tech-review.md│
│                                      │                       │
│                                      ▼                       │
│   prd.md + tech-review.md ──→ [Scrum Master] ──→ tasks.md   │
└─────────────────────────────────────────────────────────────┘
                    │
                    ▼
┌─────────────────────────────────────────────────────────────┐
│ 阶段 3：开发 + 持续验证                                       │
│                                                              │
│   tasks.md ──→ [Frontend/Backend Agent] ──→ 代码 + 测试      │
│                         │                                    │
│                         ▼                                    │
│                    [QA Agent] ──→ 持续验证                   │
└─────────────────────────────────────────────────────────────┘
                    │
                    ▼
┌─────────────────────────────────────────────────────────────┐
│ 阶段 4：部署 + 交付                                          │
│                                                              │
│   代码 ──→ [QA Agent] ──→ qa-report.md ──→ 测试门禁检查      │
│                                               │              │
│                                               ▼              │
│                                        [DevOps Agent]        │
│                                               │              │
│                                               ▼              │
│                                      deploy-report.md        │
│                                               │              │
│                                               ▼              │
│                                        可访问 URL            │
└─────────────────────────────────────────────────────────────┘
```

---

## 3. 四阶段工作流

### 3.1 阶段 1：规划（需求穿透 → 设计）

**目标**：深度理解用户需求，转化为可执行规格

**执行顺序**：

```
1. PM Agent（串行，必须先执行）
   └── 需求穿透分析
   └── 输出 prd.md（含用户故事）

2. Architect + UI Designer（并行执行）
   ├── Architect → architecture.md
   └── UI Designer → ui-spec.md
```

**关键点**：
- PM 必须先执行，进行需求穿透
- 架构和 UI 设计基于 PRD 并行执行

### 3.2 阶段 2：评审 + 任务拆解

**目标**：技术评审 + 将用户故事转化为详细开发任务

**执行顺序**：

```
1. Tech Lead Agent
   └── 技术方案评审
   └── 输出 tech-review.md

2. Scrum Master Agent
   └── 任务拆解
   └── 输出 tasks.md
```

**关键点**：
- 如果评审不通过，需要返回阶段 1 修改
- 用户故事由 PM 在 PRD 中输出，Tech Lead 负责评审

### 3.3 阶段 3：开发 + 持续验证

**目标**：实现代码并持续验证

**执行策略**：

```
根据任务类型调用对应 Agent：
├── 前端任务 → Frontend Agent
├── 后端任务 → Backend Agent
└── 全栈任务 → Frontend + Backend 并行

每完成一个 Story：
└── QA Agent 持续验证
```

**测试要求**（测试金字塔）：
- 单元测试：覆盖率 ≥ 70%
- 集成测试：API 端点、组件交互
- E2E 测试：关键用户流程

### 3.4 阶段 4：部署 + 交付

**目标**：部署应用并生成报告

**执行顺序**：

```
1. QA Agent 完整测试
   └── 输出 qa-report.md

2. 测试门禁检查
   └── 通过 → 继续
   └── 失败 → 返回阶段 3

3. DevOps Agent 部署
   └── 输出 deploy-report.md
   └── 返回可访问 URL
```

---

## 4. 核心设计亮点

### 4.1 需求穿透机制

PM Agent 采用 **4 层需求挖掘模型**：

```
        ┌─────────────────┐
        │   惊喜需求      │ ← 超出预期，带来 "Wow" 体验
        │   (Delighters)  │
        ├─────────────────┤
        │   潜在需求      │ ← 用户尚未意识到但会需要
        │   (Latent)      │
        ├─────────────────┤
        │   隐性需求      │ ← 用户想到但未表达
        │   (Implicit)    │
        ├─────────────────┤
        │   显性需求      │ ← 用户明确表达
        │   (Explicit)    │
        └─────────────────┘
```

**5W2H 深度追问法**：

| 维度 | 核心问题 | 目的 |
|------|----------|------|
| What | 背后真正想要什么？ | 识别真实需求 |
| Why | 解决什么问题？ | 理解动机 |
| Who | 谁在什么场景下用？ | 明确用户 |
| When | 什么时候用？频率？ | 理解场景 |
| Where | 在哪里用？环境？ | 理解上下文 |
| How | 现在怎么解决？痛点？ | 发现机会 |
| How much | 愿意付出多少？ | 评估价值 |

### 4.2 Apple 级设计标准

UI Designer Agent 遵循 Apple 设计原则：

- **简约至上**：去除一切不必要的元素
- **细节决定成败**：像素级对齐、动效精心打磨
- **一致性**：整体体验如同出自一人之手
- **人性化**：设计为人服务
- **惊喜感**：在细节中创造 "Wow" 时刻

**输出规范**：

| 规范类型 | 内容 |
|----------|------|
| 设计系统 | 颜色、字体、间距、圆角、阴影、动效 |
| 组件状态 | 默认、悬停、按下、禁用、聚焦、加载 |
| 无障碍 | 对比度 ≥ 4.5:1、键盘导航、屏幕阅读器 |
| 响应式 | Mobile / Tablet / Desktop 断点 |

### 4.3 测试门禁机制

```
┌─────────────────────────────────────┐
│  🚦 测试门禁（必须通过才能部署）      │
├─────────────────────────────────────┤
│  ✅ 所有单元测试通过                 │
│  ✅ 测试覆盖率 ≥ 70%                 │
│  ✅ 无严重 Bug（高优先级）           │
│  ✅ 关键 E2E 流程通过                │
└─────────────────────────────────────┘
```

**测试金字塔**：

| 测试类型 | 占比 | 说明 |
|----------|------|------|
| 单元测试 | 70% | 每个函数/组件必须有测试 |
| 集成测试 | 20% | API 端点、组件交互 |
| E2E 测试 | 10% | 关键用户流程 |

---

## 5. 目录结构

### 5.1 Skill 目录结构

```
skills/boss/
├── SKILL.md                    # 主编排文件
├── DESIGN.md                   # 设计文档（本文档）
├── agents/                     # Agent Prompt 文件
│   ├── boss-pm.md              # 产品经理
│   ├── boss-ui-designer.md     # UI/UX 设计师
│   ├── boss-architect.md       # 系统架构师
│   ├── boss-tech-lead.md       # 技术负责人
│   ├── boss-scrum-master.md    # Scrum Master
│   ├── boss-frontend.md        # 前端开发
│   ├── boss-backend.md         # 后端开发
│   ├── boss-qa.md              # QA 工程师
│   └── boss-devops.md          # DevOps 工程师
├── templates/                  # 输出模板
│   ├── prd.md.template
│   ├── architecture.md.template
│   ├── ui-spec.md.template
│   ├── tech-review.md.template
│   ├── tasks.md.template
│   ├── qa-report.md.template
│   └── deploy-report.md.template
├── references/                 # 参考资料
│   └── bmad-methodology.md
└── scripts/                    # 辅助脚本
    ├── init-project.sh         # 项目初始化（创建轻量占位文件）
    ├── resolve-template.sh     # 模板路径解析
    └── prepare-artifact.sh     # 按模板优先级准备当前产物骨架
```

### 5.2 产物目录结构

```
.boss/
├── templates/            # 项目级模板（可选，优先于内置 templates/）
├── <feature-name>/
│   ├── prd.md              # 产品需求文档（含用户故事）
│   ├── architecture.md     # 系统架构文档
│   ├── ui-spec.md          # UI/UX 规范
│   ├── tech-review.md      # 技术评审报告
│   ├── tasks.md            # 开发任务
│   ├── qa-report.md        # QA 测试报告
│   └── deploy-report.md    # 部署报告
```

---

## 6. 技术实现

### 6.1 Agent 调用方式

使用 Task 工具 + `general_purpose_task` 类型调用 Agent：

```javascript
// 1. 读取 Agent Prompt 文件
pm_prompt = Read("agents/boss-pm.md")

// 2. 调用 Task 工具
Task({
  subagent_type: "general_purpose_task",
  description: "PM: 需求穿透与 PRD 创建",
  query: pm_prompt + "\n\n---\n\n## 当前任务\n\n[任务描述]"
})
```

### 6.2 阶段执行策略

| 阶段 | 执行策略 | 说明 |
|------|----------|------|
| 模板初始化 | 条件执行 | 用户传入 `--template` 时，复制内置模板到 `.boss/templates/` 并暂停流水线 |
| 阶段 1 | 串行 → 并行 | PM 先执行（需求穿透），然后 Architect + UI Designer 并行 |
| 阶段 2 | 串行 | Tech Lead 评审 → Scrum Master 拆解 |
| 阶段 3 | 并行 + 循环 | Frontend/Backend 并行开发，QA 持续验证 |
| 阶段 4 | 串行 | QA 完整测试 → 门禁检查 → DevOps 部署 |

### 6.3 质量门禁

阶段 3 门禁（必须全部通过才能进入阶段 4）：

| 门禁检查 | 要求 |
|----------|------|
| 单元测试 | 必须执行并通过 |
| 测试覆盖率 | ≥70% |
| 测试通过率 | 无严重 Bug，无失败测试 |
| E2E 测试 | **必须编写并执行**（Playwright/Cypress） |

阶段 4 门禁：

| 门禁检查 | 要求 |
|----------|------|
| 部署报告 | 必须存在 |
| 服务可访问 | URL 返回 HTTP 2xx |

### 6.4 兼容性设计

Boss Skill 使用通用的 `general_purpose_task` agent，兼容主流 AI 编程工具：

#### 完全兼容 ✅

| 工具 | Skills 目录 | 说明 |
|------|-------------|------|
| **Trae** | `~/.blade/skills/` | 字节跳动 AI IDE |
| **Claude Code** | `~/.claude/skills/` | Anthropic 官方 CLI |
| **Open Code** | `~/.opencode/skills/` | 开源 Claude Code 替代 |
| **Cursor** | `~/.cursor/skills/` | AI-first 代码编辑器 |
| **Windsurf** | `~/.windsurf/skills/` | Codeium AI IDE |

#### 部分兼容 ⚠️

| 工具 | 适配方式 | 说明 |
|------|----------|------|
| **Cline** | `.clinerules` | 需手动配置 Agent prompts |
| **Roo Code** | `.roo/rules/` | Cline 分支，配置类似 |
| **Aider** | `.aider.conf.yml` | 需适配为 Aider 格式 |
| **Continue** | `.continue/config.json` | 需配置自定义 commands |

#### 兼容性原理

Boss Skill 的核心设计确保了广泛兼容性：

1. **纯 Markdown 格式** - 所有 Agent prompts 都是标准 Markdown，无特殊语法
2. **通用 Task 调用** - 使用 `general_purpose_task` 而非特定工具 API
3. **无外部依赖** - 不依赖特定运行时或框架
4. **模块化设计** - 可按需选用部分 Agent，灵活组合

### 6.5 模板覆盖机制

Boss Skill 支持项目级模板覆盖，以适配团队自己的文档规范。

模板查找顺序：

1. `.boss/templates/<name>.template`
2. Skill 内置 `templates/<name>.template`

初始化方式：

```bash
./scripts/init-project.sh <feature-name> --template
```

设计原则：

- 用户可以直接修改项目中的模板副本，无需改动 Skill 仓库默认模板
- 下游 Agent 必须优先读取项目级模板
- `scripts/init-project.sh` 只负责初始化轻量占位文件；正式落文前再按模板优先级逐个准备当前产物骨架
- 无论模板如何自定义，都应保留 `## 摘要` section 作为下游摘要优先读取入口

---

## 7. Agent 详细设计

### 7.1 PM Agent

**文件**：`agents/boss-pm.md`

**角色定位**：
- 20 年产品经验
- 受乔布斯和张小龙认可
- 能穿透用户需求表述

**核心能力**：
- 4 层需求挖掘（显性/隐性/潜在/惊喜）
- 5W2H 深度追问
- 竞品调研分析
- 用户画像构建

**输出**：
- PRD（含用户故事）
- 需求优先级矩阵
- 验收标准

### 7.2 UI Designer Agent

**文件**：`agents/boss-ui-designer.md`

**角色定位**：
- Apple Inc. 20 年设计师
- 吹毛求疵，追求像素级完美

**核心能力**：
- Apple 设计原则
- 完整设计系统
- 组件规范（所有状态）
- 无障碍设计

**输出**：
- UI 规范文档
- 设计系统定义
- 组件规格说明
- 交互规范

### 7.3 Tech Lead Agent

**文件**：`agents/boss-tech-lead.md`

**角色定位**：
- 15 年技术架构经验
- 负责技术方案评审

**核心能力**：
- 架构评审
- 技术风险评估
- 可行性分析
- 代码规范制定

**输出**：
- 技术评审报告
- 风险清单
- 改进建议
- 实施建议

---

## 8. 版本历史

| 版本 | 日期 | 变更内容 |
|------|------|----------|
| v2.0 | 2025-01 | PM 需求穿透能力、UI Designer Apple 级设计、Tech Lead 技术评审、角色职责优化 |
| v1.0 | 2024-12 | 初始版本，基础流水线 |

### v2.0 主要变更

1. **PM Agent 升级**
   - 新增需求穿透能力（4 层需求挖掘）
   - 新增 5W2H 深度追问法
   - PM 直接输出用户故事（原由 Tech Lead 负责）

2. **UI Designer Agent 升级**
   - 新增 Apple 级设计标准
   - 输出前端友好的详细规范
   - 完整的设计系统定义

3. **Tech Lead Agent 职责调整**
   - 从"创建用户故事"改为"技术方案评审"
   - 新增技术风险评估
   - 新增技术可行性分析

4. **工作流优化**
   - 阶段 1：PM 先执行（需求穿透），然后并行执行架构和 UI 设计
   - 阶段 2：从"拆解"改为"评审 + 任务拆解"
   - 阶段 3：明确区分 Frontend Agent 和 Backend Agent 调用

5. **产物结构调整**
   - 删除 stories.md（用户故事合并到 prd.md）
   - 新增 tech-review.md（技术评审报告）

---

## 9. Harness Engineer 架构

### 9.1 概述

Harness Engineer 是 Boss Skill 的**流水线工程化层**，负责将 Agent 编排从硬编码流程升级为可声明、可插拔、可观测的工业级流水线引擎。它通过"四件套"架构（Pipeline + Gate + Metrics + Runner）实现流水线的模板化管理、门禁质量卡点、运行时度量采集和阶段级执行控制。

### 9.2 四件套架构

```
┌─────────────────────────────────────────────────────────────────────┐
│                        Harness Engineer                              │
│                   （流水线工程化层 - 四件套）                          │
├─────────────────────────────────────────────────────────────────────┤
│                                                                      │
│  ┌───────────────┐  ┌───────────────┐                               │
│  │   Pipeline     │  │     Gate      │                               │
│  │  （流水线模板）  │  │  （质量门禁）  │                               │
│  │               │  │               │                               │
│  │  pipeline.json │  │  gate.sh      │                               │
│  │  定义阶段编排   │  │  检查+拦截    │                               │
│  │  选择 Agent 组  │  │  通过/拒绝    │                               │
│  └───────┬───────┘  └───────┬───────┘                               │
│          │                  │                                        │
│          ▼                  ▼                                        │
│  ┌───────────────┐  ┌───────────────┐                               │
│  │   Metrics     │  │    Runner     │                               │
│  │ （运行时度量）  │  │ （阶段执行器） │                               │
│  │               │  │               │                               │
│  │  execution.json│  │  check-stage  │                               │
│  │  阶段计时      │  │  update-stage │                               │
│  │  重试计数      │  │  retry-stage  │                               │
│  │  产物追踪      │  │  load-plugins │                               │
│  └───────────────┘  └───────────────┘                               │
│                                                                      │
├─────────────────────────────────────────────────────────────────────┤
│                         Boss Agent                                   │
│                    （编排层 - 调用四件套）                              │
└─────────────────────────────────────────────────────────────────────┘
```

**四件套职责矩阵**：

| 组件 | 职责 | 核心文件 | 说明 |
|------|------|----------|------|
| **Pipeline** | 流水线模板定义 | `pipeline.json` | 声明阶段编排、Agent 组合、Gate 绑定，按场景选择不同模板 |
| **Gate** | 质量门禁检查 | `gate.sh` + `plugin.json` | 阶段间卡点，执行安全审计/质量检查，通过才允许进入下一阶段 |
| **Metrics** | 运行时度量采集 | `execution.json` | 记录阶段计时、重试次数、产物列表、门禁结果 |
| **Runner** | 阶段级执行控制 | `check/update/retry-stage.sh` | 状态机驱动，管理阶段生命周期和状态转换 |

### 9.3 Pipeline Pack（流水线模板包）

Pipeline Pack 是预置的流水线配置模板，通过声明式 JSON 定义阶段编排和 Agent 组合，实现"一键切换"不同开发场景。

**内置模板**：

| Pack 名称 | 适用场景 | Agent 数 | 阶段 | 特点 |
|-----------|----------|----------|------|------|
| `default` | 全流程标准项目 | 9 | 1-2-3-4 | BMAD 完整 9-Agent 流水线 |
| `core` | 轻量快速开发 | 5 | 1-3-4 | 跳过 UI 设计和技术评审，直接进入开发 |
| `api-only` | 纯 API 后端服务 | 7 | 1-2-3-4 | 无 UI Designer/Frontend，专注后端 |
| `solana-contract` | Solana 智能合约 | 5 | 1-2-3-4 | Anchor + Rust，集成 security-audit 门禁 |

**Pipeline 配置结构**：

```json
{
  "name": "default",
  "version": "1.0.0",
  "type": "pipeline-pack",
  "config": {
    "stages": [1, 2, 3, 4],
    "roles": "full",
    "agents": ["boss-pm", "boss-architect", "..."],
    "gates": ["gate0", "gate1", "gate2"],
    "skipUI": false,
    "skipFrontend": false
  }
}
```

### 9.4 Runner（阶段执行器）

Runner 由三个脚本组成，基于**有限状态机**管理阶段生命周期。

**状态转换图**：

```
                    ┌──────────┐
                    │ pending  │
                    └────┬─────┘
                         │
                    ┌────▼─────┐     ┌──────────┐
              ┌────►│ running  ├────►│ completed│
              │     └────┬─────┘     └──────────┘
              │          │
              │     ┌────▼─────┐
              │     │  failed  │
              │     └────┬─────┘
              │          │
              │     ┌────▼─────┐
              └─────┤ retrying │
                    └──────────┘

    特殊路径:
      pending ──► skipped（跳过不执行）
      completed ──► running（允许回退重跑）
```

**合法状态转换表**：

| 当前状态 | 允许转换到 |
|----------|-----------|
| `pending` | `running`、`skipped` |
| `running` | `completed`、`failed` |
| `failed` | `retrying` |
| `retrying` | `running` |
| `completed` | `running`（回退重跑） |

**Runner 脚本**：

| 脚本 | 功能 | 关键能力 |
|------|------|----------|
| `check-stage.sh` | 阶段状态查询 | 前置依赖检查（`--can-proceed`）、重试检查（`--can-retry`）、摘要输出（`--summary`）、JSON 导出 |
| `update-stage.sh` | 阶段状态更新 | 状态转换校验、计时记录、产物记录、Gate 结果记录、全局状态自动推导 |
| `retry-stage.sh` | 阶段重试 | 自动检查重试上限、`failed → retrying → running` 两步转换 |

### 9.5 插件协议

Harness 支持通过插件扩展流水线能力。每个插件必须包含一个 `plugin.json` 清单文件，遵循 `plugin-schema.json` 规范。

**插件类型**：

| 类型 | 说明 | 必需钩子 |
|------|------|----------|
| `gate` | 门禁插件，在阶段间执行质量/安全检查 | `hooks.gate` |
| `agent` | Agent 扩展插件，增加新的专业 Agent | — |
| `pipeline-pack` | 流水线模板包，预置阶段和 Agent 组合 | — |
| `reporter` | 报告生成器，自定义报告格式 | `hooks.report` |

**插件清单结构（plugin.json）**：

```json
{
  "name": "security-audit",
  "version": "1.0.0",
  "type": "gate",
  "description": "安全审计门禁",
  "hooks": {
    "pre-stage": "pre.sh",
    "gate": "gate.sh",
    "post-gate": "post.sh"
  },
  "config": { ... },
  "stages": [3],
  "dependencies": [],
  "enabled": true
}
```

**钩子生命周期**：

```
阶段执行前 ──► pre-stage
                  │
            阶段正常执行
                  │
阶段执行后 ──► post-stage
                  │
门禁检查前 ──► pre-gate
                  │
门禁检查   ──► gate（返回 JSON 检查结果，exit 0 通过 / exit 1 拦截）
                  │
门禁检查后 ──► post-gate
```

**插件加载器（load-plugins.sh）功能**：

| 命令 | 功能 |
|------|------|
| `--list` | 列出所有已注册且启用的插件 |
| `--type <type>` | 按类型过滤插件 |
| `--validate` | 校验所有插件的 plugin.json 格式完整性 |
| `--register <feature>` | 将发现的插件注册到 execution.json |
| `--run-hook <hook> <feature> [stage]` | 执行指定钩子，自动按阶段范围过滤 |

### 9.6 新增目录结构

```
harness/
├── pipeline-packs/                  # 流水线模板包
│   ├── default/
│   │   └── pipeline.json            # 默认 9-Agent 全流程模板
│   ├── core/
│   │   └── pipeline.json            # 轻量 5-Agent 核心模板
│   ├── api-only/
│   │   └── pipeline.json            # 纯 API 后端模板
│   └── solana-contract/
│       └── pipeline.json            # Solana 智能合约模板
├── plugins/                         # 插件目录
│   └── security-audit/
│       ├── plugin.json              # 插件清单（遵循 plugin-schema.json）
│       └── gate.sh                  # 安全审计门禁脚本
└── plugin-schema.json               # 插件清单 JSON Schema 规范

scripts/harness/                     # Harness Runner 脚本
├── check-stage.sh                   # 阶段状态查询 & 前置检查
├── update-stage.sh                  # 阶段状态更新 & 度量记录
├── retry-stage.sh                   # 阶段重试（含上限检查）
└── load-plugins.sh                  # 插件发现、验证、注册、钩子执行
```

### 9.7 Claude Code Hooks 集成

#### 设计理念

Claude Code Hooks 是 Coding Agent 宿主提供的**生命周期回调机制**，允许在 Agent 运行过程中的关键节点注入自定义逻辑。Boss Skill 利用该机制在流水线执行的各个环节实现自动化守护，将"被动依赖 Agent 自觉遵守规范"升级为"主动在生命周期节点强制执行检查与同步"。

核心价值：

| 维度 | 说明 |
|------|------|
| **环境一致性** | 会话启动/恢复时自动校验运行环境，确保流水线所需的目录结构和依赖就绪 |
| **产物完整性** | 文件写入前后自动校验产物格式与路径规范，拦截不合规写入 |
| **流水线可观测** | 子 Agent 启动/结束时记录度量，Bash 命令执行后采集结果，实现全链路追踪 |
| **优雅终止** | Agent 停止或会话结束时自动保存状态快照，支持断点续跑 |

#### 生命周期节点

Hooks 覆盖 Agent 生命周期的 8 个关键节点：

```
SessionStart ──► SessionResume
      │                │
      ▼                ▼
 PreToolUse(Write) ──► PostToolUse(Write)
                       │
                       ▼
              PostToolUse(Bash)
                       │
                       ▼
          SubagentStart ──► SubagentStop
                              │
                              ▼
                   Stop / Notification
                              │
                              ▼
                        SessionEnd
```

#### 分层策略

Hooks 配置采用**两级分层**，实现"项目全局配置"与"Skill 级声明"的解耦：

| 层级 | 配置位置 | 作用域 | 说明 |
|------|----------|--------|------|
| **项目级** | `.claude/settings.json` | 整个项目 | 定义 hooks 事件与脚本的绑定关系，Claude Code 启动时自动加载 |
| **Skill 级** | Skill frontmatter | 单个 Skill | Skill 内部声明所需的 hook 脚本，安装插件时自动合并到项目级配置 |

项目级配置示例（`.claude/settings.json`）：

```json
{
  "hooks": {
    "SessionStart": [{ "command": "scripts/hooks/session-start.sh" }],
    "PreToolUse": [{ "command": "scripts/hooks/pre-tool-write.sh", "tool": "Write" }],
    "PostToolUse": [
      { "command": "scripts/hooks/post-tool-write.sh", "tool": "Write" },
      { "command": "scripts/hooks/post-tool-bash.sh", "tool": "Bash" }
    ],
    "SubagentStart": [{ "command": "scripts/hooks/subagent-start.sh" }],
    "SubagentStop": [{ "command": "scripts/hooks/subagent-stop.sh" }],
    "Stop": [{ "command": "scripts/hooks/on-stop.sh" }],
    "Notification": [{ "command": "scripts/hooks/on-notification.sh" }],
    "SessionEnd": [{ "command": "scripts/hooks/session-end.sh" }]
  }
}
```

#### Hook 脚本说明

| 脚本 | 触发时机 | 职责 |
|------|----------|------|
| `session-start.sh` | 新会话启动时 | 校验运行环境（目录结构、依赖版本），初始化 `.boss/` 产物目录，加载流水线配置 |
| `session-resume.sh` | 会话恢复/重连时 | 检测上次执行状态快照，恢复流水线断点，输出中断摘要供 Agent 上下文对齐 |
| `pre-tool-write.sh` | 文件写入前 | 校验目标路径是否符合产物规范（如必须在 `.boss/<feature>/` 下），拦截不合规写入 |
| `post-tool-write.sh` | 文件写入后 | 校验产物格式完整性（如模板必需 section 是否存在），更新 `execution.json` 产物清单 |
| `post-tool-bash.sh` | Bash 命令执行后 | 采集命令退出码和关键输出，记录到度量日志，检测门禁相关命令（如测试、构建）的结果 |
| `subagent-start.sh` | 子 Agent 启动时 | 记录子 Agent 启动时间和角色，更新 `execution.json` 阶段状态为 `running` |
| `subagent-stop.sh` | 子 Agent 结束时 | 记录子 Agent 结束时间和耗时，采集产出物列表，触发阶段完成度检查 |
| `on-stop.sh` | Agent 被用户中断时 | 保存当前流水线状态快照到 `.boss/<feature>/.meta/`，记录中断点位，支持后续断点续跑 |
| `on-notification.sh` | 收到系统通知时 | 处理外部事件通知（如 CI 回调、部署状态变更），将通知内容路由到对应的流水线阶段 |
| `session-end.sh` | 会话正常结束时 | 生成流水线执行摘要，归档度量数据，清理临时文件，输出最终状态报告 |

---

## 10. 版本历史（更新）

| 版本 | 日期 | 变更内容 |
|------|------|----------|
| v3.0 | 2026-04 | Harness Engineer 四件套架构（Pipeline + Gate + Metrics + Runner）、插件协议、Pipeline Pack 模板 |
| v2.0 | 2025-01 | PM 需求穿透能力、UI Designer Apple 级设计、Tech Lead 技术评审、角色职责优化 |
| v1.0 | 2024-12 | 初始版本，基础流水线 |

### v3.0 主要变更

1. **Harness Engineer 架构引入**
   - 新增四件套架构（Pipeline + Gate + Metrics + Runner）
   - 流水线编排从硬编码升级为声明式 JSON 配置
   - 阶段执行基于有限状态机，支持自动重试和回退重跑

2. **Pipeline Pack 模板机制**
   - 内置 4 套流水线模板（default / core / api-only / solana-contract）
   - 支持按场景选择 Agent 组合和阶段编排
   - 支持自定义技术栈配置（如 Anchor + Rust）

3. **插件协议**
   - 定义标准 plugin.json 清单规范（含 JSON Schema 校验）
   - 支持 4 类插件：gate / agent / pipeline-pack / reporter
   - 完整的钩子生命周期（pre-stage → post-stage → pre-gate → gate → post-gate）
   - 插件加载器支持发现、验证、注册和钩子执行

4. **Runner 阶段执行器**
   - check-stage：阶段状态查询、前置依赖检查、摘要输出
   - update-stage：状态转换校验、计时记录、产物追踪、Gate 结果记录
   - retry-stage：自动检查重试上限，两步状态转换

5. **安全审计门禁**
   - 内置 security-audit 插件（gate 类型）
   - 敏感信息泄露扫描（AWS Key、API Key、Private Key、GitHub Token、OpenAI Key）
   - 依赖漏洞审计（npm audit / pip-audit）
   - 不安全代码模式检测（eval / dangerouslySetInnerHTML / innerHTML）

---
