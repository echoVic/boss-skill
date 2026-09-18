# Agent方法论Skill化与渐进式披露 - 实施计划

## 概述

### 目标
将9个Boss Agent的方法论内容从主prompt中拆分为独立的skill文件，实现按需加载，减少context消耗。

### 范围
- 9个Agent的主prompt重构（PM、Architect、UI Designer、Tech Lead、Scrum Master、Frontend、Backend、QA、DevOps）
- 创建约30个skill文件（中粒度核心流程 + 细粒度共享方法）
- 建立skill目录结构和命名规范
- 更新Agent加载逻辑以支持skill声明

### 预期效果
- Agent主prompt从平均2500 tokens降至800 tokens（减少68%）
- 按需加载可节省40-63%的context（取决于任务复杂度）
- 提升方法论的复用性和可维护性

### 设计文档
参见：`docs/superpowers/specs/2026-05-12-agent-methodology-skillization-design.md`

---

## 实施阶段

### Phase 1: 基础设施准备（1-2小时）

**目标**: 建立skill目录结构和标准模板

#### Task 1.1: 创建skill目录结构
```bash
mkdir -p skill/skills/{pm,architect,ui-designer,tech-lead,scrum-master,frontend,backend,qa,devops,shared}
```

**验收标准**:
- 所有10个目录创建完成
- 目录结构符合设计文档规范

#### Task 1.2: 创建skill模板文件
创建 `skill/skills/_TEMPLATE.md` 作为标准模板：

```markdown
---
name: {agent}/{skill-name}
description: {一句话描述方法论的目的和适用场景}
version: 1.0.0
agent: {agent-name}
type: {methodology|workflow|guideline}
user-invocable: false
agent-invocable: true
dependencies: []
triggers:
  - {触发场景描述}
---

# {Skill标题}

## 适用场景
{描述何时使用此方法论}

## 核心方法
{方法论的具体内容}

## 输出要求
{使用此方法论后应产出什么}
```

**验收标准**:
- 模板文件包含完整的frontmatter字段
- 模板内容结构清晰，易于复制使用

#### Task 1.3: 创建shared skill索引
创建 `skill/skills/shared/README.md` 说明共享skill的用途和使用规范。

**验收标准**:
- README说明了shared目录的定位
- 列出了预期的共享skill类型（技术栈检测、代码审查、文档模板适配等）

---

### Phase 2: 拆分PM Agent（2-3小时）

**目标**: 完成PM Agent的方法论拆分，作为其他Agent的参考模板

#### Task 2.1: 分析PM Agent现有内容
- 读取 `skill/agents/boss-pm/AGENT.md`（当前616行）
- 识别可拆分的方法论模块
- 确定哪些内容保留在主prompt，哪些移至skill

**验收标准**:
- 列出4个核心skill（需求穿透、PRD编写、竞品调研、KANO模型）
- 明确每个skill的边界和依赖关系

#### Task 2.2: 创建PM核心skills
创建以下4个skill文件：
1. `skill/skills/pm/requirement-penetration.md` - 需求穿透（5W2H、需求分层模型）
2. `skill/skills/pm/prd-writing.md` - PRD编写（文档结构、内容要求）
3. `skill/skills/pm/competitive-analysis.md` - 竞品调研（竞品分析框架、市场洞察）
4. `skill/skills/pm/kano-model.md` - KANO模型（需求优先级评估）

**验收标准**:
- 每个skill文件包含完整的frontmatter
- 内容从原AGENT.md中准确提取，无遗漏
- skill之间无重复内容
- dependencies字段正确声明依赖关系

#### Task 2.3: 重构PM Agent主prompt
修改 `skill/agents/boss-pm/AGENT.md`：
- 保留：角色定义、核心职责、输出格式、状态协议
- 移除：详细方法论内容（已移至skill）
- 添加：frontmatter中的available_skills声明
- 添加：Skill工具使用说明

**验收标准**:
- 主prompt行数从616行降至约200行
- available_skills正确声明4个skill（2个required + 2个optional）
- 角色定义和核心职责保持完整
- 状态协议（BOSS_PM_STATUS）保持不变

#### Task 2.4: 验证PM Agent功能
- 手动测试PM Agent的核心流程
- 验证skill按需加载是否正常工作
- 检查输出质量是否与重构前一致

**验收标准**:
- PM Agent能正常启动和执行任务
- 能够通过Skill工具加载方法论
- 输出的PRD质量与重构前相当

---

### Phase 3: 拆分Architect Agent（2-3小时）

