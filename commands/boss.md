---
name: boss
description: "启动 BMAD 全自动研发流水线。编排 9 个专业 Agent，从需求到部署一键完成。"
allowed-tools: Task, Read, Write, Edit, Bash, Glob, Grep
---

# /boss — BMAD 全自动研发流水线

当用户执行 `/boss` 时，启动 Boss 流水线。

## 执行步骤

1. 读取 `skills/boss/SKILL.md`（如存在）或根目录的 `SKILL.md`，获取完整的 Boss 编排指令
2. 自然语言需求会先归一化为 feature slug，再传给 `scripts/init-project.sh <feature-name>`
3. 约束类输入不会启动新流水线：如果用户只是补充技术栈、偏好或约束，先询问要应用到哪个已有或新 feature
4. 按照 SKILL.md 中定义的四阶段工作流执行
5. 用户传入的参数（如 `--skip-ui`、`--quick`、`--template` 等）直接透传给工作流

## 用法

```
/boss [需求描述] [选项]
```

### 示例

```
/boss 做一个 Todo 应用
/boss 用户认证 --template
/boss 给现有项目加用户认证 --skip-ui
/boss 把现有原生 HTML 组件迁移成 shadcn 组件
/boss 快速搭建 API 服务 --skip-deploy --quick
/boss 继续上次中断的任务 --continue-from 3
/boss 轻量模式 --roles core --hitl-level off
```

自然语言示例会先推导出稳定的产物目录名，例如“做一个 Todo 应用”使用 `.boss/todo-app/`，“把现有原生 HTML 组件迁移成 shadcn 组件”使用 `.boss/shadcn-component-migration/`。

### 选项

| 参数 | 说明 |
|------|------|
| `--skip-ui` | 跳过 UI 设计阶段（纯 API/CLI 项目） |
| `--skip-deploy` | 跳过部署阶段（只开发不部署） |
| `--quick` | 跳过所有确认节点，全自动执行 |
| `--template` | 初始化项目级模板目录并暂停流水线 |
| `--continue-from <1-4>` | 从指定阶段继续 |
| `--hitl-level <level>` | 人机协作级别：`auto` / `interactive` / `off` |
| `--roles <preset>` | 角色预设：`full`（默认）/ `core` |
