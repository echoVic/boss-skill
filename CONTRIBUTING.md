# 贡献指南

感谢你对 boss-skill 的关注！以下是参与贡献的流程和规范。

## 环境准备

```bash
# 克隆仓库
git clone https://github.com/echoVic/boss-skill.git
cd boss-skill

# 确认 Node.js 版本
node -v  # >= 20

# 安装 jq（Shell 脚本依赖）
brew install jq        # macOS
sudo apt install jq    # Ubuntu/Debian

# 安装依赖并验证
npm install
npm run build
npm run typecheck
npm test
```

运行时代码保持 Node.js 内置模块优先；开发工具链使用 TypeScript 与 Vitest。

## 项目结构概览

| 目录 | 职责 |
|------|------|
| `skill/` | 安装到 Coding Agent 的薄 Skill bundle（`SKILL.md`、agents、commands、templates、hooks、子 skills） |
| `packages/boss-cli/src/runtime/` | Canonical runtime CLI、inspection、report、projector、schema |
| `packages/boss-cli/src/commands/` | `boss project`、`boss artifact`、`boss packs` 等 TypeScript 命令 |
| `scripts/hooks/` | 10 个 Claude Code Hook 脚本（由 `boss hooks run` 调度） |
| `scripts/lib/` | Hook 运行辅助 JS（无 first-party shell 编排） |
| `packages/boss-cli/assets/` | Boss CLI 内置 DAG、packs、plugin schema、内置插件 |
| `docs/` | runtime contract、实施计划等设计/迁移文档 |
| `test/` | 自动化测试 |
| `packages/boss-cli/src/` | Boss CLI/runtime 的 TypeScript/ESM 源码 |
| `packages/boss-cli/dist/` | 构建后的发布产物 |

## 开发规范

### TypeScript CLI

- First-party 编排入口必须落在 `packages/boss-cli/src/`，并通过 `boss ...` 或 `boss runtime ...` 暴露。
- 不新增 `.sh` 作为实现面；需要执行外部项目命令时，在 TypeScript 中用 Node 内置模块封装。
- 插件仍可通过 `plugin.json` 指向用户自己的可执行文件，但仓库内置能力不依赖 shell wrapper。

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

### 运行时依赖原则

运行时代码应继续优先使用 Node.js 内置模块（`fs`、`path`、`os`、`child_process`）。开发期工具链允许使用现有的 TypeScript/Vitest 依赖，但不要为运行时路径引入新的第三方依赖。

### Runtime 优先原则

- 需要新增或修改编排行为时，优先改 `packages/boss-cli/src/runtime/cli/*`、`packages/boss-cli/src/runtime/cli/lib/*`、`packages/boss-cli/src/runtime/projectors/*`、`packages/boss-cli/src/runtime/report/*`。
- 新的编排语义必须落在 `packages/boss-cli/src/runtime/*` 或 `packages/boss-cli/src/commands/*` 并通过 `boss <command>` 暴露。
- 不要直接写 `execution.json`；状态变更必须先进入事件流，再由 projector 物化。

## 测试

### 运行测试

```bash
npm run build
npm run typecheck
npm test
```

测试使用 Vitest，位于 `test/` 目录。

### 编写测试

- 测试文件命名：`test/<分类>/<模块名>.test.ts`
- 使用 `test/helpers/fixtures.ts` 创建临时 `.boss/` 目录结构
- Hook 测试通过直接调用 `run()` 函数，传入模拟的 JSON 输入

```ts
import { afterEach, describe, expect, it } from 'vitest';
import { cleanupTempDir, createExecData, createTempBossDir } from '../helpers/fixtures.js';

describe('my-hook', () => {
  let tmpDir: string | null = null;

  afterEach(() => {
    if (tmpDir) { cleanupTempDir(tmpDir); tmpDir = null; }
  });

  it('handles normal input', async () => {
    const execData = createExecData({ feature: 'test', status: 'running' });
    tmpDir = createTempBossDir('test', execData);
    const hook = await import('../../scripts/hooks/my-hook.js');
    const result = hook.run(JSON.stringify({ cwd: tmpDir }));
    expect(result).toBeTruthy();
  });
});
```

### 测试覆盖范围

提交 PR 时，请确保：

- 新增的 Hook 脚本有对应的测试
- 新增的 `scripts/lib/` 工具函数有对应的测试
- CLI 功能变更在 `test/bin/boss-skill.test.ts` 中覆盖

## 版本号

版本号在 4 个文件中必须保持一致：

| 文件 | 字段 |
|------|------|
| `package.json` | `version` |
| `skill/SKILL.md` | frontmatter `version:` |
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
fix: 修复 gate runtime 在 Linux 下日期解析错误
refactor: 提取重复的 CLI 参数解析逻辑
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
- [ ] 未新增 first-party `.sh` 实现面
- [ ] Hook 脚本无空 `catch {}` 块
- [ ] 版本号未手动修改（由发布脚本管理）

## 插件开发

如需开发自定义插件，请参考：

- 插件 Schema：`packages/boss-cli/assets/plugin-schema.json`
- 内置插件示例：`packages/boss-cli/assets/plugins/security-audit/`
- 插件注册入口：`boss runtime register-plugins`

插件目录结构：

```
.boss/plugins/<name>/
├── plugin.json    # 插件清单（必须符合 plugin-schema.json）
└── gate.js        # 门禁可执行文件示例（type: gate 时必需）
```

## 问题反馈

- Bug 报告：[GitHub Issues](https://github.com/echoVic/boss-skill/issues)
- 功能建议：同上，加 `enhancement` 标签

## License

MIT — 详见 [LICENSE](./LICENSE)。
