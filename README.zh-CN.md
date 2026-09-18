# boss-skill

[![npm version](https://img.shields.io/npm/v/@blade-ai/boss-skill)](https://www.npmjs.com/package/@blade-ai/boss-skill)
[![CodeRabbit Pull Request Reviews](https://img.shields.io/coderabbit/prs/github/echoVic/boss-skill?utm_source=oss&utm_medium=github&utm_campaign=echoVic%2Fboss-skill&labelColor=171717&color=FF570A&link=https%3A%2F%2Fcoderabbit.ai&label=CodeRabbit+Reviews)](https://coderabbit.ai)
[![Boss trust badge](https://img.shields.io/endpoint?url=https%3A%2F%2Fhol.org%2Fapi%2Fregistry%2Fbadges%2Fplugin%3Fslug%3Dechovic%252Fboss%26metric%3Dtrust%26style%3Dflat)](https://hol.org/registry/plugins/echovic%2Fboss)

**Languages / 语言 / 言語 / 언어 / Idiomas / Langues:** [English](./README.md) · [中文](./README.zh-CN.md) · [日本語](./README.ja.md) · [한국어](./README.ko.md) · [Español](./README.es.md) · [Français](./README.fr.md) · [Português](./README.pt-BR.md)

![boss-skill 宣传图](https://raw.githubusercontent.com/echoVic/boss-skill/main/boss-skill-promo.png)

**Boss 是面向 Coding Agent 的可审计 Agent 团队工作流。** 它把一个 Coding Agent 组织成结构化研发团队：PM、Architect、UI Designer、Tech Lead、Scrum Master、Frontend、Backend、QA、DevOps。和只靠 prompt 的 Agent 团队不同，Boss 提供 runtime 状态、追加式事件流、质量门禁、确定性 eval、hooks，以及可回放的产物目录。

Boss 支持 Claude Code、Codex、OpenClaw、Antigravity 和 Hermes。

## 为什么需要 Boss

只靠 prompt 的编排经常“看起来很像团队”，但很难证明计划真的被执行、测试真的跑过、门禁真的通过、状态不是 Agent 自己编出来的。Boss 的核心是证据：

- **事件溯源 runtime**：流水线状态追加到 `.boss/<feature>/.meta/events.jsonl`，再投影成只读执行状态。
- **不可绕过门禁**：QA、部署、最终检查都作为 runtime 阶段建模，不只是口头约束。
- **可回放产物**：PRD、架构、任务、QA、部署报告和总结都落在 `.boss/<feature>/`。
- **确定性 eval**：可以用已捕获 transcript 做评分，不需要真实 LLM。
- **Agent 友好的 CLI**：支持 JSON 输出、`--describe`、dry run、字段裁剪和结构化错误。

## 可以只用一个角色，也可以跑完整团队

Boss 不是一个巨大的单体命令。你可以在已有项目里只调用一个角色，也可以从想法一路跑到交付。

| 命令 | 做什么 | 适合什么时候用 |
| --- | --- | --- |
| `/boss` | 完整 4 阶段流水线 | 从想法做到可交付 |
| `/boss:plan` | PM + Architect 规划 | 先要 PRD 和架构，再决定是否实现 |
| `/boss:review` | Tech Lead 评审 | 只读审查代码、PR 或设计 |
| `/boss:qa` | QA + 门禁 | 需要可验证测试证据 |
| `/boss:ship` | DevOps 构建与部署检查 | 准备发布，需要交付记录 |
| `/boss:extend` | 自定义 Agent、Pack 或 Gate | 为自己的团队扩展 Boss |
| `/boss:upgrade` | 升级 Boss Skill 并重新安装 hooks | 需要最新 npm 包和 hook 配置 |

## 什么时候适合用

| 适合 | 不适合 |
| --- | --- |
| 新 feature，需要需求、设计、开发、测试和交付证据 | 一行修复、很小的局部修改 |
| API、全栈、UI、中等规模产品功能 | 单纯读代码或解释实现 |
| 需要 `.boss/<feature>/` 产物留痕 | 已有完整 spec，只想快速 patch |
| 团队希望有可重复门禁和审计轨迹 | 不需要协作或评审证据的小任务 |

经验法则：如果你不需要一个可追踪的 `.boss/` 目录，就不一定要开完整 `/boss` 流水线。可以只用单个角色，或者直接让 Coding Agent 修改。

## 没有 CLI 也能用

Boss 会在运行时检测 `boss` CLI。没有 CLI 时，工作流可以降级成 `.boss/<feature>/` 下的 Markdown 产物，而不是事件流。CLI 是“可审计能力升级”：事件溯源、可回放恢复、确定性 eval、runtime 门禁和结构化诊断都依赖它。

Boss 不等于“安装后 100% 自动交付”。它提供 runtime 工作流和证据门禁；当前 Coding Agent 仍然需要遵守 Boss 协议。

## 5 分钟快速上手

### 1. 安装

Boss 是一个「被安装进 coding agent」的 skill，而不是用来安装其它 skill 的工具。

**推荐 —— 通过 `skills` CLI（[vercel-labs/skills](https://github.com/vercel-labs/skills)，skills.sh）：**

```bash
npx skills add echoVic/boss-skill
```

这是安装 skill 的标准、跨 agent 的主流方式：它从仓库发现 `boss`，交互式询问目标 Agent / 安装范围（项目 vs 全局）/ 安装方式，并生成可提交的 `skills-lock.json`。Boss 只暴露一个 skill 根，所以选择列表只出现 `boss` 一项——其内部方法论随它一起安装。

**备选 —— Boss 自带的多宿主安装器**（自动检测 Claude Code、Codex、OpenClaw、Antigravity、Hermes 并全部安装，同时合并 Codex hooks）：

```bash
# 一次性运行，无需全局安装
npx @blade-ai/boss-skill

# 或全局安装后运行自安装向导
npm install -g @blade-ai/boss-skill
boss-skill
```

Claude Code plugin 模式：

```bash
claude --plugin-dir "$(boss-skill path)"
```

### 2. 跑一条轻量流水线

在 Coding Agent 里输入：

```text
/boss 做一个个人本地 Todo 应用 --roles core --skip-deploy
```

- `--roles core` 只启用 PM、Architect、Dev、QA。
- `--skip-deploy` 跑到开发与测试证据后停止，不做部署。

### 3. 查看结果

```bash
boss status todo-app --json
boss runtime inspect-pipeline todo-app
```

预期产物结构：

```text
.boss/todo-app/
├── design-brief.md
├── prd.md
├── architecture.md
├── tasks.md
├── qa-report.md
└── .meta/
    ├── events.jsonl
    ├── execution.json
    └── workflow-plan.json
```

## 安装细节

```bash
npm install -g @blade-ai/boss-skill
boss-skill install
```

常用安装命令：

```bash
boss-skill install --dry-run
boss-skill uninstall
boss-skill path
boss-skill --version
```

自动检测目标：

| Agent | 检测条件 | 安装方式 |
| --- | --- | --- |
| OpenClaw | `~/.openclaw/` | 复制到 `~/.openclaw/skills/boss/` 并注入 metadata |
| Codex | `~/.codex/` | 复制到 `~/.codex/skills/boss/`、注入 metadata、合并 hooks |
| Antigravity | `~/.gemini/antigravity/` | 复制到 Antigravity skills 目录并注入 metadata |
| Hermes | `~/.hermes/` | 复制到 `~/.hermes/skills/boss/` 并注入 metadata |
| Claude Code | 始终可用 | 通过 `--plugin-dir` 使用 Plugin 模式 |

## 平台支持

Boss 面向 Node.js `>=20`，支持 Linux、macOS 和 Windows。CLI 只通过 `spawnSync` 加显式参数数组调用外部命令（从不使用 `shell: true`），并在 Windows 上把 `npm`/`npx` 解析为对应的 `.cmd` 变体，因此核心流水线没有任何 POSIX-only 假设。

有两项能力依赖可选外部工具，缺失时会优雅降级：

- **WIP checkpoint**（stash/commit/branch）需要 `git` 和 git working tree。在仓库之外、或 `PATH` 上没有 `git` 时，checkpoint 会被静默跳过——流水线不受影响。
- **遗留的手写 `gate.sh` 插件**通过 `bash` 执行。在 Windows 上如果 `PATH` 中没有 bash，这些插件将无法启动；可移植插件建议使用跨平台的 Node gate 入口（`gate.js` / `gate.mjs`）。

运行 `boss doctor` 可以查看解析后的 runtime 环境（Node 版本、平台、`git` 是否可用），以及安装和事件流健康状况。

## 使用命令

常见 slash command：

```text
/boss 做一个 Todo 应用
/boss 给现有项目加用户认证 --skip-ui
/boss 快速搭建 API 服务 --skip-deploy --quick
/boss 继续上次中断的任务 --continue-from 3
/boss 轻量模式 --roles core --hitl-level off
/boss:upgrade
```

常用参数：

| 参数 | 含义 |
| --- | --- |
| `--roles <preset>` | `full` 为 9 个角色完整流水线，`core` 为 PM/Architect/Dev/QA |
| `--skip-ui` | 跳过 UI 设计 |
| `--skip-deploy` | 跳过部署 |
| `--quick` | 跳过确认节点和需求澄清 |
| `--template` | 初始化 `.boss/templates/` 并暂停 |
| `--continue-from <1-4>` | 从指定流水线阶段继续 |
| `--hitl-level <level>` | 人机协作模式：`auto`、`interactive`、`off` |

Boss CLI 常用命令：

```bash
boss --help
boss status FEATURE
boss continue FEATURE
boss gate FEATURE
boss qa attack FEATURE
boss project init FEATURE
boss design preview FEATURE
boss packs detect
boss runtime inspect-pipeline FEATURE
boss runtime generate-summary FEATURE
```

面向 Agent 的 `boss` 命令在适用场景下使用这些通用参数（where applicable）；可用 `--describe` 查看单个命令的精确 JSON schema：

- `--json`：结构化输出；non-TTY stdout defaults to JSON
- `--describe`：JSON command schema
- `--dry-run`：对写入或高风险操作输出 structured action plan
- `--json-input=<json|->`：JSON input payload
- `--fields=<a,b>` 和 `--limit=<n>`：限制输出字段和数量
- `--yes`：仅用于高风险 non-interactive 命令的额外确认

Structured errors 会写到 stderr，格式为 `{"error":{...}}`，包含 `code`、`message`、`input`、`retryable` 和 `suggestion`。

## 工作流

Boss 使用 4 阶段工作流：

```text
用户需求
  -> 需求澄清
  -> 阶段 1：PM、Architect、UI Designer
  -> 阶段 2：Tech Lead、Scrum Master
  -> 阶段 3：Frontend、Backend、QA、门禁
  -> 阶段 4：DevOps、部署检查、总结
```

完整角色：

| 角色 | 职责 |
| --- | --- |
| PM | 需求穿透、PRD、隐性需求、边界场景 |
| Architect | 系统架构、技术设计、API |
| UI Designer | UI/UX 规范和可渲染设计 JSON |
| Tech Lead | 技术评审、风险评估 |
| Scrum Master | 任务拆解和验收标准 |
| Frontend | UI 实现和前端测试 |
| Backend | API、存储、后端测试 |
| QA | 测试执行、Bug 报告、验证证据 |
| DevOps | 构建、部署、健康检查 |

## Runtime 与质量门禁

Boss 的质量保障分两层：

- **硬约束**：由代码和 CI 验证，包括 runtime 事件、受保护的 `execution.json`、hooks、安装矩阵测试、harness 场景和 Vitest 覆盖。
- **Agent 协议约束**：由 skill bundle 引导，包括 DAG 派发、渐进式读取 reference、测试证据和门禁纪律。

内置门禁：

| 门禁 | 时机 | 检查 |
| --- | --- | --- |
| Gate 0 | 开发后、QA 前 | TypeScript、lint、基础编译检查 |
| Gate 1 | QA 后、部署前 | 测试证据、无 P0/P1 Bug、E2E 期望 |
| Gate 2 | Web 部署前 | 适用时检查 Lighthouse 和 API 延迟目标 |

Hook 环境变量：

| 变量 | 值 |
| --- | --- |
| `BOSS_HOOK_PROFILE` | `minimal`、`standard`、`strict` |
| `BOSS_DISABLED_HOOKS` | 逗号分隔的 hook ID |

Runtime 状态由 `.boss/<feature>/.meta/workflow-plan.json` 和 `.boss/<feature>/.meta/execution.json` 支撑。Workflow 定义会记录 `workflowHash`、`packHash` 和 artifact DAG hashes。恢复执行使用 `boss runtime resume <feature> --from-run <run-id>` 重新加载 plan、比较 node inputs，并物化 `execution.workflow.nextNodeIds` 作为下一批可调度节点。`GateEvaluated` / `WaveVerified` 事件会在门禁和 evidence wave 完成时更新 workflow node 状态。

## 安全敏感面

Boss 会尽量保持发布用 plugin manifest 精简：只声明 bundled skills；没有实际 companion 文件时，不声明 MCP server、app manifest 或 assets。Codex hooks 由 `boss-skill install` 安装流程处理，不放在 marketplace manifest 里。

npm 包会排除本地开发用 Agent 配置，例如 `.claude/settings.json` 和 `.claude/settings.local.json`。可发布的 plugin metadata 只放在 `.claude-plugin/`、`.codex-plugin/` 和 `.agents/plugins/marketplace.json`。

发布 provenance 位于 `.agents/plugins/provenance.json`。它记录仓库 HTTPS URL、不可变 source commit SHA、publisher 身份，以及 plugin manifests 和安全敏感组件的 SHA-256 摘要。可用下面命令校验：

```bash
npm run provenance:verify
```

Publisher verification 属于外部平台操作，不在包内完成。HOL registry 可用仓库 owner 的 GitHub 账号在 `https://hol.org/guard/plugins` 认领插件。公开 trust card 地址是 `https://hol.org/registry/plugins/echovic%2Fboss/embed`。

发布或安装前应重点关注这些敏感行为：

- `boss-skill install` 可能写入 Agent 配置目录，例如 `~/.codex/skills/boss/`，并把 Boss 管理的 hook 条目合并到 `~/.codex/hooks.json`。
- Hook 条目会执行 `boss hooks run ...`，再调度 `scripts/hooks/` 下的脚本。
- `.boss/plugins/<name>/plugin.json` 下的 runtime 插件可以注册 gate 或 reporter hooks；启用项目前应审查本地插件。
- 在敏感环境里，可用 `BOSS_HOOK_PROFILE=minimal` 或 `BOSS_DISABLED_HOOKS=<ids>` 降低 hook 行为。

## 流水线产物

```text
.boss/<feature>/
├── design-brief.md
├── prd.md
├── architecture.md
├── ui-spec.md
├── ui-design.json
├── tech-review.md
├── tasks.md
├── qa-report.md
├── deploy-report.md
├── summary-report.md
└── .meta/
    ├── events.jsonl
    ├── execution.json
    └── workflow-plan.json
```

在交互环境中可以预览生成的 UI 设计：

```bash
boss design preview <feature>
```

## Evals

Boss eval 使用已捕获 fixture 评分，不启动真实 LLM：

```bash
npm run evals
npm run evals:release
```

release eval 包含 release-evidence 和 pipeline-compliance 检查。它会验证 runtime command 使用、artifact 记录、避免直接修改 `execution.json`，以及 workflow 调度字段。

详见 [test/evals/README.md](./test/evals/README.md)。

## 开发

环境要求：

- Node.js >= 20
- `jq`，供 shell 测试辅助脚本使用

初始化：

```bash
git clone https://github.com/echoVic/boss-skill.git
cd boss-skill
npm install
npm run build
npm run typecheck
npm test
```

常用脚本：

```bash
npm run build
npm run typecheck
npm test
npm run test:skills
npm run test:harness
npm run test:install-matrix
npm run evals
```

## 仓库结构

```text
boss-skill/
├── packages/boss-cli/          # TypeScript CLI 和 runtime
├── skill/                      # 安装到 Coding Agent 的 skill bundle
├── scripts/hooks/              # Node.js hook 脚本
├── scripts/lib/                # Hook 辅助函数
├── test/                       # Vitest、harness、eval、hook、install 测试
├── docs/superpowers/           # 历史 specs、plans、reports
├── examples/                   # 示例项目
├── .claude-plugin/             # Claude Code plugin manifest
├── .codex-plugin/              # Codex plugin manifest
└── package.json
```

关键源码位置：

- `packages/boss-cli/src/` 是 CLI 和 runtime 的 TypeScript 源码。
- `packages/boss-cli/dist/` 是发布到 npm bin 的生成产物，不要手工修改。
- `packages/boss-cli/assets/` 保存内置 DAG、pipeline packs、plugin schema 和插件。
- `skill/SKILL.md` 是面向 Agent 的主编排入口。
- `skill/agents/` 保存角色 prompts。
- `skill/commands/` 保存 slash commands。
- `skill/templates/` 保存产物模板。

## 发布

使用发布脚本保持 package metadata、skill manifest、plugin manifest 的版本一致：

```bash
npm run release -- patch
npm run release -- minor
npm run release -- major
npm run release -- 3.11.0
npm run release -- 3.11.0 --dry-run
npm run release -- 3.11.0 --no-publish
```

发布脚本会检查工作区干净、运行测试、同步版本、验证一致性、创建 commit 和 tag；除非使用 `--no-publish`，否则会发布到 npm。

详见 [CONTRIBUTING.md](./CONTRIBUTING.md)。

## 设计理念

Boss 受 BMAD（Breakthrough Method of Agile AI-Driven Development）启发，并把它落成面向 Agent 软件工程的可审计 runtime。

更多背景见 [DESIGN.md](./DESIGN.md) 和 `skill/references/bmad-methodology.md`。

## Star History

[![Star History Chart](https://api.star-history.com/svg?repos=echoVic/boss-skill&type=Date)](https://star-history.com/#echoVic/boss-skill&Date)

## License

MIT
