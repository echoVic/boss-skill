# Boss Orchestration Loop

本文件保存完整 Boss DAG 执行循环。`SKILL.md` 只保留入口和路由；进入实际流水线编排时读取本文件。

## 触发后第一步

### Step -1: 模板初始化

若用户传入 `--template`：
- 调用 `boss project init <feature-name> --template`。
- 确认 `.boss/templates/` 已创建，并包含默认模板副本。
- 提示用户先修改模板，再重新运行 `/boss ...`。
- 本次执行到此结束，不进入 DAG 执行循环。

### Step 0a: Feature Slug 归一化

- 判断输入是否是可执行任务：用户输入必须表达一个要构建、修改、迁移、修复或交付的目标。
- 约束类输入，例如“不要用原生的 html 组件，我们引入了 shadcn”，不是新 feature；不要创建 `.boss/<feature>/`，应询问要应用到哪个已有或新 feature。
- 若用户显式提供合法 slug，直接使用。
- 若用户只提供自然语言需求，归一化为简短英文 kebab-case slug。
- 归一化后的 slug 必须符合 `boss project init` 的格式校验；不确定时用一句话向用户确认。

### Step 0: 需求澄清

除非 `--quick`，先判断需求是否包含“做什么 + 给谁用 + 核心场景”：
- 三者都有：进入初始化。
- 缺任何一项：读取 `skills/brainstorming/SKILL.md`，以 Boss 身份执行需求澄清；已有项目先执行其中的“项目环境感知”步骤。一次一个问题，优先给选项，只问业务问题。

澄清完成后：
- 写入 `.boss/<feature>/design-brief.md`。
- 若不是 `--continue-from` 且 `.boss/<feature>/` 不存在，调用 `boss project init <feature-name>`；`project init` 已隐式执行 pipeline 初始化，不要随后再调用 `boss runtime init-pipeline <feature>`。
- 调用 `boss packs detect <project-dir> --json`，读取 `detectedPack.evidence` 和 `matchedPacks`；用户显式 `--roles` 优先。
- 确认 Artifact DAG 来源：内置 `packages/boss-cli/assets/artifact-dag.json`，或 `.boss/artifact-dag.json`，或 pipeline pack 自定义 DAG。
- 调用 `boss runtime register-plugins <feature>` 扫描 `.boss/plugins/`。
- 标记阶段 1 开始：`boss runtime update-stage <feature> 1 running`。

## DAG 执行循环

重复以下步骤直到所有非跳过产物完成：

1. 查询就绪产物：`boss runtime get-ready-artifacts <feature> --ready --json`。
2. 阶段状态管理：对就绪产物所属阶段，若阶段为 `pending`，调用 `boss runtime update-stage <feature> <N> running`。
3. 准备产物骨架：对每个就绪产物调用 `boss artifact prepare <feature-name> <artifact-name>`。
4. 派发 Agent：
   - 读取 `agents/shared/protocol-manifest.md` 建立公共协议 prefix 缓存。
   - 按需读取 `references/artifact-guide.md`。
   - 对同一阶段非 `code` 就绪产物可并行派发。
   - `code` 产物必须先通过 `references/evidence-waves.md` 中的 Repo Preflight、写集冲突检测和风险等级感知确认。
   - 每个 Agent 前调用 `boss runtime query-memory <feature> --agent <agent-name>` 注入相关记忆摘要。
5. 保存产物到 `.boss/<feature>/`。
6. 记录产物：`boss runtime record-artifact <feature> <artifact-name> <N>`；Markdown 会自动生成 HTML companion。
7. 失败处理：
   - 先调用 `boss runtime check-stage <feature> <N> --agents`。
   - 只重试失败 Agent：`boss runtime retry-agent <feature> <N> <agent-name>`。
   - Agent 达上限后才用 `boss runtime retry-stage <feature> <N>`。
8. 反馈循环：若 Agent 返回 `REVISION_NEEDED`，调用 `boss runtime record-feedback ...`，再回派目标 Agent 修订。
9. Wave 边界校验：见 `references/evidence-waves.md`。
10. 确认节点：
    - 阶段 1 完成后确认规划结果。
    - code 阶段派发前按 Blast Radius 决定是否强制确认。
    - 阶段 3 门禁后，若 QA/门禁报告高风险疑虑则确认。
11. 门禁：读取 DAG 中 `type: "gate"` 条目，依次调用 `boss runtime evaluate-gates <feature> <gate-name>`。
12. 回到第 1 步。
13. DAG 全部完成后，调用 `boss runtime extract-memory <feature> --json`，查看 `records` 与 `summaryPreview` 后写入记忆库。

## 收尾

- 调用 `boss runtime generate-summary <feature>` 生成最终 Markdown 报告和 HTML companion。
- 输出文档位置、测试摘要、门禁结果、访问 URL、流水线耗时。

## 默认 DAG

```text
design-brief -> prd.md -+-> architecture.md -> tech-review.md -> tasks.md -> [code] -> qa-report.md -> deploy-report.md
                        +-> ui-spec.md(opt) -+
                        +-> ui-design.json(opt) -+
```

