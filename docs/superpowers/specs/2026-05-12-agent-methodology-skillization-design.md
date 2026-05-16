# Agent方法论Skill化与渐进式披露设计

**日期：** 2026-05-12  
**状态：** 设计阶段  
**目标：** 将Agent内部方法论拆分为独立skills，通过平台Skill工具实现按需加载，减少Agent prompt长度，控制context大小

---

## 摘要

当前Boss系统的9个专业Agent（PM、Architect、UI Designer、Tech Lead、Scrum Master、Frontend、Backend、QA、DevOps）的prompt中包含大量详细方法论内容，导致context占用过大。本设计通过将方法论拆分为独立的、符合平台规范的skills，让Agent通过平台原生的`Skill`工具按需加载，实现渐进式披露，预期可节省40-63%的context。

**核心原则：**
- 复用平台能力，不自己实现加载机制
- Agent自主决策何时加载哪些skills
- 混合粒度：核心流程用中粒度，复用方法用细粒度
- 一次性迁移所有9个Agents，不考虑向后兼容

---

## 1. 整体架构

### 1.1 Skill组织结构

```
skill/skills/
├── pm/                          # PM专属方法论
│   ├── 需求穿透/SKILL.md
│   ├── 竞品调研/SKILL.md
│   └── PRD编写/SKILL.md
├── architect/                   # 架构师专属
│   ├── 技术选型/SKILL.md
│   └── 架构设计/SKILL.md
├── ui-designer/                 # UI设计师专属
│   ├── 设计系统/SKILL.md
│   └── 组件规范/SKILL.md
├── tech-lead/                   # Tech Lead专属
│   ├── 技术评审/SKILL.md
│   └── 代码规范/SKILL.md
├── scrum-master/                # Scrum Master专属
│   ├── 任务拆解/SKILL.md
│   └── 风险评估/SKILL.md
├── frontend/                    # 前端开发
│   ├── 组件实现/SKILL.md
│   └── 状态管理/SKILL.md
├── backend/                     # 后端开发
│   ├── API设计/SKILL.md
│   └── 数据建模/SKILL.md
├── qa/                          # QA专属
│   ├── 测试策略/SKILL.md
│   └── 测试用例设计/SKILL.md
├── devops/                      # DevOps专属
│   ├── 部署流程/SKILL.md
│   └── CICD配置/SKILL.md
└── shared/                      # 跨Agent复用
    ├── 技术栈检测/SKILL.md
    ├── 代码审查/SKILL.md
    ├── 文档模板适配/SKILL.md
    ├── 测试金字塔/SKILL.md
    └── 性能优化/SKILL.md
```

### 1.2 核心机制

**Agent主prompt精简化：**
- 保留：角色定义、核心职责、输出格式、状态协议
- 移除：详细方法论、工作流程步骤、示例模板
- 新增：`available_skills`声明、Skill工具使用说明

**按需加载流程：**
1. Orchestrator派发Agent时，只传递精简的主prompt
2. Agent根据任务需要，通过`Skill`工具主动加载方法论
3. 平台返回skill内容，注入到Agent的conversation context
4. Agent基于加载的方法论执行任务

**渐进式披露：**
- 核心skills（`available_skills.core`）：建议在任务开始时加载
- 可选skills（`available_skills.optional`）：仅在实际需要时加载
- Agent完全自主决策加载时机和顺序

---

## 2. Skill依赖声明与加载机制

### 2.1 Agent主prompt的frontmatter扩展

```yaml
---
name: boss-pm
description: "产品经理 Agent，具有20年产品经验..."
tools: [Read, Write, Glob, Grep, WebSearch, WebFetch, Task, Skill]
available_skills:
  core:
    - pm/需求穿透
    - pm/PRD编写
  optional:
    - pm/竞品调研
    - pm/KANO模型
    - shared/文档模板适配
color: purple
model: inherit
---
```

**字段说明：**
- `tools`: 新增`Skill`工具
- `available_skills.core`: 核心方法论，建议优先加载
- `available_skills.optional`: 可选方法论，按需加载

### 2.2 Agent主prompt标准结构

```markdown
---
[frontmatter]
---

> 📋 通用规则见 `agents/shared/agent-protocol.md`

# <Agent角色名称>

你是一位<角色描述>。

## 核心职责

1. **职责1** — 简要说明
2. **职责2** — 简要说明
3. **职责3** — 简要说明

## 可用方法论

你可以通过 `Skill` 工具按需加载以下方法论：

**核心方法论**（建议在任务开始时加载）：
- `<agent>/方法论1` — 简要说明
- `<agent>/方法论2` — 简要说明

**可选方法论**（按实际需要加载）：
- `<agent>/方法论3` — 简要说明
- `shared/共享方法论` — 简要说明

**使用方式：**
```
Skill(skill: "<agent>/方法论名称")
```

## 工作流程

[精简的流程描述，不包含详细方法论步骤]

## 输出格式

[保持不变]

## 状态报告

[保持不变，引用agent-protocol.md]
```

