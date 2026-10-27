# boss-skill

[![skills.sh](https://skills.sh/b/echovic/boss-skill)](https://skills.sh/echovic/boss-skill)
[![CodeRabbit Pull Request Reviews](https://img.shields.io/coderabbit/prs/github/echoVic/boss-skill?utm_source=oss&utm_medium=github&utm_campaign=echoVic%2Fboss-skill&labelColor=171717&color=FF570A&link=https%3A%2F%2Fcoderabbit.ai&label=CodeRabbit+Reviews)](https://coderabbit.ai)
[![G-Star Incubation](https://img.shields.io/badge/G--Star-Incubation-C71D23)](https://atomgit.com/echoVic/boss-skill)
[![AtomGit Mirror](https://img.shields.io/badge/AtomGit-Mirror-1F6FEB)](https://atomgit.com/echoVic/boss-skill)
[![Boss trust badge](https://img.shields.io/endpoint?url=https%3A%2F%2Fhol.org%2Fapi%2Fregistry%2Fbadges%2Fplugin%3Fslug%3Dechovic%252Fboss%26metric%3Dtrust%26style%3Dflat)](https://hol.org/registry/plugins/echovic%2Fboss)

**Languages / 语言 / 言語 / 언어 / Idiomas / Langues:** [English](./README.md) · [中文](./README.zh-CN.md) · [日本語](./README.ja.md) · [한국어](./README.ko.md) · [Español](./README.es.md) · [Français](./README.fr.md) · [Português](./README.pt-BR.md)

![boss-skill 宣传图](https://raw.githubusercontent.com/echoVic/boss-skill/main/boss-skill-promo.png)

> 本项目是 AtomGit G-Star 孵化计划的一部分。GitHub 是主仓库；AtomGit 提供自动同步镜像以便国内更快访问。请在 [GitHub](https://github.com/echoVic/boss-skill) 提交 issue 和 PR。
>
> GitHub: <https://github.com/echoVic/boss-skill> · AtomGit 镜像: <https://atomgit.com/echoVic/boss-skill>

**Boss 是面向 Coding Agent 的专家小队工作流。** 它把一个 Coding Agent 组织成结构化研发团队：PM、Architect、UI Designer、Tech Lead、Scrum Master、Frontend、Backend、QA、DevOps。和只靠 prompt 的 Agent 团队不同，Boss 为每个角色强制执行硬性质量契约，产出可回放的产物，并自动串联各环节——从任意环节切入，自动跑完后续流程，除非你主动叫停。

Boss 支持 Claude Code、Codex、OpenClaw、Antigravity 和 Hermes。

## 为什么需要 Boss

只靠 prompt 的编排经常"看起来很像团队"，但很难证明计划真的被执行、测试真的跑过、门禁真的通过。Boss 的核心是证据和硬契约：

- **硬性质量契约**：每个角色都有不可妥协的要求表（例如 PRD 必须包含 Given-When-Then 场景；架构必须对比至少两种方案；QA 必须记录已验证或诚实标注未验证的证据）。契约未通过则阻断下一环节，除非你显式覆盖。
- **产物驱动**：每个环节都把真实文件写入 `.boss/<feature>/`。进度以磁盘上的产物为准，而非 Agent 的口头声明。
- **续跑链**：从任意环节启动（`/boss:pm`、`/boss:dev` ...），Boss 自动跑完所有下游环节直到 `ship` 或你叫停。无需手动交接。
- **工程原则**：小队共享十条原则——验证真实产物、修复根因、构建杠杆、领域建模、边界纪律、可验证单元序列、测试行为、最小化读者负担、结构化经验、自治规则。每个 Agent 在输出中注明所应用的原则。
- **默认 TDD**：开发环节必须先写失败测试、亲眼看到 RED，再写最小代码让它变 GREEN。
- **默认零出网**：不上报遥测、不回连、不做远端 LLM 代理。唯一网络面是 UI 原型阶段可选的、绑定 `127.0.0.1` 的回环预览服务器。详见 [PRIVACY.md](./PRIVACY.md)。
- **确定性 eval**：可以用已捕获 transcript 做评分，不需要真实 LLM。

## 专家小队命令

Boss 不是一个巨大的单体命令。每个 slash command 都是一个入口；默认自动跑完所有下游环节。

| 命令 | 起点 | 自动续跑到 | 适合什么时候用 |
| --- | --- | --- | --- |
| `/boss` | PM | 全流程到 ship | 从想法做到可交付 |
| `/boss:pm` | PM | Architect → ... → Ship | 从需求分析开始 |
| `/boss:architect` | Architect | UI → ... → Ship | 已有需求，需要设计 |
| `/boss:ui` | UI Designer | Review → ... → Ship | 已有架构，需要 UI |
| `/boss:review` | Tech Lead | Tasks → ... → Ship | 需要技术评审 + 实施计划 |
| `/boss:tasks` | Scrum Master | Dev → QA → Ship | 需要任务拆解 |
| `/boss:dev` | Frontend/Backend | QA → Ship | 开始开发 |
| `/boss:qa` | QA | Ship | 需要测试证据 |
| `/boss:ship` | DevOps | 终点 | 只做部署 |

完整链路：

```
pm → architect → ui → review → tasks → dev → qa → ship
```

说"停"、"只做这一步"，或传入 `--stop-after <环节>` 即可停止续跑。

## 5 分钟快速上手

### 1. 安装

Boss 是一个「被安装进 coding agent」的 skill。分发只走 skill 市场：没有 npm 包，也没有全局二进制。

**Claude Code —— 插件市场（推荐）：**

```text
/plugin marketplace add echoVic/boss-skill
/plugin install boss@boss-skill
```

**Codex —— 插件市场：**

```bash
codex plugin marketplace add echoVic/boss-skill
```

然后在插件浏览器（`/plugins`）里安装 **boss**。

**任意 Agent —— 通过 `skills` CLI（[vercel-labs/skills](https://github.com/vercel-labs/skills)，skills.sh）：**

```bash
npx skills add echoVic/boss-skill
```

### 2. 跑一条轻量流水线

最低成本的首次运行是对已有代码做只读评审：

```
/boss:review
```

你会在 `.boss/<feature>/` 下得到 `tech-review.md`（和 `plan.md`），包含风险、发现和严重度。仓库其它文件不会被改动。

想要可验证的测试证据？`/boss:qa` 会跑测试并写入 `qa-report.md`。

### 3. 跑完整流水线

在 Coding Agent 里输入：

```text
/boss 做一个个人本地 Todo 应用 --skip-ui
```

- `--skip-ui` 跳过 UI 设计环节（纯 API/CLI 项目）。
- `--quick` 跳过常规确认提示。

### 4. 查看结果

产物都在 `.boss/<feature>/` 下：

```text
.boss/todo-app/
├── prd.md
├── architecture.md
├── ui-spec.md
├── ui-design.json
├── tech-review.md
├── plan.md
├── tasks.md
├── qa-report.md
└── deploy-report.md
```

每个 Markdown 产物都以 `## 摘要` section 开头，下游 Agent 优先读取结论，需要细节时再读全文。

## 工作流

```text
用户需求
  → 需求澄清（除非 --quick）
  → PM：需求分析 → prd.md
  → Architect：系统设计 → architecture.md
  → UI Designer：UI/UX 规范 → ui-spec.md + ui-design.json（--skip-ui 跳过）
  → Tech Lead：技术评审 + 实施计划 → tech-review.md + plan.md
  → Scrum Master：任务拆解 → tasks.md
  → Frontend / Backend：TDD 实现
  → QA：测试执行、Bug 报告、验证证据 → qa-report.md
  → DevOps：构建、部署、健康检查 → deploy-report.md
```

### 角色与产物

| 角色 | 职责 | 产物 |
| --- | --- | --- |
| PM | 需求穿透、PRD、隐性需求、边界场景 | `prd.md` |
| Architect | 系统架构、技术设计、API | `architecture.md` |
| UI Designer | UI/UX 规范、可渲染设计 JSON、HTML 原型 | `ui-spec.md`、`ui-design.json` |
| Tech Lead | 技术评审、风险评估、实施计划 | `tech-review.md`、`plan.md` |
| Scrum Master | 任务拆解和验收标准 | `tasks.md` |
| Frontend | UI 实现、TDD、前端测试 | 源代码 |
| Backend | API、存储、TDD、后端测试 | 源代码 |
| QA | 测试执行、Bug 报告、验证证据 | `qa-report.md` |
| DevOps | 构建、部署、健康检查 | `deploy-report.md` |

## 质量契约

Boss 的质量保障分两层：

- **每个角色的硬性要求**：每个 Agent 的 prompt 定义了不可妥协的要求表。Agent 在交接前自检；契约未通过则阻断下一环节。
- **质量门禁**：真实执行的命令，判定结果记录在环节产物中。

| 门禁 | 时机 | 检查 |
| --- | --- | --- |
| Gate 0（代码质量） | 开发后、QA 前 | TypeScript/lint 通过、无高危依赖漏洞 |
| Gate 1（测试） | QA 后、部署前 | 单元 + 集成测试通过、覆盖率 ≥ 70%、无 P0/P1 Bug、E2E 测试已编写 |
| Gate 2（性能） | Web 部署前 | Lighthouse ≥ 80、API P99 < 500ms（仅 Web 项目） |

## 什么时候适合用

| 适合 | 不适合 |
| --- | --- |
| 新 feature，需要需求、设计、开发、测试和交付证据 | 一行修复、很小的局部修改 |
| API、全栈、UI、中等规模产品功能 | 单纯读代码或解释实现 |
| 需要 `.boss/<feature>/` 产物留痕 | 已有完整 spec，只想快速 patch |
| 团队希望有可重复门禁和审计轨迹 | 不需要协作或评审证据的小任务 |

经验法则：如果你不需要一个可追踪的 `.boss/` 目录，就不一定要开完整 `/boss` 流水线。可以只用单个角色，或者直接让 Coding Agent 修改。

## 安全与隐私

Boss 是本地优先的，默认不发出任何出站网络请求。唯一网络面是 UI 设计阶段可选的、仅绑定回环地址（`127.0.0.1`）的 HTML 原型服务器。

发布 provenance 位于 `.agents/plugins/provenance.json`。它记录仓库 HTTPS URL、不可变 source commit SHA、publisher 身份，以及 plugin manifests 的 SHA-256 摘要。可用下面命令校验：

```bash
npm run provenance:verify
```

完整数据和网络边界见 [PRIVACY.md](./PRIVACY.md)。

## 流水线产物

```text
.boss/<feature>/
├── prd.md              # PM — 产品需求
├── architecture.md     # Architect — 系统设计
├── ui-spec.md          # UI Designer — UI/UX 规范（--skip-ui 跳过）
├── ui-design.json      # UI Designer — 可渲染设计 JSON
├── tech-review.md      # Tech Lead — 技术评审
├── plan.md             # Tech Lead — 实施计划
├── tasks.md            # Scrum Master — 任务拆解
├── qa-report.md        # QA — 测试证据
└── deploy-report.md    # DevOps — 部署记录
```

## Evals

Boss eval 使用已捕获 fixture 评分，不启动真实 LLM：

```bash
npm run evals
npm run evals:release
```

release eval 包含 release-evidence 和 pipeline-compliance 检查——验证产物记录、避免使用已废弃的 runtime 命令、以及 expert-squad 编排行为。

详见 [test/evals/README.md](./test/evals/README.md)。

## 开发

环境要求：

- Node.js >= 22.18

初始化：

```bash
git clone https://github.com/echoVic/boss-skill.git
cd boss-skill
npm install
npm run typecheck
npm test
```

常用脚本：

```bash
npm run typecheck    # tsc --noEmit
npm test             # vitest（单元 + skill 行为 + evals）
npm run test:skills  # 仅 skill 行为测试
npm run evals        # 确定性 transcript eval
npm run lint         # biome ci
```

## 仓库结构

```text
boss-skill/
├── skill/                      # 安装到 Coding Agent 的 skill bundle（自包含）
│   ├── SKILL.md                # 主编排入口（不变量 + 索引）
│   ├── agents/                 # 角色 prompts（boss-pm、boss-architect、...）
│   ├── commands/               # Slash commands（/boss、/boss:pm、...）
│   ├── references/             # 共享方法论（principles、quality-gate、...）
│   ├── skills/                 # 各领域方法论 skill（pm/、qa/、devops/、...）
│   └── templates/              # 产物模板（.md.template）
├── test/                       # Vitest、skill 行为、eval 测试
├── scripts/                    # release.js、provenance.js
├── docs/                       # 历史 specs、plans、reports
├── examples/                   # 示例项目
├── .claude-plugin/             # Claude Code plugin manifest + marketplace
├── .codex-plugin/              # Codex plugin manifest + marketplace
├── .agents/plugins/            # 仓库级 plugin marketplace + provenance
├── tsconfig.json               # 只做类型检查的配置（noEmit）
└── package.json                # 私有开发工作区（不发布）
```

## 发布

使用发布脚本保持 package metadata、skill manifest、plugin manifest 的版本一致：

```bash
npm run release -- patch
npm run release -- minor
npm run release -- major
npm run release -- 4.1.0
npm run release -- 4.1.0 --dry-run
```

发布脚本会检查工作区干净、运行完整验证链（typecheck、lint、test）、同步所有 manifest 的版本号、验证一致性、创建 commit 和 tag 并推送。发布物就是 git tag：市场直接从仓库读取——没有 npm publish，也没有构建步骤。

详见 [CONTRIBUTING.md](./CONTRIBUTING.md)。

## 设计理念

Boss 受 BMAD（Breakthrough Method of Agile AI-Driven Development）和"write less, higher quality code"理念启发。专家小队模型保持骨架轻量——没有 runtime 状态机、没有事件溯源、没有 hooks——同时保留硬性质量契约和产物驱动的协作。

更多背景见 [DESIGN.md](./DESIGN.md)、`skill/references/bmad-methodology.md` 和 `skill/references/principles.md`。

## Star History

[![Star History Chart](https://api.star-history.com/svg?repos=echoVic/boss-skill&type=Date)](https://star-history.com/#echoVic/boss-skill&Date)

## License

MIT
