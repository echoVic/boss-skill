# BMAD 方法论参考文档

## 概述

BMAD（Breakthrough Method of Agile AI-Driven Development）是一种突破性的敏捷 AI 驱动开发方法论，专为人机协作设计，通过专业化的 AI Agent 团队完成完整的软件开发生命周期。

---

## 核心理念

### 1. 专业化分工

BMAD 的核心是将软件开发流程分解为专业化角色，每个角色由专门的 AI Agent 承担：

| 角色 | 职责 | 输出产物 |
|------|------|----------|
| 产品经理 (PM) | 需求分析、PRD 编写 | PRD 文档 |
| UI/UX 设计师 | 界面设计、用户体验 | UI 规范文档 |
| 系统架构师 | 技术架构、选型决策 | 架构文档 |
| 技术负责人 | 故事分解、风险评估 | 用户故事 |
| Scrum Master | 任务细化、开发规划 | 开发任务 |
| 开发者 | 代码实现 | 源代码 |
| QA 工程师 | 测试验证 | QA 报告 |
| DevOps | 部署运维 | 部署报告 |

### 2. 产物驱动

每个阶段产出明确的文档产物，作为下一阶段的输入：

```
用户需求
    ↓
PRD → Architecture → UI Spec
    ↓
Stories → Tasks
    ↓
Code → QA Report
    ↓
Deploy Report + 可访问产物
```

### 3. 全自动流水线

区别于传统的分步确认模式，Boss Mode 采用全自动流水线：
- 一次性完成从需求到部署的完整流程
- 无需中间人工确认
- 最终交付可运行、可访问的产物

---

## 四阶段工作流

### 阶段 1：规划（Planning）

**目标**：将用户想法转化为可执行规格

**参与 Agent**：
- PM Agent → 创建 PRD
- Architect Agent → 设计架构
- UI Designer Agent → 创建 UI 规范

**产物**：
- `.boss/<feature>/prd.md`
- `.boss/<feature>/architecture.md`
- `.boss/<feature>/ui-spec.md`

**并行执行**：三个 Agent 可以并行工作，提高效率

### 阶段 2：拆解（Decomposition）

**目标**：将规格转化为可实施的开发计划

**参与 Agent**：
- Tech Lead Agent → 分解用户故事
- Scrum Master Agent → 创建详细任务

**产物**：
- `.boss/<feature>/stories.md`
- `.boss/<feature>/tasks.md`

**串行执行**：故事分解完成后才能创建详细任务

### 阶段 3：开发（Development）

**目标**：实现代码并持续验证

**参与 Agent**：
- Developer Agent → 实现代码
- QA Agent → 持续验证

**工作模式**：
1. 按任务顺序实现代码
2. 每完成几个任务，QA 进行验证
3. 发现问题及时修复
4. 循环直到所有任务完成

### 阶段 4：部署（Deployment）

**目标**：部署应用并生成报告

**参与 Agent**：
- QA Agent → 全面测试验证
- DevOps Agent → 部署应用

**产物**：
- `.boss/<feature>/qa-report.md`
- `.boss/<feature>/deploy-report.md`
- **可访问的 URL**

---

## Agent 详解

### PM Agent（产品经理）

**核心能力**：
- 需求分析与挖掘
- 用户画像创建
- PRD 文档编写
- 优先级排序

**输出格式**：EARS (Easy Approach to Requirements Syntax)
- 通用需求：「系统应该...」
- 事件驱动：「当 [触发条件] 时，系统应该...」
- 状态驱动：「在 [状态] 下，系统应该...」

### Architect Agent（架构师）

**核心能力**：
- 系统架构设计
- 技术选型决策
- 数据模型设计
- API 设计

**决策维度**：
- 可扩展性
- 性能
- 安全性
- 可维护性

### UI Designer Agent（UI 设计师）

**核心能力**：
- 用户流程设计
- 界面规范定义
- 设计系统创建
- 无障碍设计

**输出内容**：
- 用户流程图（Mermaid）
- 设计令牌（颜色、排版、间距）
- 组件规格
- 响应式断点

### Tech Lead Agent（技术负责人）

**核心能力**：
- 需求到故事的转化
- 复杂度评估
- 依赖分析
- 风险识别

**故事格式**：
- 作为 [用户类型]
- 我想要 [目标行为]
- 以便 [预期价值]

### Scrum Master Agent（Scrum Master）

**核心能力**：
- 故事到任务的分解
- 文件级变更规划
- 测试用例定义
- 实现步骤指导

**任务粒度**：每个任务应该能在 1-2 个工具调用内完成

### Developer Agent（开发者）

**核心能力**：
- 代码实现
- 测试编写
- 代码规范遵循
- 增量开发

**工作原则**：
- 先读后写
- 小步快跑
- 测试覆盖
- 类型安全

### QA Agent（QA 工程师）

**核心能力**：
- 测试执行
- 验收验证
- Bug 发现与记录
- 边界测试

**测试类型**：
- 单元测试
- 集成测试
- 端到端测试
- 边界情况测试

### DevOps Agent（DevOps 工程师）

**核心能力**：
- 环境配置
- 依赖安装
- 应用部署
- 健康检查

**支持的项目类型**：
- React/Vue/Next.js
- Node.js API
- Python Flask/Django
- 静态 HTML
- Docker

---

## 产物管理

### 目录结构

所有产物保存在项目根目录的 `.boss/` 下：

```
.boss/
├── <feature-name>/
│   ├── prd.md              # 产品需求文档
│   ├── architecture.md     # 系统架构文档
│   ├── ui-spec.md          # UI/UX 规范（如需要）
│   ├── stories.md          # 用户故事
│   ├── tasks.md            # 开发任务
│   ├── qa-report.md        # QA 测试报告
│   └── deploy-report.md    # 部署报告
```

### 模板使用

每种产物都有对应的模板文件：
- 位置：`~/.blade/skills/boss/templates/`
- 格式：Markdown + 占位符

---

## 最佳实践

### 1. 需求描述

好的需求描述应该包含：
- 功能目标
- 用户类型
- 核心场景
- 技术约束（如有）

示例：
```
我想要创建一个任务管理应用，用户可以：
- 创建、编辑、删除任务
- 设置任务截止日期
- 按优先级排序
- 标记任务完成

技术要求：使用 React + TypeScript，数据存储在 LocalStorage
```

### 2. 迭代优化

如果结果不满意，可以：
- 指定修改某个阶段的产物
- 提供更详细的需求
- 调整技术约束

### 3. 项目类型

Boss Mode 最适合：
- 新功能开发
- 小型完整项目
- 原型验证
- 学习项目

---

## 参考资源

- [BMAD-METHOD GitHub](https://github.com/bmad-code-org/BMAD-METHOD)
- [Agile Manifesto](https://agilemanifesto.org/)
- [EARS Requirements Syntax](https://www.iaria.org/conferences2013/filesICCGI13/ICCGI_2013_Tutorial_Terzakis.pdf)
