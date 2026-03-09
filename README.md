# boss-skill

BMAD 全自动项目编排 Skill，适用于所有支持 Skill 的 Coding Agent（Claude Code、OpenClaw、Cursor、Windsurf 等）。

从需求到部署的完整研发流水线，编排 9 个专业 Agent 自动完成完整研发周期。

## 安装

**方式一：克隆到 Coding Agent 的 Skills 目录**

| 工具 | Skills 目录 |
|------|------------|
| Claude Code | `~/.claude/skills/` |
| Cursor | `~/.cursor/skills/` |
| Windsurf | `~/.windsurf/skills/` |
| Trae | `~/.trae/skills/` |

```bash
# 以 Claude Code 为例
git clone https://github.com/echoVic/boss-skill.git ~/.claude/skills/boss
```

**方式二：手动复制 SKILL.md**

将 `SKILL.md` 复制到你的 Coding Agent 支持的 Slash Command 目录，然后根据需要将 `agents/`、`references/`、`templates/` 目录一起放入同一位置。

---

## 工作原理

Boss Agent 不直接写代码，而是编排专业 Agent 按四阶段流水线执行：

```
需求 → [PM → Architect → UI] → [Tech Lead → Scrum Master] → [Dev → QA] → [DevOps] → 交付
         阶段 1: 规划              阶段 2: 评审+拆解          阶段 3: 开发    阶段 4: 部署
```

每个阶段产出文档，下一阶段基于前一阶段产物，测试不通过不能部署。

## 9 个专业 Agent

| Agent | 职责 |
|-------|------|
| PM | 需求穿透 — 显性、隐性、潜在、惊喜需求 |
| Architect | 架构设计、技术选型、API 设计 |
| UI Designer | UI/UX 设计规范 |
| Tech Lead | 技术评审、风险评估 |
| Scrum Master | 任务分解、测试用例定义 |
| Frontend | UI 组件、状态管理、前端测试 |
| Backend | API、数据库、后端测试 |
| QA | 测试执行、Bug 报告 |
| DevOps | 构建部署、健康检查 |

## 使用方式

触发词：`boss mode`、`/boss`、`全自动开发`、`从需求到部署`

```
/boss 做一个 Todo 应用
/boss 给现有项目加用户认证 --skip-ui
/boss 快速搭建 API 服务 --skip-deploy --quick
/boss 继续上次中断的任务 --continue-from 3
/boss 轻量模式 --roles core --hitl-level off
```

| 参数 | 说明 |
|------|------|
| `--skip-ui` | 跳过 UI 设计（纯 API/CLI） |
| `--skip-deploy` | 跳过部署阶段 |
| `--quick` | 跳过确认节点，全自动 |
| `--continue-from <1-4>` | 从指定阶段继续，跳过已完成阶段 |
| `--hitl-level <level>` | 人机协作：`auto`（默认）/ `interactive` / `off` |
| `--roles <preset>` | 角色预设：`full`（默认，9 个）/ `core`（PM/Architect/Dev/QA） |

## 产物

所有产物保存在 `.boss/<feature>/` 目录：

```
.boss/<feature>/
├── prd.md              # 产品需求文档
├── architecture.md     # 系统架构
├── ui-spec.md          # UI 规范（可选）
├── tech-review.md      # 技术评审
├── tasks.md            # 开发任务
├── qa-report.md        # QA 报告
├── deploy-report.md    # 部署报告
└── .meta/
    └── execution.json  # 执行追踪（阶段状态、Token、质量门禁）
```

## 质量门禁

三层门禁，不可绕过：

| 门禁 | 时机 | 检查内容 |
|------|------|---------|
| Gate 0 | 开发后、测试前 | TypeScript 编译、Lint |
| Gate 1 | QA 后、部署前 | 测试覆盖率 ≥ 70%、无 P0/P1 Bug、E2E 通过 |
| Gate 2 | 部署前（Web） | Lighthouse ≥ 80、API P99 < 500ms |

## 文件结构

```
boss-skill/
├── SKILL.md                          # 工作流 checklist
├── DESIGN.md                         # 设计文档
├── agents/                           # 9 个 Agent Prompt（按需加载）
│   ├── boss-pm.md
│   ├── boss-architect.md
│   ├── boss-ui-designer.md
│   ├── boss-tech-lead.md
│   ├── boss-scrum-master.md
│   ├── boss-frontend.md
│   ├── boss-backend.md
│   ├── boss-qa.md
│   └── boss-devops.md
├── references/                       # 按需加载的规范文档
│   ├── bmad-methodology.md           # BMAD 方法论
│   ├── artifact-guide.md             # 产物保存规范
│   ├── testing-standards.md          # 测试标准
│   └── quality-gate.md               # 质量门禁
├── templates/                        # 产物模板
│   ├── prd.md.template
│   ├── architecture.md.template
│   ├── ui-spec.md.template
│   ├── tech-review.md.template
│   ├── tasks.md.template
│   ├── qa-report.md.template
│   └── deploy-report.md.template
└── scripts/
    └── init-project.sh               # 项目初始化脚本
```

## 设计理念

基于 BMAD（Breakthrough Method of Agile AI-Driven Development）方法论，详见 `references/bmad-methodology.md` 和 `DESIGN.md`。

## License

MIT
