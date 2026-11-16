# boss-skill

[![skills.sh](https://skills.sh/b/echovic/boss-skill)](https://skills.sh/echovic/boss-skill)
[![G-Star Incubation](https://img.shields.io/badge/G--Star-Incubation-C71D23)](https://atomgit.com/echoVic/boss-skill)
[![License: MIT](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)

**Languages / 语言:** [English](./README.md) · 中文 · [日本語](./README.ja.md) · [한국어](./README.ko.md) · [Español](./README.es.md) · [Français](./README.fr.md) · [Português](./README.pt-BR.md)

![boss-skill promo](https://raw.githubusercontent.com/echoVic/boss-skill/main/boss-skill-promo.png)

> 本项目属于 AtomGit G-Star 孵化计划。GitHub 是主仓库，AtomGit 是自动同步的镜像；Issue 和 PR 请在 [GitHub](https://github.com/echoVic/boss-skill) 提交。

**Boss 是给编码 Agent 用的专家小队工作流。** 它把一只编码 Agent 变成一支结构化的工程团队：PM、架构师、UI 设计、技术负责人、Scrum Master、前端、后端、QA 和 DevOps。与只靠提示词的 Agent 团队不同，Boss 为每个角色加上硬性质量契约，产出可回放的产物，并自动串联各阶段——从任意阶段开始，它会把剩下的跑完，直到你说停。

Boss 支持 Claude Code、Codex、OpenClaw、Antigravity、Hermes 和 DeepSeek Harness。

## DeepSeek Harness

Boss 也提供 DeepSeek Harness bundle：[`dsh-boss-mode`](https://www.npmjs.com/package/dsh-boss-mode)，带一个可选的 **Boss Expert Squad** 预设，以及读取实时 Agent Teams 成员和任务的右侧栏。

```bash
dsh plugin --profile desktop add dsh-boss-mode
```

重启 DeepSeek Harness，新建会话，在模式里选 **Boss Expert Squad**。

## 为什么需要 Boss

- **硬性质量契约**：每个角色都有一张不可协商的要求表（PRD 必须有 Given-When-Then 场景，架构至少比较两个方案，QA 必须记录已验证或如实标注未验证的证据）。契约不通过就挡住下一阶段，除非你显式放行。
- **产物驱动**：每个阶段都在 `.boss/<feature>/` 下写真实文件；进度看磁盘上的产物，不看 Agent 自己怎么说。
- **续跑链**：从任意阶段开始，Boss 自动跑完所有下游阶段，直到 `ship`。
- **默认 TDD**：开发阶段先写一个失败的测试，看它变 RED，再用最少的代码让它变 GREEN。
- **本地优先**：没有遥测，也没有远程代理；唯一的网络面是 UI 阶段可选的 `127.0.0.1` 回环预览服务器。

## 专家小队命令

每个斜杠命令都是入口，默认自动跑完下游阶段：

| 命令 | 起点 | 跑到 |
| --- | --- | --- |
| `/boss` | PM | 完整链路 → ship |
| `/boss:pm` | PM | 架构 → … → Ship |
| `/boss:architect` | 架构师 | UI → … → Ship |
| `/boss:ui` | UI 设计 | 评审 → … → Ship |
| `/boss:review` | 技术负责人 | 任务 → … → Ship |
| `/boss:tasks` | Scrum Master | 开发 → QA → Ship |
| `/boss:dev` | 前端 / 后端 | QA → Ship |
| `/boss:qa` | QA | Ship |
| `/boss:ship` | DevOps | 结束链路 |

完整链路是 `pm → architect → ui → review → tasks → dev → qa → ship`。说「停」「只做这一步」，或传 `--stop-after <stage>` 可以中断。

## 快速上手

把 Boss 装进你的编码 Agent——技能通过各市场的插件分发，DeepSeek Harness 的 bundle 单独发布在 npm：

```text
# Claude Code
/plugin marketplace add echoVic/boss-skill
/plugin install boss@boss-skill

# Codex
codex plugin marketplace add echoVic/boss-skill   # 然后在 /plugins 里安装 boss

# 任意 Agent，用 skills CLI
npx skills add echoVic/boss-skill

# DeepSeek Harness
dsh plugin --profile desktop add dsh-boss-mode
```

最低成本的一次尝试是对现有代码做只读评审：`/boss:review` 只写 `tech-review.md` 和 `plan.md`，不碰仓库其他内容。要跑完整流水线：

```text
/boss Build a local personal todo app --skip-ui
```

`--skip-ui` 给纯 API / CLI 项目跳过 UI 设计，`--quick` 跳过例行澄清。

产物在 `.boss/<feature>/` 下：`prd.md`、`architecture.md`、`ui-spec.md`、`ui-design.json`、`tech-review.md`、`plan.md`、`tasks.md`、`qa-report.md` 和 `deploy-report.md`。每份都以摘要开头，方便下游 Agent 先读结论。

## 工作流

```text
需求 → 澄清（除非 --quick）
  → PM：prd.md
  → 架构师：architecture.md
  → UI：ui-spec.md + ui-design.json（--skip-ui 跳过）
  → 技术负责人：tech-review.md + plan.md
  → Scrum Master：tasks.md
  → 前端 / 后端：TDD 实现
  → QA：qa-report.md
  → DevOps：deploy-report.md
```

## 质量闸门

除各角色的契约外，每个闸门都由真实命令判定，结果记进该阶段的产物：

| 闸门 | 阶段 | 检查 |
| --- | --- | --- |
| 0（代码质量） | 开发后、QA 前 | 类型检查和 lint 通过，没有高危依赖漏洞 |
| 1（测试） | QA 后、部署前 | 单元和集成测试通过，覆盖率 ≥ 70%，没有 P0/P1，E2E 已写 |
| 2（性能） | Web 部署前 | Lighthouse ≥ 80，API P99 < 500 ms（仅 Web 项目） |

如果不需要可追溯的 `.boss/` 目录，大概也不需要整条流水线，用单个角色即可。

## 安全与隐私

Boss 本地优先，默认不向外发请求。发布来源记录在 `.agents/plugins/provenance.json`，钉住仓库 URL、源码提交、发布者和清单摘要，用 `npm run provenance:verify` 校验。完整的数据和网络边界见 [PRIVACY.md](./PRIVACY.md)。

## Evals

录下来的对话记录不调用真实 LLM 就能评分：

```bash
npm run evals
npm run evals:release   # 额外检查发布证据和流水线合规
```

## 开发

需要 Node.js ≥ 22.18。

```bash
git clone https://github.com/echoVic/boss-skill.git
cd boss-skill
npm install
npm run typecheck
npm test
```

其他常用脚本：`npm run test:skills`（只跑技能行为）、`npm run evals`、`npm run lint`（Biome）。发布用 `npm run release -- patch|minor|major|<版本>`，脚本会检查工作区、跑类型检查、lint 和测试，然后同步版本、提交、打标签并推送。约定见 [CONTRIBUTING.md](./CONTRIBUTING.md) 和 [docs/dsh-release.md](./docs/dsh-release.md)。

## 设计

Boss 受 BMAD（Breakthrough Method of Agile AI-Driven Development）和「写更少、质量更高的代码」启发。专家小队模型让 harness 保持精简——没有运行时状态机、事件溯源或 hooks——同时保留硬性质量契约和产物驱动的协作。详见 [DESIGN.md](./DESIGN.md) 和 `skill/references/principles.md`。

## 许可

[MIT](LICENSE)
