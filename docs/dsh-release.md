# DeepSeek Harness bundle 发布流程

`integrations/deepseek-harness` 以独立版本号发布为 npm 包 `dsh-boss-mode`（当前 `0.1.x`），
与根 skill 的 `5.0.x` 版本互不影响。

## 一次性准备

- Node `>= 22.18`，依赖已安装（`npm ci`）。
- npm 包已配置 **Trusted Publisher**（npmjs.com → 包 Settings → Trusted Publisher → GitHub Actions）：
  - Organization or user: `echoVic`
  - Repository: `boss-skill`
  - Workflow filename: `dsh-publish.yml`
  - Permissions: 勾选 `Allow npm publish`（允许 CI 直接发布；`npm stage publish` 始终允许）
- 不需要 `NPM_TOKEN` secret。CI 通过 GitHub OIDC 认证，发布自动带 provenance。
- 如果包页面显示 Trusted Publisher 为 `Pending validation`，需要在页面给出的截止时间前成功发布一次。

## 标准发布（推荐：打 tag，由 CI 发布）

1. 修改 bundle 内容后重新生成资源快照并校验：

   ```bash
   npm run dsh:build
   npm run dsh:check
   ```

2. 只修改 `integrations/deepseek-harness/package.json` 的 `version`。不要动根 `package.json` 的版本号，
   它由 `npm run release` 单独管理。

3. 本地跑完整验证链：

   ```bash
   npm run dsh:check
   npm run lint
   npm run typecheck
   npm test
   ```

4. 提交发布内容：

   ```bash
   git commit -m "chore(dsh): release bundle <version>"
   ```

5. 固定 DSH 市场索引：在 `integrations/deepseek-harness/marketplace.json` 的
   `plugins[0].versions` 顶部加入新条目，`publishTimestamp` 用当前 epoch 秒，
   `source.commit` 用上一步的提交 SHA：

   ```json
   {
     "version": "<version>",
     "publishTimestamp": 1794073793,
     "source": {
       "type": "git",
       "url": "https://github.com/echoVic/boss-skill",
       "commit": "<release 提交 SHA>",
       "path": "integrations/deepseek-harness"
     }
   }
   ```

   ```bash
   git commit -m "chore(dsh): pin Boss <version> market entry"
   ```

6. 打 tag 并推送（tag 会触发发布 workflow）：

   ```bash
   git tag -a dsh-boss-mode-v<version> -m "Boss Mode v<version> for DeepSeek Harness"
   git push origin main
   git push origin dsh-boss-mode-v<version>
   ```

7. 观察 CI：`.github/workflows/dsh-publish.yml` 会校验 bundle 快照与 tag 版本一致，跑
   lint/typecheck/test，然后执行
   `npm publish ./integrations/deepseek-harness --access public --provenance`
   （npm trusted publishing / GitHub OIDC）：

   ```bash
   gh run list --workflow=dsh-publish.yml
   gh run watch <run-id>
   ```

8. 校验 npm 产物（registry 处理可能延迟几分钟）：

   ```bash
   npm view dsh-boss-mode dist-tags
   npm view dsh-boss-mode@<version> dist.attestations
   ```

9. 创建 GitHub Release，附带 tgz 与 SHA256SUMS：

   ```bash
   npm pack ./integrations/deepseek-harness --pack-destination /tmp/boss-release
   (cd /tmp/boss-release && shasum -a 256 dsh-boss-mode-<version>.tgz > dsh-boss-mode-<version>.SHA256SUMS)
   gh release create dsh-boss-mode-v<version> \
     /tmp/boss-release/dsh-boss-mode-<version>.tgz \
     /tmp/boss-release/dsh-boss-mode-<version>.SHA256SUMS \
     --title "Boss Mode v<version> for DeepSeek Harness" \
     --notes-file /tmp/boss-release/notes.md
   ```

10. 安装验证：

    ```bash
    npm install dsh-boss-mode@<version>              # 消费侧
    dsh plugin --profile desktop add dsh-boss-mode   # DSH 侧
    ```

    DSH 需要完全重启；已有会话保留原 preset，新建会话后在模式选择器中选择「Boss 专家小队」。

## 本地手动发布（备用路径）

`npm run dsh:publish` 会依次校验 npm 元数据、`npm pack` 内容、版本是否已被占用、资源快照，然后执行
`npm publish`。
- 只验证不发布：`npm run dsh:publish:dry`
- TOTP 账号（有 6 位验证码）：`npm run dsh:publish -- --otp=<code>`
- 只注册了 **WebAuthn 安全密钥** 的账号：npm CLI 的交互式 2FA 只支持 TOTP，直发会返回 `EOTP`。
  改走暂存发布，再到浏览器用安全密钥审批：

  ```bash
  cd integrations/deepseek-harness
  npx npm@11 stage publish
  ```

  然后在 npmjs.com 头像菜单 → **Staged Packages** → 找到对应版本 → **Approve**。
  `0.1.3` 就是这样发布的。

## 故障排查

| 现象                         | 处理                                                                                       |
| ---------------------------- | ------------------------------------------------------------------------------------------ |
| `EOTP` / 提示需要一次性密码  | 账号 2FA 是 WebAuthn 安全密钥时 CLI 无法完成；改用 staged publishing 或 CI OIDC            |
| workflow 报 tag 与版本不一致 | tag 的版本必须等于 `integrations/deepseek-harness/package.json` 的 `version`               |
| 发布被拒绝 / `Forbidden`     | 检查包的 Trusted Publisher 配置与 Permissions（直接发布需要勾选 `Allow npm publish`）      |
| 发布成功但 `npm view` 看不到 | npm registry 处理需要几分钟；以 CI 日志里的 `+ dsh-boss-mode@<version>` 和 provenance 为准 |
| provenance 校验失败          | `package.json` 的 `repository.url` 与 `repository.directory` 必须与仓库一致                |

## 相关文件

- `.github/workflows/dsh-publish.yml` — tag 触发的 OIDC 发布 workflow
- `integrations/deepseek-harness/package.json` — bundle 版本、`publishConfig`、`prepublishOnly`
- `integrations/deepseek-harness/marketplace.json` — DSH 市场索引
- `scripts/publish-dsh.js` — 本地发布脚本（`npm run dsh:publish`）
