## 背景

<!-- 为什么要改？关联 issue 请写 Fixes #123 -->

## 变更

<!-- 做了什么。对行为有影响时写清前后差异。 -->

## 影响面

<!-- 对已安装的 skill、CLI、hooks 有没有影响。没有就写「无」。 -->

## 验证

- [ ] `npm run lint`
- [ ] `npm run typecheck`
- [ ] `npm test`

## 检查清单

- [ ] 新增行为有对应测试（纯文档或配置改动请在描述里说明为什么不需要）
- [ ] 未新增 first-party `.sh` 实现面
- [ ] Hook 脚本无空 `catch {}` 块
- [ ] CLI 改动直接编辑 `skill/cli/` 下的 `.mts`（源码即产物，无构建步骤）
- [ ] 版本号未手动修改（由 `npm run release` 同步）