**目标**: 完成Architect Agent的方法论拆分

#### Task 3.1: 创建Architect核心skills
创建以下3个skill文件：
1. `skill/skills/architect/tech-selection.md` - 技术选型（技术栈评估、选型决策）
2. `skill/skills/architect/architecture-design.md` - 架构设计（系统分层、模块划分）
3. `skill/skills/architect/performance-optimization.md` - 性能优化（性能分析、优化策略）

**验收标准**:
- 每个skill文件包含完整的frontmatter
- 内容从原AGENT.md（504行）中准确提取
- 正确声明对shared/tech-stack-detection的依赖

#### Task 3.2: 创建第一个shared skill
创建 `skill/skills/shared/tech-stack-detection.md` - 技术栈检测方法（被Architect、Tech Lead、Frontend、Backend、QA复用）

**验收标准**:
- frontmatter中agent字段为"shared"
- 内容通用，不包含特定Agent的上下文
- 包含检测package.json、pom.xml、Cargo.toml等配置文件的方法

#### Task 3.3: 重构Architect Agent主prompt
修改 `skill/agents/boss-architect/AGENT.md`：
- 保留：角色定义、核心职责、输出格式、状态协议
- 移除：详细方法论内容
- 添加：available_skills声明（2个required + 1个optional）
- 添加：Skill工具使用说明

**验收标准**:
- 主prompt行数从504行降至约180行
- available_skills正确声明3个skill
- 状态协议（BOSS_ARCHITECT_STATUS）保持不变

#### Task 3.4: 验证Architect Agent功能
- 手动测试Architect Agent的核心流程
- 验证shared skill加载是否正常
- 检查输出质量

**验收标准**:
- Architect Agent能正常执行技术选型和架构设计
- 能够加载shared/tech-stack-detection
- 输出的架构文档质量与重构前相当

---

### Phase 4: 拆分UI Designer Agent（1-2小时）

**目标**: 完成UI Designer Agent的方法论拆分

#### Task 4.1: 创建UI Designer核心skills
创建以下3个skill文件：
1. `skill/skills/ui-designer/design-system.md` - 设计系统（组件库、设计规范）
2. `skill/skills/ui-designer/component-specification.md` - 组件规范（组件定义、交互说明）
3. `skill/skills/ui-designer/interaction-design.md` - 交互设计（用户流程、交互模式）

**验收标准**:
- 每个skill文件包含完整的frontmatter
- 内容从原AGENT.md中准确提取

#### Task 4.2: 重构UI Designer Agent主prompt
修改 `skill/agents/boss-ui-designer/AGENT.md`：
- 保留：角色定义、核心职责、输出格式、状态协议
- 移除：详细方法论内容
- 添加：available_skills声明（2个required + 1个optional）

**验收标准**:
- 主prompt行数显著减少
- available_skills正确声明3个skill
- 状态协议（BOSS_UI_DESIGNER_STATUS）保持不变

---

### Phase 5: 拆分Tech Lead Agent（1-2小时）

**目标**: 完成Tech Lead Agent的方法论拆分

#### Task 5.1: 创建Tech Lead核心skills
创建以下3个skill文件：
1. `skill/skills/tech-lead/technical-review.md` - 技术评审（代码审查、架构评审）
2. `skill/skills/tech-lead/code-standards.md` - 代码规范（编码标准、最佳实践）
3. `skill/skills/tech-lead/refactoring-guidance.md` - 重构指导（重构策略、风险控制）

**验收标准**:
- 每个skill文件包含完整的frontmatter
- 正确声明对shared/code-review和shared/tech-stack-detection的依赖

#### Task 5.2: 创建第二个shared skill
创建 `skill/skills/shared/code-review.md` - 代码审查方法（被Tech Lead、QA复用）

**验收标准**:
- frontmatter中agent字段为"shared"
- 内容通用，包含代码审查的通用标准和流程

#### Task 5.3: 重构Tech Lead Agent主prompt
修改 `skill/agents/boss-tech-lead/AGENT.md`：
- 保留：角色定义、核心职责、输出格式、状态协议
- 移除：详细方法论内容
- 添加：available_skills声明（2个required + 1个optional）

**验收标准**:
- 主prompt行数显著减少
- available_skills正确声明3个skill
- 状态协议（BOSS_TECH_LEAD_STATUS）保持不变

---

### Phase 6: 拆分Scrum Master Agent（1小时）

**目标**: 完成Scrum Master Agent的方法论拆分

