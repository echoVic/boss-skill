---
name: boss
description: "启动 BMAD 全自动研发流水线。编排 9 个专业 Agent，从需求到部署一键完成。"
allowed-tools: Task, Read, Write, Edit, Bash, Glob, Grep
---

# /boss — BMAD 全自动研发流水线

当用户执行 `/boss` 时，启动 Boss 流水线。

## 执行步骤

1. 读取 `skills/boss/SKILL.md`（如存在）或根目录的 `SKILL.md`，获取完整的 Boss 编排指令
2. 按照 SKILL.md 中定义的四阶段工作流执行
3. 用户传入的参数（如 `--skip-ui`、`--quick`、`--template` 等）直接透传给工作流

## 用法

```
/boss [需求描述] [选项]
```

### 示例

```
/boss 做一个 Todo 应用
/boss 用户认证 --template
/boss 给现有项目加用户认证 --skip-ui
/boss 快速搭建 API 服务 --skip-deploy --quick
/boss 继续上次中断的任务 --continue-from 3
/boss 轻量模式 --roles core --hitl-level off
```

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
