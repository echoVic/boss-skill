# 贡献指南

感谢你对 boss-skill 的关注！以下是参与贡献的流程和规范。

## 环境准备

```bash
# 克隆仓库
git clone https://github.com/echoVic/boss-skill.git
cd boss-skill

# 确认 Node.js 版本
node -v  # >= 16

# 安装 jq（Shell 脚本依赖）
brew install jq        # macOS
sudo apt install jq    # Ubuntu/Debian

# 运行测试
npm test
```

本项目零 npm 依赖，克隆即可开发，无需 `npm install`。

## 项目结构概览

| 目录 | 职责 |
|------|------|
| `agents/` | 9 个 Agent 的 Prompt 定义（Markdown） |
| `scripts/lib/` | 共享库（`common.sh` Shell 工具、`boss-utils.js` Node.js 工具） |
| `scripts/hooks/` | 10 个 Claude Code Hook 脚本 |
| `scripts/harness/` | 流水线阶段管理 Shell 脚本 |
| `scripts/gates/` | 质量门禁脚本 |
| `harness/` | 插件系统和 Pipeline Pack 配置 |
| `templates/` | 产物模板 |
| `test/` | 自动化测试 |
| `bin/boss-skill.js` | CLI 入口 |

## 开发规范

### Shell 脚本

所有 Shell 脚本必须使用共享库 `scripts/lib/common.sh`，不要重复定义颜色变量或日志函数：

```bash
#!/bin/bash
set -e

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
source "$SCRIPT_DIR/../lib/common.sh"
LOG_TAG="YOUR_TAG"

info "开始执行..."
```

`common.sh` 提供两组日志函数：

- **标准模式**：`info`、`success`、`warn`、`error`（error 会 exit 1）
- **Gate 模式**：`gate_info`、`gate_pass`、`gate_fail`（输出到 stderr，stdout 保留给 JSON）

其他可用的工具函数：`require_jq`、`require_exec_json`、`validate_stage`、`add_check`、`iso_now`、`date_ymd`、`iso_to_epoch`。

### Node.js Hook 脚本

- Hook 脚本不得 crash — 错误必须 catch 并写入 stderr，然后返回安全的降级值
- 日志格式：`process.stderr.write('[boss-skill] <hook名>/<上下文>: ' + err.message + '\n')`
- 每个 hook 导出 `run(rawInput)` 函数，接收 JSON 字符串，返回字符串

```javascript
// 正确的错误处理
try {
  data = JSON.parse(fs.readFileSync(execJsonPath, 'utf8'));
} catch (err) {
  process.stderr.write('[boss-skill] my-hook/readExecJson: ' + err.message + '\n');
  return '';
}
```

### 零依赖原则

本项目不使用任何第三方 npm 依赖。所有代码仅使用 Node.js 内置模块（`fs`、`path`、`os`、`child_process`）。

新增功能时请遵守此约束，包括测试框架（使用 `node:test` + `node:assert`）。

## 测试

### 运行测试

```bash
npm test
```

测试使用 Node.js 内置的 `node:test` 框架，位于 `test/` 目录。

### 编写测试

- 测试文件命名：`test/<分类>/<模块名>.test.js`
- 使用 `test/helpers/fixtures.js` 创建临时 `.boss/` 目录结构
- Hook 测试通过直接调用 `run()` 函数，传入模拟的 JSON 输入

```javascript
const { describe, it, afterEach } = require('node:test');
const assert = require('node:assert/strict');
const { createTempBossDir, createExecData, cleanupTempDir } = require('../helpers/fixtures');

describe('my-hook', () => {
  let tmpDir;

  afterEach(() => {
    if (tmpDir) { cleanupTempDir(tmpDir); tmpDir = null; }
  });

  it('handles normal input', () => {
    const execData = createExecData({ feature: 'test', status: 'running' });
    tmpDir = createTempBossDir('test', execData);
    const hook = require('../../scripts/hooks/my-hook');
    const result = hook.run(JSON.stringify({ cwd: tmpDir }));
    assert.ok(result);
  });
});
```

### 测试覆盖范围

提交 PR 时，请确保：

- 新增的 Hook 脚本有对应的测试
- 新增的 `scripts/lib/` 工具函数有对应的测试
- CLI 功能变更在 `test/bin/boss-skill.test.js` 中覆盖

## 版本号

版本号在 4 个文件中必须保持一致：

| 文件 | 字段 |
|------|------|
| `package.json` | `version` |
| `SKILL.md` | frontmatter `version:` |
| `.claude-plugin/plugin.json` | `version` |
| `.claude-plugin/marketplace.json` | 外层 `version` + `plugins[0].version` |

**不要手动修改版本号**，使用发布脚本自动同步：

```bash
npm run release -- <version|major|minor|patch> [--dry-run] [--no-publish]
```

测试套件中包含版本一致性检查，CI 会自动拦截版本不同步的问题。

## 提交规范

使用 [Conventional Commits](https://www.conventionalcommits.org/) 格式：

```
<type>: <description>

[可选正文]
```

| Type | 用途 |
|------|------|
| `feat` | 新功能 |
| `fix` | Bug 修复 |
| `refactor` | 重构（不改变行为） |
| `test` | 测试相关 |
| `docs` | 文档 |
| `chore` | 构建、发布、配置等 |

示例：

```
feat: 添加 Rust 项目 pipeline pack
fix: 修复 gate-runner 在 Linux 下日期解析错误
refactor: 提取 Shell 脚本公共函数到 common.sh
test: 为 post-tool-write hook 添加单元测试
docs: 更新 README 安装说明
```

## 提交 PR

1. Fork 仓库并创建分支：`git checkout -b feat/my-feature`
2. 编写代码和测试
3. 确保 `npm test` 全部通过
4. 提交并推送：`git push origin feat/my-feature`
5. 创建 Pull Request，描述你的修改和动机

### PR 检查清单

- [ ] `npm test` 全部通过
- [ ] 新增代码有对应测试
- [ ] Shell 脚本使用 `common.sh`，无重复样板
- [ ] Hook 脚本无空 `catch {}` 块
- [ ] 版本号未手动修改（由发布脚本管理）

## 插件开发

如需开发自定义插件，请参考：

- 插件 Schema：`harness/plugin-schema.json`
- 内置插件示例：`harness/plugins/security-audit/`
- 插件加载器：`scripts/harness/load-plugins.sh`

插件目录结构：

```
harness/plugins/<name>/
├── plugin.json    # 插件清单（必须符合 plugin-schema.json）
└── gate.sh        # 门禁脚本（type: gate 时必需）
```

## 问题反馈

- Bug 报告：[GitHub Issues](https://github.com/echoVic/boss-skill/issues)
- 功能建议：同上，加 `enhancement` 标签

## License

MIT — 详见 [LICENSE](./LICENSE)。
