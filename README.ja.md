# boss-skill

[![skills.sh](https://skills.sh/b/echovic/boss-skill)](https://skills.sh/echovic/boss-skill)
[![G-Star Incubation](https://img.shields.io/badge/G--Star-Incubation-C71D23)](https://atomgit.com/echoVic/boss-skill)
[![License: MIT](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)

**Languages / 语言 / 言語 / 언어 / Idiomas / Langues:** [English](./README.md) · [中文](./README.zh-CN.md) · 日本語 · [한국어](./README.ko.md) · [Español](./README.es.md) · [Français](./README.fr.md) · [Português](./README.pt-BR.md)

![boss-skill promo](https://raw.githubusercontent.com/echoVic/boss-skill/main/boss-skill-promo.png)

> このプロジェクトは AtomGit G-Star Incubation Program の一部です。GitHub が正規リポジトリで、AtomGit は自動同期されるミラーです。Issue や Pull Request は [GitHub](https://github.com/echoVic/boss-skill) に投稿してください。

**Boss はコーディングエージェント向けのエキスパートスクワッド・ワークフローです。** 1 体のエージェントを構造化されたエンジニアリングチームに変えます。PM、アーキテクト、UI デザイナー、テックリード、スクラムマスター、フロントエンド、バックエンド、QA、DevOps。プロンプトだけのエージェントチームと違い、Boss はロールごとに厳格な品質契約を課し、再生可能な成果物を生み出し、ステージを自動でつなぎます。どこから始めても、止めるまで残りを実行します。

Boss は Claude Code、Codex、OpenClaw、Antigravity、Hermes、DeepSeek Harness で動作します。

## DeepSeek Harness

Boss は DeepSeek Harness 用の bundle [`dsh-boss-mode`](https://www.npmjs.com/package/dsh-boss-mode) も提供します。**Boss Expert Squad** プリセットと、Agent Teams のメンバーとタスクをリアルタイムで読むサイドバーが付きます。

```bash
dsh plugin --profile desktop add dsh-boss-mode
```

DeepSeek Harness を再起動し、新しいセッションを作成して **Boss Expert Squad** を選びます。

## Boss を選ぶ理由

- **厳格な品質契約**: 各ロールに交渉不可の要件表があります（PRD には Given-When-Then シナリオ、アーキテクチャは最低 2 案の比較、QA は検証済みか正直に未検証と記録した証拠が必要）。契約を満たさないと、明示的に上書きしない限り次のステージに進めません。
- **成果物駆動**: 各ステージは `.boss/<feature>/` に実ファイルを書きます。進捗はディスク上の成果物で判断し、エージェントの主張では判断しません。
- **継続チェーン**: どのステージから始めても、Boss が `ship` まで下流のステージを自動実行します。
- **デフォルト TDD**: 開発ステージはまず失敗するテストを書き、RED を確認してから、最小限のコードで GREEN にします。
- **ローカル優先**: テレメトリもリモートプロキシもありません。唯一のネットワーク面は任意で有効にする `127.0.0.1` のループバックプレビューサーバーです。

## エキスパートスクワッドコマンド

各コマンドは入口で、下流のステージを自動実行します:

| コマンド | 開始 | 実行範囲 |
| --- | --- | --- |
| `/boss` | PM | 全チェーン → ship |
| `/boss:pm` | PM | アーキテクト → … → Ship |
| `/boss:architect` | アーキテクト | UI → … → Ship |
| `/boss:ui` | UI デザイナー | レビュー → … → Ship |
| `/boss:review` | テックリード | タスク → … → Ship |
| `/boss:tasks` | スクラムマスター | 開発 → QA → Ship |
| `/boss:dev` | フロントエンド / バックエンド | QA → Ship |
| `/boss:qa` | QA | Ship |
| `/boss:ship` | DevOps | チェーン終了 |

完全なチェーンは `pm → architect → ui → review → tasks → dev → qa → ship` です。「stop」「このステップだけ」と言うか、`--stop-after <stage>` を渡すと止められます。

## クイックスタート

Boss をコーディングエージェントにインストールします。スキルは各マーケットプレイス経由で配布され、DeepSeek Harness の bundle は別途 npm で公開されています:

```text
# Claude Code
/plugin marketplace add echoVic/boss-skill
/plugin install boss@boss-skill

# Codex
codex plugin marketplace add echoVic/boss-skill   # その後 /plugins で boss をインストール

# skills CLI を使う任意のエージェント
npx skills add echoVic/boss-skill

# DeepSeek Harness
dsh plugin --profile desktop add dsh-boss-mode
```

最初の試し方は、既存コードへの読み取り専用レビューが最も安価です。`/boss:review` は `tech-review.md` と `plan.md` だけを書き、他は触りません。フルチェーンを回すには:

```text
/boss Build a local personal todo app --skip-ui
```

`--skip-ui` は API / CLI プロジェクトで UI 設計を省略し、`--quick` は定型的な確認を省略します。

成果物は `.boss/<feature>/` にあります: `prd.md`、`architecture.md`、`ui-spec.md`、`ui-design.json`、`tech-review.md`、`plan.md`、`tasks.md`、`qa-report.md`、`deploy-report.md`。どれも要約から始まり、下流のエージェントが先に結論を読めます。

## ワークフロー

```text
リクエスト → 明確化（--quick 以外）
  → PM: prd.md
  → アーキテクト: architecture.md
  → UI: ui-spec.md + ui-design.json（--skip-ui で省略）
  → テックリード: tech-review.md + plan.md
  → スクラムマスター: tasks.md
  → フロントエンド / バックエンド: TDD 実装
  → QA: qa-report.md
  → DevOps: deploy-report.md
```

## 品質ゲート

ロールごとの契約に加えて、各ゲートは実際のコマンドで判定され、結果はそのステージの成果物に記録されます:

| ゲート | ステージ | 確認内容 |
| --- | --- | --- |
| 0（コード品質） | 開発後、QA 前 | typecheck と lint が通り、依存に高重大度の脆弱性がない |
| 1（テスト） | QA 後、デプロイ前 | ユニット・統合テストが通り、カバレッジ ≥ 70%、P0/P1 なし、E2E 作成済み |
| 2（パフォーマンス） | Web デプロイ前 | Lighthouse ≥ 80、API P99 < 500 ms（Web プロジェクトのみ） |

追跡可能な `.boss/` フォルダーが不要なら、フルチェーンも不要なはずです。単一のロールを使ってください。

## セキュリティとプライバシー

Boss はローカル優先で、デフォルトでは外向きのリクエストを行いません。リリースの来歴は `.agents/plugins/provenance.json` にあり、リポジトリ URL、ソースコミット、発行者、マニフェストのダイジェストを固定します。`npm run provenance:verify` で検証できます。データとネットワークの境界は [PRIVACY.md](./PRIVACY.md) を参照してください。

## Evals

記録済みのトランスクリプトを、実際の LLM を起動せずに採点します:

```bash
npm run evals
npm run evals:release   # リリース証跡とパイプライン遵守のチェックを追加
```

## 開発

Node.js ≥ 22.18 が必要です。

```bash
git clone https://github.com/echoVic/boss-skill.git
cd boss-skill
npm install
npm run typecheck
npm test
```

その他のスクリプト: `npm run test:skills`（スキルの動作のみ）、`npm run evals`、`npm run lint`（Biome）。リリースは `npm run release -- patch|minor|major|<version>` で行います。スクリプトはクリーンなワークツリーを確認し、typecheck・lint・テストを実行してから、バージョン同期、コミット、タグ、プッシュを行います。[CONTRIBUTING.md](./CONTRIBUTING.md) と [docs/dsh-release.md](./docs/dsh-release.md) も参照してください。

## 設計

Boss は BMAD（Breakthrough Method of Agile AI-Driven Development）と「より少なく、より高品質なコードを書く」思想に触発されています。エキスパートスクワッドモデルは harness を軽量に保ちます — ランタイムのステートマシン、イベントソーシング、hooks はありません — 一方で厳格な品質契約と成果物駆動の協働は維持します。[DESIGN.md](./DESIGN.md) と `skill/references/principles.md` を読んでください。

## ライセンス

[MIT](LICENSE)
