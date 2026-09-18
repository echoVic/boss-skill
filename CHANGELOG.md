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
- **事件流原子性**：追加改用 `O_APPEND` + `fsync`；读取容忍崩溃残留的损坏尾行
  （跳过并告警），中间行损坏仍按篡改拒绝。此前裸 `appendFileSync` + 硬失败会让
  一次崩溃使整个 feature 不可读。
- **`pre-tool-write` hook 的 artifact DAG 死路径**：此前查不存在的 `harness/`
  目录，导致 ready 逃生门永久失效、误拦合法写入；改为与 CLI 一致的解析顺序。
- **`preferenceId` 对全 CJK 值的 ID 碰撞**：改为按码点编码非 ASCII 字符，不同中文
  选择不再塌缩为同一 id、被误判为重复确认。
- **长期缺失的测试 fixture**：`.gitignore` 的 `.boss/` 吞掉了 eval fixture 的
  workspace、plugin-gate 场景缺失 gate fixture，导致干净检出上 6 个测试必失败；
  已补齐，全量测试首次零失败。