### 2.3 Agent自主调用示例

```
我需要深入挖掘用户需求，让我加载需求穿透方法论。

Skill(skill: "pm/需求穿透")

[平台返回skill内容]

好的，现在我使用5W2H方法来追问：

1. What - 用户说的是什么？背后真正想要的是什么？
...
```

---

## 3. Skill粒度划分与复用策略

### 3.1 粒度划分原则（混合粒度）

**中粒度 - Agent核心流程**（按工作流阶段）

每个Agent的核心工作流程拆分为2-3个中粒度skills，每个skill覆盖一个完整的工作阶段。

示例：
- PM: `需求穿透`（包含5W2H、需求分层）、`竞品调研`、`PRD编写`
- Architect: `技术选型`、`架构设计`
- QA: `测试策略`、`测试用例设计`

**细粒度 - 跨Agent复用方法**

可被多个Agent复用的通用方法，拆分为独立的细粒度skills，放在`shared/`目录。

示例：
- `shared/技术栈检测` — 可被Architect、Tech Lead、Frontend、Backend复用
- `shared/代码审查` — 可被Tech Lead、QA复用
- `shared/文档模板适配` — 可被所有文档类Agent复用
- `shared/测试金字塔` — 可被Frontend、Backend、QA复用

### 3.2 初始拆分范围（所有Agent）

| Agent | 核心Skills (core) | 可选Skills (optional) |
|-------|------------------|---------------------|
| PM | 需求穿透, PRD编写 | 竞品调研, KANO模型 |
| Architect | 技术选型, 架构设计 | 性能优化, 安全设计 |
| UI Designer | 设计系统, 组件规范 | 交互设计, 视觉设计 |
| Tech Lead | 技术评审, 代码规范 | 代码审查, 重构指导 |
| Scrum Master | 任务拆解, 风险评估 | 进度跟踪, 冲突解决 |
| Frontend | 组件实现, 状态管理 | 性能优化, 测试编写 |
| Backend | API设计, 数据建模 | 性能优化, 测试编写 |
| QA | 测试策略, 测试用例设计 | 自动化测试, 性能测试 |
| DevOps | 部署流程, CICD配置 | 监控告警, 容器化 |

### 3.3 Skill依赖关系

某些skill可能依赖其他skills，在frontmatter中声明：

```yaml
---
name: pm/PRD编写
description: PRD文档结构和编写规范
dependencies:
  - shared/文档模板适配
---
```

Agent加载`pm/PRD编写`时，平台自动加载其依赖的`shared/文档模板适配`。

### 3.4 复用场景示例

**`shared/技术栈检测`的复用：**
- **Architect**: 技术选型阶段需要识别现有技术栈
- **Tech Lead**: 技术评审时需要验证技术栈一致性
- **Frontend/Backend**: 代码实现前需要确认框架和工具链
- **QA**: 测试策略需要基于技术栈选择测试工具

**`shared/测试金字塔`的复用：**
- **Frontend**: 组件测试策略
- **Backend**: API测试策略
- **QA**: 整体测试策略设计

---

## 4. 实施策略

### 4.1 一次性迁移步骤

**Step 1: 目录结构建立**

```bash
mkdir -p skill/skills/{pm,architect,ui-designer,tech-lead,scrum-master,frontend,backend,qa,devops,shared}
```

**Step 2: 拆分所有Agent方法论**（并行进行）

1. 从9个Agent的现有prompt中提取方法论内容
2. 按中粒度（核心流程）和细粒度（复用方法）划分
3. 为每个方法论创建独立的`skill/skills/<agent>/<方法论>/SKILL.md`
4. 识别跨Agent复用的方法，移到`skill/skills/shared/`

**Step 3: 精简所有Agent主prompt**

1. 保留：角色定义、核心职责、输出格式、状态协议
2. 移除：详细方法论内容
3. 添加：`available_skills`声明和Skill工具使用说明
4. 添加：`Skill`到tools列表

**Step 4: 更新orchestrator**

1. 派发Agent时不再需要预加载方法论
2. Agent自主通过Skill工具加载
3. 在`execution.json`中记录skill加载事件

### 4.2 质量验证

每个拆分后的skill必须：
- [ ] 有完整的frontmatter（name, description, version, agent-invocable等）
- [ ] 内容自包含，不依赖Agent主prompt的上下文
- [ ] 如有依赖其他skills，在frontmatter中声明`dependencies`
- [ ] 通过contract test验证skill可被正确加载

### 4.3 预期效果

**Context节省预期（以PM Agent为例）：**
- 当前完整prompt: ~3000 tokens
- 精简后主prompt: ~800 tokens
- 核心skills按需加载: ~1500 tokens
- 可选skills仅在需要时加载: ~700 tokens

