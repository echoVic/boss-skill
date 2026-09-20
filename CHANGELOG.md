# Changelog

本项目遵循 [Keep a Changelog](https://keepachangelog.com/zh-CN/1.1.0/) 与 [语义化版本](https://semver.org/lang/zh-CN/)。

发布时由 `npm run release <major|minor|patch>` 统一同步 8 处版本号并打 tag；下方
`[Unreleased]` 汇总的破坏性变更对应一次 `major` 发布（`3.x` → `4.0.0`）。

## [Unreleased]

现代化编排层，使其与事件溯源底座相称：卸掉负债（组织架构式编排残留、文本状态协议、
外挂 LLM、自建 skill 管理器），补齐生产级基础（CI、原子性、诊断、发布纪律）。

### 破坏性变更（Breaking）

- **移除 `boss skills add/list/update/remove` 通用管理器。** boss 是「被安装的 skill」，
  不再充当安装别的 skill 的工具。安装 boss 自身用 `boss install` /
  `npx @blade-ai/boss-skill`，或主流的 `npx skills add echoVic/boss-skill`。
- **移除外挂 LLM knowledge 模块**及 `BOSS_KNOWLEDGE_API_KEY` / `BOSS_KNOWLEDGE_BASE_URL`
  / `BOSS_KNOWLEDGE_MODEL` 环境变量。跨 session 记忆与偏好派生改由确定性的 memory
  模块承担（从事件流投影，可完整重放）。
- **wave 验证命令改为结构化 argv**：红测/绿门禁须写入 `waves.json`（argv 数组），
  不再从 `tasks.md` 的 Markdown 表格读取、不再经 shell 执行；不支持管道、重定向、
  `&&` 串联。此举消除了 clone 恶意仓库即可命令注入的漏洞。

### 新增（Added）

- **CI**：`.github/workflows/ci.yml`，PR/push 触发，Node 20/22 矩阵跑
  typecheck → build → test → evals + provenance verify。此前仓库无任何测试门禁。
- **`boss runtime report-agent-status`**：子代理终态经工具层枚举校验上报，取代
  `[BOSS_STATUS]` 散文块的正则解析。
- **`boss runtime record-user-choice`**：把用户选择写入事件流，驱动确定性偏好聚合。
- **`boss doctor`**：诊断安装位置、hook 注册、事件流完整性、孤儿 lock、版本一致性，
  并报出运行环境边界（Node 版本、平台、`git` 是否可用——WIP checkpoint 依赖它）。
- 安装文档主推 `npx skills add echoVic/boss-skill`（vercel-labs/skills 主流工具）。
- README 新增 Platform Support 一节，显式声明跨平台边界：核心管线无 POSIX-only 假设、
  `git` 与 `bash gate.sh` 为可选并优雅降级。
- **`PRIVACY.md`**：声明 boss 默认零出网——移除 knowledge 外挂后不再有任何出站请求，
  唯一网络面是 opt-in 的 `boss design preview` 回环服务器；并附 `network-boundary`
  测试从源码层守卫该不变量（禁止引入网络客户端、预览服务器只绑 `127.0.0.1`）。
- `CHANGELOG.md`（本文件）。

### 变更（Changed）

- **调度器按写集不重叠的并行安全组派发全部 ready 节点**，不再按 stage 分批——
  兑现 DAG 已表达的跨阶段并行。
- **角色提示词去人格化**：删除不可判定的人格描写，改为可判定的硬性判据表；修正
  Architect §5 API 契约生产端/消费端的不对称。
- `.claude-plugin/plugin.json` 的 `skills` 收敛为单根 `./skill/`，与 `.codex-plugin`
  对齐，使外部 skills CLI 只发现 `boss` 一个、内部方法论随目录整体安装。

### 修复（Fixed）

- **未初始化 feature 的错误提示**：对未 `init-pipeline` 的 feature 运行 `status`/
  `continue`/`gate` 等命令时，此前只抛裸「未找到执行文件」落到 `internal_error`。
  现统一映射为 `pipeline_not_initialized`，带 `boss runtime init-pipeline` /
  `boss doctor` 的恢复指引。
- **schema 与运行时校验漂移**：`WaveVerified` 事件在 `event-schema.json` 声明了
  `waveId/phase/verified` 必填，但运行时 `validateEvent` 落到 `default` 分支完全
  不校验——损坏的 wave 事件会被静默接受。已补上逐字段校验，并新增
  `schema-runtime-bridge` 测试：从 schema 提取每个事件类型的必填字段，逐个抽掉后
  断言运行时必拒，作为长期防漂移守卫。
- **事件流原子性**：追加改用 `O_APPEND` + `fsync`；读取容忍崩溃残留的损坏行
  （跳过并告警）。此前裸 `appendFileSync` + 硬失败会让一次崩溃使整个 feature 不可读。
- **七个 README 与代码、与彼此都不同步**：上一轮把「门禁不可绕过」这句过度承诺从
  `DESIGN.md` 与 `skill/references/` 改掉了，却漏了七个 README——最被人读到的那一面，
  七种语言全都还写着「不可绕过」。同一轮把 Quick Start 提前的重构也只落在英文版，
  其余六个仍让读者先读到「适用与不适用」对照表才看到怎么安装。现七版统一：门禁主张改为
  「判定可核对、执行依赖编排器遵守协议」，Quick Start 一律排在对照表之前，并补上
  `boss doctor`、`boss gate final`（子命令在前）、`boss runtime rebuild-state`、
  错误码清单与产物分层说明。新增 `readme-consistency` 测试把这几条钉死：人工同步七份
  翻译必然漂移，这次就是同一句话漏了六个文件。
- **投影损坏后无路可走**（10 轮实测第 9 轮）：架构主张是「事件是真相源，
  `execution.json` 只是只读投影」，但 38 个 runtime 子命令里没有任何一个能重建它
  （`replay-events` 只读）。投影一旦损坏，事件流完好也没用——每条命令先
  `readExecutionView`，抛出裸 JSON 解析错误，feature 从此不可用。新增
  `boss runtime rebuild-state <feature>` 从事件流重建，并把无法解析 JSON 的错误
  单列为 `state_unreadable`，建议直接指向该命令。
- **暂停在有阶段运行时无效**（第 6 轮）：`finalize` 先按阶段状态推导 `status`，
  只在没有 running/retrying 阶段时才回落到 `paused`。于是在唯一值得暂停的时刻，
  `pause.paused` 记下了 true 而派生的 `status` 仍是 `running`，连带两个守卫一起失效：
  重复 pause 不再被拒、`update-stage running` 的自动恢复也不再触发。现改为显式暂停
  压过运行中推断（全部阶段完成时仍报 `completed`）。
- **阶段重试不重置 agent 的重试预算**（第 2 轮）：编排循环第 8 步规定「Agent 达上限后
  才用 retry-stage」，但 `retry-stage` 只把阶段推回 running，不动 agent 的 `retryCount`，
  升级之后 `retry-agent` 仍报「已达最大重试次数」——恢复阶梯最上面一级是空的。
  现 `StageRetrying` 投影时重置该阶段所有 agent 的预算（其它阶段不受影响）。
- **八条领域条件被报成 `internal_error`**（第 2、3、4、5、9 轮）：重试预算耗尽、
  阶段重试耗尽、非法状态转换、runId 不匹配、反馈循环耗尽、门禁未找到、多余位置参数、
  JSON 无法解析——全部附带同一句无用建议「Re-run with --describe」。现各自单列错误码
  并给出可执行的下一步（例如重试耗尽指向 `retry-stage`，多余位置参数解释本 CLI 用的是
  成对旗标 `--gate-passed` / `--gate-failed` 而非 `--flag <value>`）。
- **流水线跑完后各个面仍各说各话**（同一次实跑的后续发现）：全部阶段完成、
  `nextNodeIds` 为空、workflow 节点为 `completed` 之后，`boss status` 仍打印
  `Ready artifacts: code`、`CHECKPOINT_REQUIRED` 和 `Continue: boss continue`。三处根因：
  ① 「code 是否完成」有两套依据——workflow 节点看 `ArtifactRecorded`，而 `isArtifactDone`
  只看 stage 3 的 agent 状态、完全不看产物是否被记录；编排循环第 7 步明写「记录产物 →
  artifact node 进入 completed」，故记录本身即完成信号，现两条路径都认。
  ② `defaultRequiredChecks` 只看 `stage.id >= 3`，不看流水线是否已完成。
  ③ 已完成的流水线仍回显 `boss continue`，把用户指向一个空操作。
- **`artifact prepare` 回显的模板路径不可用**：一律取 `path.relative(cwd, templatePath)`，
  内置模板会变成一条从用户项目指向 boss 安装位置的穿越路径（实跑见到
  `../boss-sched/skill/templates/prd.md.template`），既打不开也不说明来源。现改为项目模板
  回显项目内相对路径、内置模板只回显模板名，并新增 `templateSource` 字段区分两者。
- **两个调度面给出不同的工作集，编排循环的终止条件因此不可达**（实跑一遍完整流水线
  发现）：`orchestration-loop.md` 规定「调度以 `execution.workflow.nextNodeIds` 为准」，
  `get-ready-artifacts` 只是兼容入口。但只有兼容入口排除了 opt-in 可选产物
  （`strategic-review.md`、`ui-design-variants.json`、`changelog.md`），权威面不排除。
  实跑时兼容入口返回 `["code"]`，`nextNodeIds` 却多出四项；这些节点永远停在 `ready`，
  循环第 13 步「直到 nextNodeIds 为空」永不成立。照文档跑的编排器要么死循环，要么被迫
  为一个后端 API 产出 UI 变体与市场 ROI 分析。现把这份名单下沉到 domain 层由两层共用，
  投影时把未被显式要求的 opt-in 节点标为 `skipped`（真被产出时仍会正常转入 `completed`）。
- **`boss --help` 给出的最终门禁写法是错的**：上一版写「add `final` for the release gate」，
  读者自然敲 `boss gate <feature> final`，而正确写法是 `boss gate final <feature>`。
  已改为单列一行，并加测试钉住「help 广告的每条调用都真的能跑」。
- **产物平铺成一堆同等重要的文件**：一次运行会在 `.boss/<feature>/` 顶层留下 14 个文件
  （7 份 Markdown + 5 份 HTML 伴生 + ui-design.json 等），但它们寿命完全不同：
  prd / architecture / ui-spec 跨迭代维护，tasks / qa-report / deploy-report 跑完即过期，
  `.html` 可随时重建。混在一起时，第二次迭代的人分不清哪些还作数。
  现按生命周期分三层（产品资产 / 本轮记录 / 派生视图）：摘要报告的产物清单按层分组，
  `boss status` 暴露 `artifactLayers`，并在上游产品资产被重做后提示哪些本轮记录已过期。
  **不移动任何文件路径**——产物名写在 50 个文件里（agent 提示词、模板、hook、DAG、文档），
  挪目录的风险远大于收益；参考 GStack 的做法，给执行痕迹的是「过期提示」而非新目录。
- **上手路径处处断线索**（实测走了一遍新用户路径）：`boss --help` 先列 `--json` /
  `--fields` 这些给调用方 agent 用的全局选项，再列 15 个没有任何描述的命令，且完全没提
  这个 CLI 是 skill 的运行时、产品入口是 coding agent 里的 `/boss`；README 全文 423 行，
  第一条可执行命令在第 71 行，在那之前先让读者读到「适用与不适用」对照表；Quick Start 的
  例子是从零建一个 todo app，而多数读者手上是存量项目；`skill/SKILL.md` 的触发词全是
  全流水线口吻，最容易被采用的切片入口只有知道它存在的人才能用上；`boss status` 缺参数
  报 `internal_error`，`boss init`（想开始时的第一直觉）只回一句未知命令。
  现在：help 带上手指引与逐条描述、agent 专用选项后置；README 把 Quick Start 提到第 45 行
  并以存量项目上的 `/boss:review` 作为第一个例子；SKILL.md 补四个切片的触发词；
  用法错误单列 `invalid_usage`；未知命令按意图表与编辑距离给出最接近的真实命令。
- **`/boss:extend` 教用户写的 pack 配置大半不生效**：`skill/references/extending-boss.md`
  列出的九个 `config` 字段里，`agents`、`gates`、`stages`、`agentStages`、`skipFrontend`
  都没有任何读取方——照文档写了自定义 pack，跑起来完全没有效果，也没有任何报错。内置的
  `api-only` pack（"无 UI、无前端"）正好设了 `skipFrontend: true`，而那个开关是空的。
  现在：`agents` 与 `skipFrontend` 通过 `filterAgentsByPack()` 收窄产物的 agent 列表
  （`code` 由前后端共同产出，故按 agent 收窄而非按产物跳过；收窄后无人可产出的产物按跳过
  处理）；`gates` 约束内置门禁的启用集合（插件门禁来自 `.boss/plugins`，不受该列表约束）；
  `stages` 与 `agentStages` 从文档、内置 pack、状态与 schema 中移除——阶段由
  `config.artifactDag` 决定，仍声明它们的 pack 会收到明确告警，而不是被静默忽略。
- **反馈循环上限是终身的**：`feedbackLoops.currentRound` 只增不减、全仓没有任何重置路径，
  而 `maxRounds` 是 2。于是一个 feature 一生只能接受两次修订请求，第三次
  `boss runtime record-feedback` 直接抛错——feature 活得越久，越早失去记录反馈的能力，
  与长期迭代的用法正面冲突。现按产物分别计数（`feedbackLoops.rounds`）：防死循环的原意
  保留（同一产物仍最多返工 `maxRounds` 轮），不同产物互不影响。`currentRound` 作为总轮次
  保留，报表与既有消费方不受影响。旧 run 没有 `rounds` 字段，从 0 起算。
- **门禁失败却把阶段标记为完成，此前无人反对**：阶段推进的唯一前置校验是状态机表，
  `running:completed` 无条件合法；门禁结果经同一次 `updateStage` 调用的可选参数在阶段完成
  事件之后追加。于是一次调用可以同时写下「门禁未通过」与「阶段已完成」，而
  `qualityGates[].passed` 与 `stages[].gateResults` 的全部读取方都只是报表渲染与指标计算，
  没有一处在推进阶段前读它们。现新增 `findFailedGates()`：以每个门禁的最新一次评估为准，
  找出「阶段已完成但门禁未通过」的矛盾，`boss gate final` 增加 `no-failed-gates` 检查，
  `boss doctor` 对该 feature 报 error。写入仍然允许（不改动行为契约），但矛盾不再隐形。
- **文档把门禁说成能阻止阶段推进**：`DESIGN.md`、`skill/references/quality-gate.md` 称
  「通过才允许进入下一阶段」；`skill/references/no-cli-fallback.md` 更把安装 CLI 描述为
  让门禁从「协议约束」升级为「CLI 强制」「不可绕过门禁」。运行时从未有过该前置条件。
  四处措辞已改为与代码一致：CLI 提供的是可验证的判定与记录，门禁的执行依赖编排器遵守协议。
- **返工与人工介入从不呈现**：`RevisionRequested` 与 `UserChoiceRecorded` 被完整记进事件流与
  `execution.json`，却既不参与判断，也不出现在任何面向人的输出里。摘要报告现新增「返工记录」
  与「人工介入」两节：谁要求谁返工、因为什么、人在哪几步介入过。对一份以可审计性为卖点的
  产物，这比任何聚合指标都更能说明一次运行到底发生了什么。
- **事件创建的阶段恒为空名**：初始化只给阶段 1-4 命名，任何由事件首次创建的阶段（自定义
  pack 的阶段 0 或 5+、init 之前到达的阶段事件）拿到的是空字符串，并一路出现在报表里。
  现按阶段号回退到与初始化一致的默认名，未知阶段为 `stage-N`。
- **类型没有如实描述落盘内容**：`parallelGroup` 与 `description` 经 spread 落进
  `execution.json`，但 `WorkflowExecutionNode` 没有声明它们，`satisfies` 也不做多余属性检查。
  从类型出发的审计会因此漏掉真实存在的字段。现已补上声明，并加测试比对落盘键与类型声明。
- **`packHash` 被记录、被文档描述，却没有任何一处读它做判断**：pipeline pack 的指纹在初始化
  时写进 `execution.parameters.packHash`，README 也把它与 `workflowHash`、artifact DAG hash
  并列。但 artifact DAG 有 `isArtifactDagStale` 守卫，pack 没有——改掉 pack 的 stages /
  agents / gates 之后恢复，仍会复用按旧流水线产出的 agent 产物，且无从察觉。现补上与 DAG
  对称的 `isPipelinePackStale`，结果进入 agent 复用判定（`pipeline-pack-stale`）。pack 指纹
  的计算收敛到 `hashPipelinePack()`，避免编译与校验两处各自内联字段列表而漏掉某个字段。
- **第二份 `stableStringify` 仍有同一个 undefined 缺陷**：修 `workflowHash` 时只改了
  `workflow.ts` 里的那份，`pipeline-dag.ts` 里支撑 `hashRuntimeValue`（agent 复用指纹、
  `runId`）的那份没动。现已合并为唯一实现，`workflow.ts` 直接复用。副作用同上：升级后
  首次运行可能不复用上一轮的 agent 产物。
- **恢复时不校验 workflow-plan.json**：计划在初始化时被编译、落盘，哈希记进
  `execution.parameters.workflowHash`，但 `resumeWorkflow()` 只是把这个哈希透传给调度器，
  从不复算比对。于是被改过或损坏的计划会被当成原计划继续调度——节点集合、依赖边、门禁
  都可能已经不同，而恢复结果看起来完全正常。现在恢复前复算并强制比对，不一致即拒绝恢复，
  错误带上计划路径与两个哈希，CLI 侧单列 `workflow_plan_mismatch` 错误码与处置建议；
  旧版本创建、未记录哈希的 run 仍然放行，不会被锁死。
- **落盘的 workflowHash 并不标识落盘内容**：`stableStringify` 会把值为 `undefined` 的键
  计入哈希，而写文件用的 `JSON.stringify` 会丢弃这些键。只要 artifact DAG 缺少可选字段
  （如 `description`），「内存中计划的哈希」就不等于「文件内容的哈希」，这个哈希也就无法
  用来证明计划没被改过。现已与 JSON 语义对齐（对象丢弃 undefined 键、数组中的 undefined
  转为 null）。注意：这会改变含缺省字段的计划哈希与 agent `inputDigest`，升级后首次运行
  可能不复用上一轮的 agent 产物，重跑一次即可恢复。
- **崩溃残留会吞掉紧随其后的事件（P0）**：进程在追加中途被杀会留下一条无结尾换行的
  半行，下一次追加直接贴上去，两者粘成一条损坏行——那条新事件当场丢失，再追加一条
  后该损坏行不再是末行，整个 `events.jsonl` 便永久不可读。现在追加前检查末字节，
  必要时把封口换行**并入同一次 write**（单次 write 是 `O_APPEND` 下唯一的原子单位）：
  残留被隔离成独立一行，原样保留，绝不删除。
  相应地，读取端改为跳过**任意位置**的损坏行并通过 `corruptLines` 上报（带行号），
  不再对「非末行损坏」抛错——封口后的残留正落在中间，抛错等于把普通崩溃变成事故；
  事件流没有完整性校验链，改动任意一条合法 JSON 本就无从察觉，抛错拦不住真正的篡改。
  损坏行由 `boss doctor` 报 warn、状态物化时写 stderr 告警呈现。
  同时把 `inspect` / memory / DAG / 工件版本号等自行 `JSON.parse` 每行的读取路径
  统一改走容错读取，并让工件事件的 id 计算只数可解析记录，避免残留行造成 id 撞车。
- **`pre-tool-write` hook 的 artifact DAG 死路径**：此前查不存在的 `harness/`
  目录，导致 ready 逃生门永久失效、误拦合法写入；改为与 CLI 一致的解析顺序。
- **`preferenceId` 对全 CJK 值的 ID 碰撞**：改为按码点编码非 ASCII 字符，不同中文
  选择不再塌缩为同一 id、被误判为重复确认。
- **长期缺失的测试 fixture**：`.gitignore` 的 `.boss/` 吞掉了 eval fixture 的
  workspace、plugin-gate 场景缺失 gate fixture，导致干净检出上 6 个测试必失败；
  已补齐，全量测试首次零失败。
