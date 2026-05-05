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

  ✅ OpenClaw: ~/.openclaw/skills/boss       (copied + metadata injected)
  ✅ Codex: ~/.codex/skills/boss             (copied + metadata injected)
  ✅ Antigravity: ~/.gemini/.../skills/boss   (copied + metadata injected)
  ✅ Claude Code: plugin ready at /path/to/boss-skill
     Use:  claude --plugin-dir "$(boss-skill path)"
```

| Agent | 检测条件 | 安装方式 |
|-------|---------|---------|
| **OpenClaw** | `~/.openclaw/` 存在 | 复制到 `~/.openclaw/skills/boss/` + 注入 `metadata.openclaw` |
| **Codex** | `~/.codex/` 存在 | 复制到 `~/.codex/skills/boss/` + 注入 `metadata.codex` |
| **Antigravity** | `~/.gemini/antigravity/` 存在 | 复制到 `~/.gemini/antigravity/skills/boss/` + 注入 `metadata.antigravity` |
| **Claude Code** | 始终 | Plugin 模式 — `claude --plugin-dir "$(boss-skill path)"` |

### Claude Code 使用

Claude Code 采用原生 Plugin 架构，无需复制文件到项目：

```bash
claude --plugin-dir "$(boss-skill path)"
```

启动后即可使用 `/boss` 命令、9 个 Agent、所有 hooks 和 skills。

升级：

```bash
npm update -g @blade-ai/boss-skill
```

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
/boss 把现有原生 HTML 组件迁移成 shadcn 组件
/boss 快速搭建 API 服务 --skip-deploy --quick
/boss 继续上次中断的任务 --continue-from 3
/boss 轻量模式 --roles core --hitl-level off
```

Boss 支持自然语言需求：执行前会先推导一个英文 kebab-case 的 feature slug 作为产物目录名，例如“做一个 Todo 应用”会落到 `.boss/todo-app/`。如果用户只是补充技术约束或团队偏好，例如“不要用原生 html 组件，我们引入了 shadcn”，Boss 会暂停并询问这条约束要应用到哪个 feature，而不是新建目录。

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

状态变更通过 runtime 直接追加到 `.meta/events.jsonl`，再由 `runtime/projectors/materialize-state.js` 物化为只读的 `.meta/execution.json`。

### Runtime / CLI 编排面

`runtime/cli/*.js` 与 `runtime/cli/lib/pipeline-runtime.js` 是唯一的 runtime-first surface。对外能力以 runtime CLI 为准，不再把 shell wrapper 视为兼容契约。

| 编排动作 | Runtime CLI |
|------|------|
| 初始化流水线 | `runtime/cli/init-pipeline.js` |
| 查询 ready artifacts | `runtime/cli/get-ready-artifacts.js` |
| 记录产物完成 | `runtime/cli/record-artifact.js` |
| 更新阶段状态 | `runtime/cli/update-stage.js` |
| 更新 Agent 状态 | `runtime/cli/update-agent.js` |
| 执行门禁 | `runtime/cli/evaluate-gates.js` |
| 注册插件 | `runtime/cli/register-plugins.js` |
| 执行插件 Hook | `runtime/cli/run-plugin-hook.js` |
| 检查阶段状态 | `runtime/cli/check-stage.js` |
| 回放事件/快照 | `runtime/cli/replay-events.js` |
| 诊断流水线状态 | `runtime/cli/inspect-pipeline.js` |
| 查看最近事件 | `runtime/cli/inspect-events.js` |
| 查看 progress 流 | `runtime/cli/inspect-progress.js` |
| 查看插件生命周期 | `runtime/cli/inspect-plugins.js` |
| 生成流水线报告 | `runtime/cli/generate-summary.js` |
| 生成诊断页 | `runtime/cli/render-diagnostics.js` |

Pack 选择和插件生命周期现在都是 runtime 事件，不再只是 shell 侧副作用：
- pack 选择通过 `PackApplied` 进入状态真相。
- 插件发现/激活通过 `PluginDiscovered` / `PluginActivated` 进入事件流。
- 插件 hook 执行通过 `PluginHookExecuted` / `PluginHookFailed` 进入事件流。

四期排障 CLI 已开始补齐：
- `runtime/cli/inspect-pipeline.js` 查看当前阶段、ready artifacts、active agents、pack、plugins、metrics。
- `runtime/cli/inspect-events.js` 查看最近事件并支持按类型过滤。
- `runtime/cli/inspect-progress.js` 查看 progress flow。
- `runtime/cli/inspect-plugins.js` 查看 active/discovered/activated/executed/failed 插件状态。
- `runtime/cli/check-stage.js` / `runtime/cli/replay-events.js` 直接承担状态排障和事件回放。