**节省效果：**
- 不需要可选能力的任务: 节省~1900 tokens (63%)
- 需要部分可选能力: 节省~1200 tokens (40%)

**监控指标：**

在`execution.json`中追踪：
```json
{
  "skill_metrics": {
    "pm": {
      "prompt_tokens_base": 800,
      "prompt_tokens_with_skills": 2300,
      "skills_loaded": ["pm/需求穿透", "pm/PRD编写"],
      "skills_unused": ["pm/竞品调研", "pm/KANO模型"],
      "context_saving_rate": 0.40
    }
  }
}
```

---

## 5. 技术细节与规范

### 5.1 Skill frontmatter标准

```yaml
---
name: pm/需求穿透                    # 唯一标识，格式：<agent>/<skill-name>
description: 通过5W2H深度追问，识别显性、隐性、潜在和惊喜需求
version: 1.0.0
agent: pm                           # 所属Agent
type: methodology                   # 类型：methodology | workflow | template
user-invocable: false               # 不暴露给用户直接调用
agent-invocable: true               # 允许Agent通过Skill工具调用
dependencies: []                    # 依赖的其他skills
triggers: [需求不清晰, 用户意图, 深度挖掘, 5W2H]  # 触发关键词（用于文档和搜索）
---
```

**字段说明：**
- `name`: 唯一标识，格式`<agent>/<skill-name>`或`shared/<skill-name>`
- `description`: 一句话说明skill的作用
- `version`: 语义化版本号
- `agent`: 所属Agent（shared skills填`shared`）
- `type`: skill类型（methodology方法论 | workflow工作流 | template模板）
- `user-invocable`: 是否允许用户直接调用（通常为false）
- `agent-invocable`: 是否允许Agent调用（通常为true）
- `dependencies`: 依赖的其他skills列表
- `triggers`: 触发关键词，用于文档说明和搜索

### 5.2 Skill内容组织

每个skill的SKILL.md结构：

```markdown
---
[frontmatter]
---

# <Skill名称>

## 概述
[1-2句话说明这个方法论的目的]

## 适用场景
[什么情况下应该使用这个方法论]

## 方法论内容
[详细的方法、步骤、模型、示例]

## 输出要求
[使用这个方法论后应该产出什么]

## 注意事项
[常见陷阱、边界条件]
```

### 5.3 Shared skills命名规范

```
shared/技术栈检测        # 可被多个Agent复用
shared/代码审查          # Tech Lead、QA复用
shared/文档模板适配      # 所有文档类Agent复用
shared/测试金字塔        # Frontend、Backend、QA复用
shared/性能优化          # Frontend、Backend、DevOps复用
```

命名原则：
- 使用中文，简洁明确
- 动宾结构或名词短语
- 避免过于宽泛的名称（如"开发规范"）

### 5.4 与现有协议的集成

- `agents/shared/agent-protocol.md` 保持不变，继续作为通用规则
- `agents/shared/protocol-manifest.md` 新增一节说明skill按需加载机制
- Agent主prompt通过`> 📋 通用规则见...`引用共享协议
- Skills专注于方法论内容，不重复协议规则

**protocol-manifest.md新增内容：**

```markdown
## Agent方法论按需加载

从v3.9.0开始，Agent的详细方法论已拆分为独立skills，通过平台Skill工具按需加载。

### 加载机制

1. Agent主prompt中声明`available_skills`（core和optional）
2. Agent根据任务需要，通过`Skill(skill: "<name>")`加载方法论
3. 平台返回skill内容，注入到conversation context
4. Agent基于加载的方法论执行任务

### Skill类型

- **Core skills**: 核心方法论，建议在任务开始时加载
- **Optional skills**: 可选方法论，仅在实际需要时加载
- **Shared skills**: 跨Agent复用的通用方法

### 监控

Orchestrator在`execution.json`中记录每个Agent的skill加载事件和context节省率。
```

---

## 6. 风险与缓解

### 6.1 风险识别

| 风险 | 影响 | 概率 | 缓解措施 |
|------|------|------|---------|
| Agent不知道何时加载哪个skill | 任务执行不完整 | 中 | 在主prompt中明确说明每个skill的适用场景 |
| Skill内容不自包含，依赖主prompt上下文 | 加载后无法使用 | 中 | 质量验证checklist，确保每个skill自包含 |
| 拆分粒度不当，过细或过粗 | Context节省效果不佳 | 低 | 基于实际使用情况迭代调整 |
| Skill依赖关系复杂，循环依赖 | 加载失败 | 低 | 依赖关系图可视化，禁止循环依赖 |

### 6.2 回滚策略

虽然不考虑向后兼容，但如果迁移后发现严重问题，可以：
1. 从git历史恢复旧版Agent prompts
2. 临时禁用skill系统，使用完整prompt
3. 修复问题后重新迁移