#### Task 6.1: 创建Scrum Master核心skills
创建以下3个skill文件：
1. `skill/skills/scrum-master/task-breakdown.md` - 任务拆解（WBS、任务粒度）
2. `skill/skills/scrum-master/risk-assessment.md` - 风险评估（风险识别、应对策略）
3. `skill/skills/scrum-master/progress-tracking.md` - 进度跟踪（燃尽图、里程碑）

**验收标准**:
- 每个skill文件包含完整的frontmatter
- 内容从原AGENT.md中准确提取

#### Task 6.2: 重构Scrum Master Agent主prompt
修改 `skill/agents/boss-scrum-master/AGENT.md`：
- 保留：角色定义、核心职责、输出格式、状态协议
- 移除：详细方法论内容
- 添加：available_skills声明（2个required + 1个optional）

**验收标准**:
- 主prompt行数显著减少
- available_skills正确声明3个skill
- 状态协议（BOSS_SCRUM_MASTER_STATUS）保持不变

---

### Phase 7: 拆分Frontend Agent（1-2小时）

**目标**: 完成Frontend Agent的方法论拆分

#### Task 7.1: 创建Frontend核心skills
创建以下3个skill文件：
1. `skill/skills/frontend/component-implementation.md` - 组件实现（组件开发、样式处理）
2. `skill/skills/frontend/state-management.md` - 状态管理（状态设计、数据流）
3. `skill/skills/frontend/performance-optimization.md` - 性能优化（渲染优化、资源加载）

**验收标准**:
- 每个skill文件包含完整的frontmatter
- 正确声明对shared/tech-stack-detection的依赖

#### Task 7.2: 重构Frontend Agent主prompt
修改 `skill/agents/boss-frontend/AGENT.md`：
- 保留：角色定义、核心职责、输出格式、状态协议
- 移除：详细方法论内容
- 添加：available_skills声明（2个required + 1个optional）

**验收标准**:
- 主prompt行数显著减少
- available_skills正确声明3个skill
- 状态协议（BOSS_FRONTEND_STATUS）保持不变

---

### Phase 8: 拆分Backend Agent（1-2小时）

**目标**: 完成Backend Agent的方法论拆分

#### Task 8.1: 创建Backend核心skills
创建以下3个skill文件：
1. `skill/skills/backend/api-design.md` - API设计（RESTful、GraphQL）
2. `skill/skills/backend/data-modeling.md` - 数据建模（数据库设计、ORM）
3. `skill/skills/backend/performance-optimization.md` - 性能优化（查询优化、缓存策略）

**验收标准**:
- 每个skill文件包含完整的frontmatter
- 正确声明对shared/tech-stack-detection的依赖

#### Task 8.2: 重构Backend Agent主prompt
修改 `skill/agents/boss-backend/AGENT.md`：
- 保留：角色定义、核心职责、输出格式、状态协议
- 移除：详细方法论内容
- 添加：available_skills声明（2个required + 1个optional）

**验收标准**:
- 主prompt行数显著减少
- available_skills正确声明3个skill
- 状态协议（BOSS_BACKEND_STATUS）保持不变

---

### Phase 9: 拆分QA Agent（1-2小时）

**目标**: 完成QA Agent的方法论拆分

#### Task 9.1: 创建QA核心skills
创建以下3个skill文件：
1. `skill/skills/qa/test-strategy.md` - 测试策略（测试类型、覆盖率）
2. `skill/skills/qa/test-case-design.md` - 测试用例设计（用例编写、边界值）
3. `skill/skills/qa/automation-testing.md` - 自动化测试（测试框架、CI集成）

**验收标准**:
- 每个skill文件包含完整的frontmatter
- 正确声明对shared/code-review和shared/tech-stack-detection的依赖

#### Task 9.2: 重构QA Agent主prompt
修改 `skill/agents/boss-qa/AGENT.md`：
- 保留：角色定义、核心职责、输出格式、状态协议
- 移除：详细方法论内容
- 添加：available_skills声明（2个required + 1个optional）

**验收标准**:
- 主prompt行数显著减少
- available_skills正确声明3个skill
- 状态协议（BOSS_QA_STATUS）保持不变

---

### Phase 10: 拆分DevOps Agent（1小时）

**目标**: 完成DevOps Agent的方法论拆分

#### Task 10.1: 创建DevOps核心skills
创建以下3个skill文件：
1. `skill/skills/devops/deployment-process.md` - 部署流程（部署策略、回滚机制）
2. `skill/skills/devops/cicd-configuration.md` - CI/CD配置（流水线设计、自动化）
3. `skill/skills/devops/monitoring-alerting.md` - 监控告警（监控指标、告警规则）