四期报告 runtime 已抽离为独立的 summary model + renderer：
- `runtime/cli/generate-summary.js` 是 canonical summary surface，默认输出 Markdown，也支持 `--json` 和 `--stdout`。
- `runtime/report/summary-model.js` 负责从 `execution.json` 构建统一 summary model。
- `runtime/report/render-markdown.js` 负责渲染 `summary-report.md`。
- `runtime/report/render-json.js` 负责渲染机器可读的 JSON 报告。
- `runtime/report/render-html.js` + `runtime/cli/render-diagnostics.js` 负责生成最小 HTML 诊断页。

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

## 开发

### 环境要求

- Node.js >= 20
- jq（Shell 脚本依赖，`brew install jq`）

### 安装与测试

```bash
git clone https://github.com/echoVic/boss-skill.git
cd boss-skill
npm install
npm run build
npm run typecheck
npm test
```

### 源码与产物布局

- `src/` 是 CLI 和 runtime 的 TypeScript/ESM 源码入口。
- `dist/` 是 `npm publish` 和包内 `bin` 指向的构建产物，不要手改。
- `runtime/cli/*.js` 与 `runtime/cli/lib/*.js` 保留为稳定的 ESM wrapper，供 shell/hook 入口继续调用。
- `npm test` 运行 Vitest；测试文件统一放在 `test/**/*.test.ts`。

### 发布

使用统一发布脚本，自动同步所有文件的版本号（`package.json`、`SKILL.md`、`plugin.json`、`marketplace.json`）：

```bash
# 语义化升级
npm run release -- patch          # 3.2.0 → 3.2.1
npm run release -- minor          # 3.2.0 → 3.3.0
npm run release -- major          # 3.2.0 → 4.0.0

# 指定版本号
npm run release -- 3.5.0

# 预览（不改任何文件）
npm run release -- 3.5.0 --dry-run

# 只改版本 + 提交 + tag，不发 npm
npm run release -- 3.5.0 --no-publish
```

发布流程：检查工作区干净 → 运行测试 → 同步版本号 → 验证一致性 → git commit + tag → npm publish。

详见 [CONTRIBUTING.md](./CONTRIBUTING.md)。

## 文件结构

```
boss-skill/
├── src/
│   └── bin/
│       └── boss-skill.ts                # CLI TypeScript 源码
├── dist/
│   └── bin/
│       └── boss-skill.js                # CLI 编译产物（npm bin）
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
├── commands/                         # 斜杠命令（/boss、/boss:upgrade）
│   ├── boss.md
│   └── boss-upgrade.md
├── hooks/
│   └── hooks.json                    # Claude Code Plugin hooks（使用 ${CLAUDE_PLUGIN_ROOT}）
├── harness/                          # 流水线编排与插件系统
│   ├── plugin-schema.json
│   ├── plugins/
│   │   └── security-audit/
│   └── pipeline-packs/               # 4 套流水线预设
├── runtime/                          # Canonical runtime surface
│   ├── cli/                          # Runtime CLI 编排命令
│   └── report/                       # 报告生成器
├── references/                       # 按需加载的规范文档
├── templates/                        # 7 个产物模板
├── scripts/
│   ├── release.js                    # 统一发布脚本
│   ├── lib/                          # 共享库（run-with-flags、hook-flags、boss-utils）
│   ├── hooks/                        # 10 个 Node.js Hook 脚本
│   ├── harness/                      # 事件追加、物化、重试等辅助脚本
│   ├── gates/                        # 具体 gate 实现脚本
│   └── report/                       # 报告相关脚本
├── .claude-plugin/
│   ├── plugin.json                   # Claude Code Plugin 清单
│   └── marketplace.json
└── package.json
```

## 设计理念

基于 BMAD（Breakthrough Method of Agile AI-Driven Development）方法论，详见 `references/bmad-methodology.md` 和 `DESIGN.md`。

## 贡献

欢迎贡献！请阅读 [CONTRIBUTING.md](./CONTRIBUTING.md) 了解开发流程、代码规范和提交约定。

## Star History

[![Star History Chart](https://api.star-history.com/svg?repos=echoVic/boss-skill&type=Date)](https://star-history.com/#echoVic/boss-skill&Date)

## License

MIT
