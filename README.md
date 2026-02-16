# boss-skill

BMAD 全自动项目编排 Skill，适用于 [OpenClaw](https://github.com/openclaw/openclaw) Agent。

从需求到部署的完整研发流水线，编排 9 个专业 Agent 自动完成完整研发周期。

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
```

| 参数 | 说明 |
|------|------|
| `--skip-ui` | 跳过 UI 设计（纯 API/CLI） |
| `--skip-deploy` | 跳过部署阶段 |
| `--quick` | 跳过确认节点，全自动 |

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
└── deploy-report.md    # 部署报告
```

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