**验收标准**:
- 每个skill文件包含完整的frontmatter
- 内容从原AGENT.md中准确提取

#### Task 10.2: 重构DevOps Agent主prompt
修改 `skill/agents/boss-devops/AGENT.md`：
- 保留：角色定义、核心职责、输出格式、状态协议
- 移除：详细方法论内容
- 添加：available_skills声明（2个required + 1个optional）

**验收标准**:
- 主prompt行数显著减少
- available_skills正确声明3个skill
- 状态协议（BOSS_DEVOPS_STATUS）保持不变

---

### Phase 11: 创建剩余shared skills（1小时）

**目标**: 完成所有跨Agent复用的共享方法

#### Task 11.1: 创建文档模板适配skill
创建 `skill/skills/shared/document-template-adaptation.md` - 文档模板适配方法（被所有文档类Agent复用）

**验收标准**:
- frontmatter中agent字段为"shared"
- 内容包含文档结构检测、模板选择、内容填充的通用方法

#### Task 11.2: 更新所有Agent的dependencies
检查所有Agent的available_skills声明，确保正确引用shared skills。

**验收标准**:
- 所有需要技术栈检测的Agent都声明了shared/tech-stack-detection
- 所有需要代码审查的Agent都声明了shared/code-review
- 所有文档类Agent都声明了shared/document-template-adaptation

---

### Phase 12: 集成测试与验证（2-3小时）

**目标**: 验证所有Agent的功能完整性和skill加载机制

#### Task 12.1: 端到端测试
为每个Agent设计一个典型任务场景，验证：
- Agent能正常启动
- 能够按需加载required skills
- 能够按需加载optional skills
- 输出质量与重构前一致

**测试场景**:
1. PM: 从用户需求生成PRD
2. Architect: 为新项目设计技术架构
3. UI Designer: 设计登录页面组件
4. Tech Lead: 审查代码PR
5. Scrum Master: 拆解开发任务
6. Frontend: 实现表单组件
7. Backend: 设计用户API
8. QA: 编写测试用例
9. DevOps: 配置CI/CD流水线

**验收标准**:
- 所有9个Agent通过端到端测试
- 无skill加载失败
- 输出质量符合预期

#### Task 12.2: Context消耗验证
对比重构前后的context消耗：
- 测量每个Agent的主prompt token数
- 测量典型任务的总context消耗
- 验证是否达到预期的节省效果（40-63%）

**验收标准**:
- 主prompt平均从2500 tokens降至800 tokens
- 典型任务的context消耗减少40%以上
- 复杂任务的context消耗减少60%以上

#### Task 12.3: 文档更新
更新以下文档：
- `README.md`: 说明新的skill目录结构
- `skill/skills/README.md`: 说明skill的使用方法和开发规范
- 各Agent的README（如有）: 说明available_skills的含义

**验收标准**:
- 所有文档更新完成
- 文档内容准确反映新的架构
- 包含skill开发和使用的示例

---

## 依赖关系

### 阶段依赖
- Phase 2-10 依赖 Phase 1（基础设施）
- Phase 3 依赖 Phase 2（PM作为参考模板）
- Phase 11 依赖 Phase 2-10（所有Agent拆分完成后才能确定所有shared skills）
- Phase 12 依赖 Phase 1-11（所有实施完成后才能集成测试）

### 技术依赖
- 平台Skill工具必须支持agent-invocable模式
- 平台Skill工具必须支持dependencies自动加载
- Agent加载器必须支持解析frontmatter中的available_skills字段

---

## 风险与应对

### 风险1: Skill加载机制不符合预期
**描述**: 平台Skill工具可能不支持Agent自主调用或dependencies自动加载

**影响**: 高 - 可能导致整个方案无法实施

**应对策略**:
1. 在Phase 1完成后立即进行技术验证
2. 创建一个最小化的测试Agent和测试skill，验证加载机制
3. 如果平台不支持，考虑回退到方案B（自建加载机制）或方案C（预加载所有skills）

**缓解措施**:
- 提前与平台团队确认Skill工具的能力边界
- 准备备选方案的设计文档

### 风险2: Skill拆分粒度不当
**描述**: 拆分过细导致skill数量过多，拆分过粗导致context节省不明显

**影响**: 中 - 影响预期效果的达成

