# boss-skill

[![CodeRabbit Pull Request Reviews](https://img.shields.io/coderabbit/prs/github/echoVic/boss-skill?utm_source=oss&utm_medium=github&utm_campaign=echoVic%2Fboss-skill&labelColor=171717&color=FF570A&link=https%3A%2F%2Fcoderabbit.ai&label=CodeRabbit+Reviews)](https://coderabbit.ai)

BMAD 全自动项目编排 Skill，适用于所有支持 Skill 的 Coding Agent（Claude Code、OpenClaw、Cursor、Windsurf 等）。

从需求到部署的完整研发流水线，编排 9 个专业 Agent 自动完成完整研发周期。

## 安装

**方式一：Claude Code 插件安装（推荐）**

本仓库已适配 Claude Code 插件系统（`/plugin` 命令，Public Beta）。

```bash
# 1. 将本仓库添加为插件市场
/plugin marketplace add echoVic/boss-skill

# 2. 安装 boss 插件
/plugin install boss@echoVic/boss-skill
```

安装后即可使用 `/boss` 斜杠命令启动流水线：

```
/boss 做一个 Todo 应用
```

管理命令：

```bash
/plugin list                                  # 查看已安装插件
/plugin disable boss@echoVic/boss-skill       # 临时禁用
/plugin enable boss@echoVic/boss-skill        # 重新启用
/plugin uninstall boss@echoVic/boss-skill     # 卸载
```

**方式二：克隆到 Coding Agent 的 Skills 目录**

| 工具 | Skills 目录 |
|------|------------|
| Claude Code | `~/.claude/skills/` |
| Cursor | `~/.cursor/skills/` |
| Windsurf | `~/.windsurf/skills/` |
| Trae | `~/.trae/skills/` |
| OpenAI Codex | `~/.codex/skills/` |

```bash
# 以 Claude Code 为例
git clone https://github.com/echoVic/boss-skill.git ~/.claude/skills/boss
# 以 OpenAI Codex 为例
git clone https://github.com/echoVic/boss-skill.git ~/.codex/skills/boss
```

**方式三：适配 Google Antigravity (Beta)**

Google Antigravity 要求技能存放在项目的 `.agent/skills/` 目录下。我们提供了一个适配脚本，可以将 Boss Skill 快速集成到你的 Antigravity 环境中：

```bash
# 在你的项目根目录下运行 (假设你已经在项目外克隆了 boss-skill)
/path/to/boss-skill/scripts/adapt-antigravity.sh
```

**方式四：适配 OpenAI Codex (Beta)**

OpenAI Codex 建议将项目相关的技能存放在 `.agents/skills/` 目录下（注意是 `agents` 复数）。

```bash
# 在你的项目根目录下运行
/path/to/boss-skill/scripts/adapt-codex.sh
```

**方式五：集成到 OpenCode**

OpenCode (sst/opencode) 识别技能的默认路径为项目根目录下的 `.opencode/skills/`。

```bash
# 在你的项目根目录下运行
mkdir -p .opencode/skills/boss
git clone https://github.com/echoVic/boss-skill.git .opencode/skills/boss
```

**方式六：手动复制 SKILL.md**

将 `SKILL.md` 复制到你的 Coding Agent 支持的 Slash Command 目录，然后根据需要将 `agents/`、`references/`、`templates/`、`scripts/` 目录一起放入同一位置。

**方式七：cc-switch 导入（Beta）**

cc-switch 导入 zip 时，建议压缩包内包含一个顶层目录，例如 `boss/`，并让 `SKILL.md`、`agents/`、`references/`、`templates/`、`scripts/` 都位于这个目录下。

推荐直接使用仓库内置打包脚本：

```bash
./scripts/package-cc-switch.sh
```

默认会生成：

```bash
dist/boss-skill-cc-switch.zip
```

导入步骤：

1. 在 cc-switch 中选择导入本地 Skill zip 包
2. 选择 `dist/boss-skill-cc-switch.zip`
3. 导入完成后，确认 Skill 已出现在 cc-switch 的技能列表中

注意：
- 这是兼容性导入方案，仍按 Beta 看待
- 不建议把 `SKILL.md` 和各目录直接放在 zip 根部；这类包在 cc-switch 中可能会被落到 `.tmpxxxxxx` 隐藏目录，导致界面不显示
- 不建议直接使用 GitHub 自动生成的源码 zip；目录结构不可控，容易与 cc-switch 的导入逻辑不匹配
- 如果导入失败，先检查 zip 内是否为 `boss/SKILL.md` 这样的结构

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
| `--quick` | 跳过确认节点，全自动 |
| `--template` | 初始化项目级模板目录（`.boss/templates/`）并暂停流水线 |
| `--continue-from <1-4>` | 从指定阶段继续，跳过已完成阶段 |
| `--hitl-level <level>` | 人机协作：`auto`（默认）/ `interactive` / `off` |
| `--roles <preset>` | 角色预设：`full`（默认，9 个）/ `core`（PM/Architect/Dev/QA） |

## 模板初始化

如果你希望先按项目规范调整文档模板，再开始流水线，可以先执行：

```
/boss 用户认证 --template
```

或直接运行初始化脚本：

```bash
./scripts/init-project.sh user-auth --template
```

执行后会创建项目级模板目录：

```
.boss/templates/
├── prd.md.template
├── architecture.md.template
├── ui-spec.md.template
├── tech-review.md.template
├── tasks.md.template
├── qa-report.md.template
└── deploy-report.md.template
```

后续生成文档时，Boss 会优先读取 `.boss/templates/` 中的模板；如果不存在，再回退到 Skill 内置 `templates/`。
`scripts/init-project.sh` 仍只负责创建轻量占位文件；Boss 在真正生成某个产物前，会再调用 `scripts/prepare-artifact.sh` 按同样的优先级准备该文档骨架。

如果 `.boss/templates/` 已存在，`--template` 默认会停止初始化，避免覆盖你已修改的模板。此时可以先删除该目录后重试；如果你明确要覆盖，可使用 `--force`。

建议保留：
- `## 摘要` section
- 核心产物文件名（如 `prd.md`、`tasks.md`）
- 必要的验收、风险、测试等关键结构

## 产物

所有产物保存在 `.boss/<feature>/` 目录：

```
.boss/templates/       # 项目级模板（可选，优先于内置 templates/）
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
├── .claude/                          # Claude Code Hooks 配置
│   └── settings.json                 # Claude Code hooks 配置
├── .claude-plugin/                   # Claude Code 插件元数据
│   └── plugin.json                   # 插件清单（name/version/description）
├── commands/                         # Claude Code 斜杠命令
│   └── boss.md                       # /boss 命令入口
├── SKILL.md                          # 工作流 checklist（Skills 目录 & 插件共用）
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
├── harness/                          # 流水线编排与插件系统
│   ├── plugin-schema.json            # 插件描述 JSON Schema
│   ├── plugins/                      # 内置插件
│   │   └── security-audit/           # 安全审计插件
│   │       ├── plugin.json           # 插件清单
│   │       └── gate.sh               # 门禁脚本
│   └── pipeline-packs/              # 流水线预设包
│       ├── default/                  # 默认流水线
│       │   └── pipeline.json
│       ├── core/                     # 核心流水线
│       │   └── pipeline.json
│       ├── solana-contract/          # Solana 合约流水线
│       │   └── pipeline.json
│       └── api-only/                 # 纯 API 流水线
│           └── pipeline.json
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
    ├── init-project.sh               # 项目初始化脚本（创建轻量占位文件）
    ├── resolve-template.sh           # 模板路径解析（项目模板优先）
    ├── prepare-artifact.sh           # 按模板优先级准备当前产物骨架
    ├── harness/                      # 流水线阶段管理脚本
    │   ├── update-stage.sh           # 更新阶段状态
    │   ├── check-stage.sh            # 检查阶段完成条件
    │   ├── retry-stage.sh            # 重试失败阶段
    │   └── load-plugins.sh           # 加载并注册插件
    ├── gates/                        # 质量门禁脚本
    │   ├── gate-runner.sh            # 门禁统一调度器
    │   ├── gate0-code-quality.sh     # Gate 0：代码质量检查
    │   ├── gate1-testing.sh          # Gate 1：测试覆盖率检查
    │   └── gate2-performance.sh      # Gate 2：性能基准检查
    ├── report/                       # 报告生成脚本
    │   └── generate-summary.sh       # 生成流水线执行摘要
    └── hooks/                        # Claude Code Hooks 脚本
        ├── session-start.sh          # 会话启动时执行
        ├── session-resume.sh         # 会话恢复时执行
        ├── pre-tool-write.sh         # 文件写入前执行
        ├── post-tool-write.sh        # 文件写入后执行
        ├── post-tool-bash.sh         # Bash 命令执行后执行
        ├── subagent-start.sh         # 子 Agent 启动时执行
        ├── subagent-stop.sh          # 子 Agent 结束时执行
        ├── on-stop.sh               # Agent 停止时执行
        ├── on-notification.sh        # 收到通知时执行
        └── session-end.sh           # 会话结束时执行
```

## 设计理念

基于 BMAD（Breakthrough Method of Agile AI-Driven Development）方法论，详见 `references/bmad-methodology.md` 和 `DESIGN.md`。

## Star History

[![Star History Chart](https://api.star-history.com/svg?repos=echoVic/boss-skill&type=Date)](https://star-history.com/#echoVic/boss-skill&Date)

## License

MIT