---

## 7. 成功标准

### 7.1 功能完整性

- [ ] 所有9个Agent的方法论已拆分为独立skills
- [ ] 所有Agent主prompt已精简并添加`available_skills`声明
- [ ] Shared skills库已建立，包含至少5个跨Agent复用的方法论
- [ ] 所有skills通过质量验证checklist

### 7.2 性能指标

- [ ] Agent主prompt平均长度从~2500 tokens降至~800 tokens
- [ ] 实际任务执行中，context节省率达到40%以上
- [ ] Skill加载延迟<500ms（平台能力，无需优化）

### 7.3 可维护性

- [ ] Skill目录结构清晰，易于查找
- [ ] 每个skill有完整的frontmatter和文档
- [ ] Shared skills的复用率>50%（至少被2个Agent使用）
- [ ] `execution.json`中记录完整的skill加载事件

---

## 8. 后续优化方向

### 8.1 Skill版本管理

当前设计中skill版本号在frontmatter中声明，但未实现版本兼容性检查。未来可以：
- Agent声明依赖的skill版本范围（如`pm/需求穿透@^1.0.0`）
- 平台检查版本兼容性，加载匹配的版本
- 支持skill的breaking change和deprecation

### 8.2 Skill推荐系统

基于历史执行数据，orchestrator可以：
- 分析任务类型与skill使用的关联
- 在派发Agent时推荐可能需要的optional skills
- 减少Agent的认知负担

### 8.3 Skill组合模式

识别常见的skill组合使用模式：
- 如PM在需求澄清阶段通常同时使用`需求穿透`+`KANO模型`
- 定义skill组（skill group），一次性加载多个相关skills
- 减少重复的Skill工具调用

---

## 9. 参考资料

- `skill/agents/shared/agent-protocol.md` — Agent通用协议
- `skill/agents/shared/protocol-manifest.md` — 协议manifest与按需加载
- `skill/SKILL.md` — Boss主skill定义
- `skill/skills/brainstorming/SKILL.md` — 现有子skill示例
- 现有9个Agent prompts（`skill/agents/boss-*.md`）

---

## 附录A：PM Agent拆分示例

### 当前结构（完整prompt）

```yaml
---
name: boss-pm
description: "产品经理 Agent..."
tools: [Read, Write, Glob, Grep, WebSearch, WebFetch, Task]
---

# 产品经理 Agent

你是一位具有 **20 年产品经验**的顶级产品经理。

## 核心能力

### 洞察力：穿透需求表象
[详细内容 ~500 tokens]

### 产品哲学
[详细内容 ~200 tokens]

## 你的职责
[详细内容 ~300 tokens]

## 工作流程
[详细内容 ~400 tokens]

## 需求穿透方法论

### 5W2H 深度追问
[详细内容 ~600 tokens]

### 需求分层模型
[详细内容 ~400 tokens]

### KANO模型
[详细内容 ~300 tokens]

## 竞品调研方法
[详细内容 ~500 tokens]

## PRD编写规范
[详细内容 ~400 tokens]

总计：~3600 tokens
```

### 拆分后结构

**主prompt（精简版）：**

```yaml
---
name: boss-pm
description: "产品经理 Agent..."
tools: [Read, Write, Glob, Grep, WebSearch, WebFetch, Task, Skill]
available_skills:
  core: [pm/需求穿透, pm/PRD编写]
  optional: [pm/竞品调研, pm/KANO模型, shared/文档模板适配]
---

# 产品经理 Agent

你是一位具有 **20 年产品经验**的顶级产品经理。

## 核心职责

1. **需求穿透** — 深度挖掘用户真实需求
2. **调研分析** — 竞品和市场洞察
3. **PRD编写** — 输出完整产品需求文档

## 可用方法论

[列出available_skills及使用说明]

## 工作流程

[精简的流程描述 ~200 tokens]

总计：~800 tokens
```

**独立skills：**

1. `skill/skills/pm/需求穿透/SKILL.md` (~1000 tokens)
   - 5W2H深度追问
   - 需求分层模型

2. `skill/skills/pm/PRD编写/SKILL.md` (~500 tokens)
   - PRD结构规范
   - 编写要点

3. `skill/skills/pm/竞品调研/SKILL.md` (~500 tokens)
   - 竞品分析框架
   - 市场洞察方法

4. `skill/skills/pm/KANO模型/SKILL.md` (~300 tokens)
   - KANO分类
   - 优先级评估

**Context对比：**
- 不加载任何skill: 800 tokens（节省78%）
- 加载core skills: 2300 tokens（节省36%）
- 加载所有skills: 3100 tokens（节省14%）

实际使用中，大部分任务只需要core skills，少数任务需要optional skills，平均节省率约50%。
