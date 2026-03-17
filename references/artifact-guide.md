# 产物保存规范

## 保存规则

每个阶段的产物 **必须** 使用 Write 工具保存到 `.boss/<feature>/` 目录。

**保存前，先读取对应的模板文件，以其结构为基础生成内容。**

**每个产物必须在正文最开头包含 `## 摘要` section**，用 3-5 条简短结论概括核心内容。下游 Agent 读取上游产物时，优先读取 `## 摘要`，仅在需要细节时读取完整内容，以节省 Token。

| 阶段 | 必须保存的产物 | 模板 |
|------|----------------|------|
| 阶段 1 | `prd.md` | `templates/prd.md.template` |
| 阶段 1 | `architecture.md` | `templates/architecture.md.template` |
| 阶段 1 | `ui-spec.md`（如有界面） | `templates/ui-spec.md.template` |
| 阶段 2 | `api-contract.md`（全栈项目） | `templates/api-contract.md.template` |
| 阶段 2 | `tech-review.md` | `templates/tech-review.md.template` |
| 阶段 2 | `tasks.md` | `templates/tasks.md.template` |
| 阶段 3 | `qa-report.md` | `templates/qa-report.md.template` |
| 阶段 4 | `deploy-report.md` | `templates/deploy-report.md.template` |

## 保存格式

```
Write(".boss/<feature>/prd.md", ...)
Write(".boss/<feature>/architecture.md", ...)
```

## 检查清单

保存产物后，问自己：
- [ ] 文件是否保存到了正确的 `.boss/<feature>/` 目录？
- [ ] 文件名是否与规范一致？
- [ ] 内容是否使用了中文？
- [ ] 是否基于对应的 template 生成？
