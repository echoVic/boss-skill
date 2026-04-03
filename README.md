# boss-skill

[![npm version](https://img.shields.io/npm/v/@blade-ai/boss-skill)](https://www.npmjs.com/package/@blade-ai/boss-skill)
[![CodeRabbit Pull Request Reviews](https://img.shields.io/coderabbit/prs/github/echoVic/boss-skill?utm_source=oss&utm_medium=github&utm_campaign=echoVic%2Fboss-skill&labelColor=171717&color=FF570A&link=https%3A%2F%2Fcoderabbit.ai&label=CodeRabbit+Reviews)](https://coderabbit.ai)

BMAD Harness Engineer — 全自动研发流水线编排 Skill，兼容 Claude Code、OpenClaw、Codex、Antigravity。

从需求到部署的完整研发流水线，编排 9 个专业 Agent 自动完成完整研发周期。

## 安装

```bash
npm install -g @blade-ai/boss-skill
boss-skill
```

CLI 自动检测已安装的 Coding Agent，一条命令全部搞定：

```
Detected 4 agent(s):

  ✅ OpenClaw: ~/.openclaw/skills/boss       (copy + inject metadata)
  ✅ Codex: ~/.codex/skills/boss             (copy + inject metadata)
  ✅ Antigravity: ~/.gemini/.../skills/boss   (copy + inject metadata)
  ✅ Claude Code: 8 hook events → .claude/settings.json
```

| Agent | 检测条件 | 安装目标 | 安装方式 |
|-------|---------|---------|---------|
| **OpenClaw** | `~/.openclaw/` 存在 | `~/.openclaw/skills/boss/` | 复制 + 注入 `metadata.openclaw` |
| **Codex** | `~/.codex/` 存在 | `~/.codex/skills/boss/` | 复制 + 注入 `metadata.codex` |
| **Antigravity** | `~/.gemini/antigravity/` 存在 | `~/.gemini/antigravity/skills/boss/` | 复制 + 注入 `metadata.antigravity` |
| **Claude Code** | 始终安装 | `.claude/settings.json` | 合并 hooks 配置 |

升级：

```bash
npm update -g @blade-ai/boss-skill && boss-skill
```

或在 Claude Code 中使用 `/boss:upgrade` 命令。

## 工作原理

```
用户一句话 → [需求澄清] → [PM → Architect → UI] → [Tech Lead → Scrum Master] → [Dev → QA] → [DevOps] → 交付
              Step 0        阶段 1: 规划              阶段 2: 评审+拆解          阶段 3: 开发    阶段 4: 部署
```

### 需求澄清（Brainstorming）

用户只说了一句话（如"帮我做个记账 APP"），Boss 会自动判断需求完整度：

| 用户输入 | 判断 | 处理 |
|---------|------|------|
| "帮我做个记账 APP" | 缺「给谁用」和「核心场景」 | → 自动启动需求澄清 |
| "做一个面向设计师的素材管理工具，能上传、搜索、分类" | 三要素齐全 | → 确认后直接开跑 |

三要素检查：**做什么** + **给谁用** + **核心场景**。缺任何一个就自动触发 brainstorming，把一句话翻译成一页纸的 `design-brief.md`。

### 四阶段流水线

- **阶段 1 — 规划**：PM 需求穿透 → Architect 架构设计 → UI Designer 设计规范（并行）
- **阶段 2 — 评审**：Tech Lead 技术评审 → Scrum Master 任务拆解
- **阶段 3 — 开发**：Frontend + Backend 并行开发 → QA 测试 → 质量门禁
- **阶段 4 — 部署**：DevOps 构建部署 → 最终报告

每个阶段由 Harness Engine 驱动，状态机追踪，门禁不可绕过。

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
/boss 用户认证 --template
/boss 给现有项目加用户认证 --skip-ui
/boss 快速搭建 API 服务 --skip-deploy --quick
/boss 继续上次中断的任务 --continue-from 3
/boss 轻量模式 --roles core --hitl-level off
```

| 参数 | 说明 |
|------|------|
| `--skip-ui` | 跳过 UI 设计（纯 API/CLI） |
| `--skip-deploy` | 跳过部署阶段 |
| `--quick` | 跳过确认节点和需求澄清，全自动 |
| `--template` | 初始化项目级模板目录（`.boss/templates/`）并暂停流水线 |
| `--continue-from <1-4>` | 从指定阶段继续，跳过已完成阶段 |
| `--hitl-level <level>` | 人机协作：`auto`（默认）/ `interactive` / `off` |
| `--roles <preset>` | 角色预设：`full`（默认，9 个）/ `core`（PM/Architect/Dev/QA） |

## Harness Engine

### 状态机

每个阶段遵循状态转换：`pending → running → completed/failed → retrying → running`

状态变更通过 `scripts/harness/update-stage.sh` 原子写入 `.meta/execution.json`。

### 质量门禁

三层门禁，不可绕过：

| 门禁 | 时机 | 检查内容 |
|------|------|---------|
| Gate 0 | 开发后、测试前 | TypeScript 编译、Lint |
| Gate 1 | QA 后、部署前 | 测试覆盖率 ≥ 70%、无 P0/P1 Bug、E2E 通过 |
| Gate 2 | 部署前（Web） | Lighthouse ≥ 80、API P99 < 500ms |

支持通过插件扩展自定义门禁。

### Hook Profile

通过环境变量控制 hook 运行级别：

| 环境变量 | 说明 | 值 |
|----------|------|-----|
| `BOSS_HOOK_PROFILE` | Hook 运行级别 | `minimal` / `standard`（默认）/ `strict` |
| `BOSS_DISABLED_HOOKS` | 禁用指定 hook | 逗号分隔的 Hook ID |

10 个 Node.js hooks 覆盖完整 Agent 生命周期：session 启停、文件读写守卫、bash 命令捕获、子 Agent 调度、流水线退出保护。

### 子代理协议

所有子代理使用标准化状态报告：

| 状态 | 含义 |
|------|------|
| `DONE` | 任务完成 |
| `DONE_WITH_CONCERNS` | 完成但有疑虑 |
| `NEEDS_CONTEXT` | 需要更多上下文 |
| `BLOCKED` | 被阻塞，无法继续 |

### Session 记忆持久化

- SessionEnd 保存流水线状态到 `.boss/.session-state.json`
- SessionStart 加载状态恢复上下文，跨 session 无缝继续

### 插件系统

通过 `harness/plugins/` 注册自定义 gate、agent 或 pipeline 模板包。内置 4 套 Pipeline Pack（default、core、api-only、solana-contract）。

## 模板系统

Boss 支持项目级模板覆盖：

```bash
/boss 用户认证 --template    # 初始化 .boss/templates/
```

模板查找优先级：`.boss/templates/` > 内置 `templates/`。

## 产物目录

```
.boss/<feature>/
├── design-brief.md     # 需求澄清产出（可选）
├── prd.md              # 阶段 1: 产品需求
├── architecture.md     # 阶段 1: 系统架构
├── ui-spec.md          # 阶段 1: UI 规范（可选）
├── tech-review.md      # 阶段 2: 技术评审
├── tasks.md            # 阶段 2: 开发任务
├── qa-report.md        # 阶段 3: QA 报告
├── deploy-report.md    # 阶段 4: 部署报告
├── summary-report.md   # 流水线报告（Harness 自动生成）
└── .meta/
    └── execution.json  # 执行追踪（状态机 + 门禁 + 指标）
```

## 文件结构

```
boss-skill/
├── bin/
│   └── boss-skill.js                 # CLI 入口（auto-detect + metadata 注入）
├── SKILL.md                          # 核心编排流程（通用 frontmatter，无平台 metadata）
├── skills/
│   └── brainstorming/
│       └── SKILL.md                  # 需求澄清 Skill
├── agents/                           # 9 个 Agent Prompt
│   ├── boss-pm.md
│   ├── boss-architect.md
│   ├── boss-ui-designer.md
│   ├── boss-tech-lead.md
│   ├── boss-scrum-master.md
│   ├── boss-frontend.md
│   ├── boss-backend.md
│   ├── boss-qa.md
│   ├── boss-devops.md
│   └── prompts/                      # 子代理 Prompt 模板
│       ├── implementer-prompt.md
│       ├── spec-reviewer-prompt.md
│       ├── code-quality-reviewer-prompt.md
│       └── subagent-protocol.md
├── commands/                         # Claude Code 斜杠命令
│   ├── boss.md                       # /boss 命令
│   └── boss-upgrade.md               # /boss:upgrade 升级命令
├── harness/                          # 流水线编排与插件系统
│   ├── plugin-schema.json
│   ├── plugins/
│   │   └── security-audit/
│   └── pipeline-packs/               # 4 套流水线预设
│       ├── default/
│       ├── core/
│       ├── api-only/
│       └── solana-contract/
├── references/                       # 按需加载的规范文档
│   ├── bmad-methodology.md
│   ├── artifact-guide.md
│   ├── testing-standards.md
│   └── quality-gate.md
├── templates/                        # 7 个产物模板
├── scripts/
│   ├── init-project.sh               # 项目初始化
│   ├── resolve-template.sh           # 模板路径解析
│   ├── prepare-artifact.sh           # 产物骨架准备
│   ├── lib/                          # Node.js 共享库
│   │   ├── boss-utils.js             # 工具函数
│   │   ├── hook-flags.js             # Hook Profile 门控
│   │   └── run-with-flags.js         # Hook 统一调度中间件
│   ├── hooks/                        # 10 个 Node.js Hook 脚本
│   │   ├── session-start.js
│   │   ├── session-resume.js
│   │   ├── pre-tool-write.js
│   │   ├── post-tool-write.js
│   │   ├── post-tool-bash.js
│   │   ├── subagent-start.js
│   │   ├── subagent-stop.js
│   │   ├── on-stop.js
│   │   ├── on-notification.js
│   │   └── session-end.js
│   ├── harness/                      # 流水线阶段管理
│   │   ├── update-stage.sh
│   │   ├── check-stage.sh
│   │   ├── retry-stage.sh
│   │   └── load-plugins.sh
│   ├── gates/                        # 质量门禁
│   │   ├── gate-runner.sh
│   │   ├── gate0-code-quality.sh
│   │   ├── gate1-testing.sh
│   │   └── gate2-performance.sh
│   └── report/
│       └── generate-summary.sh
├── .claude/
│   └── settings.json                 # Claude Code hooks 配置
├── .claude-plugin/
│   ├── plugin.json
│   └── marketplace.json
└── package.json
```

## 设计理念

基于 BMAD（Breakthrough Method of Agile AI-Driven Development）方法论，详见 `references/bmad-methodology.md` 和 `DESIGN.md`。

## Star History

[![Star History Chart](https://api.star-history.com/svg?repos=echoVic/boss-skill&type=Date)](https://star-history.com/#echoVic/boss-skill&Date)

## License

MIT
