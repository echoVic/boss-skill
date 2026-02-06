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
    └── init-project.sh         # 项目初始化
```

### 5.2 产物目录结构

```
.boss/
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
| **Claude Code** | `~/.claude/commands/` | Anthropic 官方 CLI |
| **Open Code** | `~/.opencode/commands/` | 开源 Claude Code 替代 |
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