**应对策略**:
1. 在Phase 2（PM Agent）完成后进行粒度评估
2. 根据实际效果调整后续Agent的拆分粒度
3. 在Phase 12进行全面的context消耗验证，必要时重新调整

**缓解措施**:
- 遵循设计文档中的粒度原则（中粒度核心流程 + 细粒度共享方法）
- 在每个Phase完成后进行小范围验证

### 风险3: Agent功能回归
**描述**: 重构后Agent的输出质量下降或功能缺失

**影响**: 高 - 影响用户体验

**应对策略**:
1. 在每个Agent重构完成后立即进行功能验证（Task X.4）
2. 保留原始AGENT.md的备份，便于对比和回滚
3. 在Phase 12进行全面的端到端测试

**缓解措施**:
- 严格遵循"保留-移除-添加"的重构原则
- 确保状态协议和核心职责不被修改
- 建立回归测试用例库

### 风险4: Skill依赖关系复杂化
**描述**: 随着skill数量增加，依赖关系可能变得复杂难以维护

**影响**: 中 - 影响长期可维护性

**应对策略**:
1. 在Phase 11完成后绘制skill依赖关系图
2. 识别循环依赖和过深的依赖链
3. 必要时重构skill以简化依赖关系

**缓解措施**:
- 限制依赖深度不超过2层
- 优先使用shared skills而非Agent间相互依赖
- 在skill frontmatter中明确声明dependencies

---

## 成功标准

### 功能完整性
- [ ] 所有9个Agent的主prompt重构完成
- [ ] 所有约30个skill文件创建完成
- [ ] 所有Agent通过端到端功能测试
- [ ] 无skill加载失败或依赖缺失

### Context节省效果
- [ ] Agent主prompt平均从2500 tokens降至800 tokens（减少68%）
- [ ] 简单任务的context消耗减少40%以上
- [ ] 复杂任务的context消耗减少60%以上

### 代码质量
- [ ] 所有skill文件包含完整的frontmatter
- [ ] 所有skill文件遵循命名规范
- [ ] 所有Agent的available_skills声明正确
- [ ] 无重复内容在多个skill中出现

### 文档完整性
- [ ] README.md更新完成
- [ ] skill/skills/README.md创建完成
- [ ] 所有Agent的文档更新完成
- [ ] 包含skill开发和使用的示例

### 可维护性
- [ ] Skill依赖关系清晰，无循环依赖
- [ ] Skill粒度适中，易于理解和修改
- [ ] 目录结构清晰，易于导航
- [ ] 命名规范一致，易于搜索

---

## 时间估算

| 阶段 | 预计时间 | 累计时间 |
|------|---------|---------|
| Phase 1: 基础设施准备 | 1-2小时 | 1-2小时 |
| Phase 2: 拆分PM Agent | 2-3小时 | 3-5小时 |
| Phase 3: 拆分Architect Agent | 2-3小时 | 5-8小时 |
| Phase 4: 拆分UI Designer Agent | 1-2小时 | 6-10小时 |
| Phase 5: 拆分Tech Lead Agent | 1-2小时 | 7-12小时 |
| Phase 6: 拆分Scrum Master Agent | 1小时 | 8-13小时 |
| Phase 7: 拆分Frontend Agent | 1-2小时 | 9-15小时 |
| Phase 8: 拆分Backend Agent | 1-2小时 | 10-17小时 |
| Phase 9: 拆分QA Agent | 1-2小时 | 11-19小时 |
| Phase 10: 拆分DevOps Agent | 1小时 | 12-20小时 |
| Phase 11: 创建剩余shared skills | 1小时 | 13-21小时 |
| Phase 12: 集成测试与验证 | 2-3小时 | 15-24小时 |

**总计**: 15-24小时（约2-3个工作日）

---

## 下一步行动

1. **用户审核**: 请审核本实施计划，确认阶段划分和任务分解是否合理
2. **风险评估**: 请评估识别的风险是否完整，应对策略是否可行
3. **开始实施**: 审核通过后，从Phase 1开始执行
4. **进度跟踪**: 每完成一个Phase，更新本文档的进度状态

---

## 附录

### 相关文档
- 设计文档: `docs/superpowers/specs/2026-05-12-agent-methodology-skillization-design.md`
- Skill模板: `skill/skills/_TEMPLATE.md`（待创建）
- Skill开发规范: `skill/skills/README.md`（待创建）

### 参考资料
- 现有Agent prompts: `skill/agents/boss-*/AGENT.md`
- 现有skill示例: `skill/skills/brainstorming/SKILL.md`
- 平台Skill工具文档: （待补充）
