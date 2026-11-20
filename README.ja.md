# boss-skill

[![skills.sh](https://skills.sh/b/echovic/boss-skill)](https://skills.sh/echovic/boss-skill)
[![G-Star Incubation](https://img.shields.io/badge/G--Star-Incubation-C71D23)](https://atomgit.com/echoVic/boss-skill)
[![License: MIT](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)

**Languages / 语言 / 言語 / 언어 / Idiomas / Langues:** [English](./README.md) · [中文](./README.zh-CN.md) · 日本語 · [한국어](./README.ko.md) · [Español](./README.es.md) · [Français](./README.fr.md) · [Português](./README.pt-BR.md)

![boss-skill promo](https://raw.githubusercontent.com/echoVic/boss-skill/main/boss-skill-promo.png)

> このプロジェクトは AtomGit G-Star Incubation Program の一部です。GitHub が正規リポジトリで、AtomGit は自動同期されるミラーです。Issue や Pull Request は [GitHub](https://github.com/echoVic/boss-skill) に投稿してください。

**Boss はコーディングエージェント向けのエキスパートスクワッド・ワークフローです。** 1 体のエージェントを構造化されたエンジニアリングチームに変えます。PM、アーキテクト、UI デザイナー、テックリード、スクラムマスター、フロントエンド、バックエンド、QA、DevOps。各ロールは厳格な品質契約に従って作業し、結果をディスクに書き出します。契約は作成者ではなく、独立した検証者が確認します。現在のブランチのレビューのように既存のコードに対して 1 つのロールだけを実行することも、アイデアから Pull Request までパイプライン全体を実行することもできます。

Boss は Claude Code、Codex、OpenClaw、Antigravity、Hermes、DeepSeek Harness で動作します。

## DeepSeek Harness

Boss は DeepSeek Harness 用の bundle [`dsh-boss-mode`](https://www.npmjs.com/package/dsh-boss-mode) も提供します。**Boss Expert Squad** プリセットと、Agent Teams のメンバーとタスクをリアルタイムで読むサイドバーが付きます。

```bash
dsh plugin --profile desktop add dsh-boss-mode
```

DeepSeek Harness を再起動し、新しいセッションを作成して **Boss Expert Squad** を選びます。

## Boss を選ぶ理由

- **既存のコードにも使える**: `/boss:review` は現在のブランチの diff をレビューし、`/boss:qa` はそれをテストし、`/boss:ship` は Pull Request を作成します。各コマンドは自分の 1 ステージだけを実行して止まります。
- **厳格な品質契約**: 各ロールに交渉不可の要件表があります（PRD には Given-When-Then シナリオ、アーキテクチャは最低 2 案の比較、QA はすべての主張について、裏付けとなるコマンドと終了コードの記録が必要）。
- **作成者は自分の成果物を採点しない**: スクリプトで判定できることはスクリプトが確認し、残りは別の検証エージェントが判断して、その根拠を引用します。契約を満たさないと、免除しない限り次のステージに進めません。
- **成果物駆動**: 各ステージは `.boss/<feature>/` に実ファイルを書きます。進捗はディスク上の成果物で判断し、エージェントの主張では判断しません。
- **デフォルト TDD**: 開発ステージはまず失敗するテストを書き、RED を確認してから、最小限のコードで GREEN にします。
- **ローカル優先**: テレメトリもリモートプロキシもありません。Boss がプッシュ、Pull Request の作成、デプロイを行うのは、`ship` を実行したときか、あなたが承諾したときだけです。

## エキスパートスクワッドコマンド

各コマンドは 1 つのステージを実行し、検証して止まり、次のコマンドを示します:

| コマンド          | ロール                        | 書き出すもの                                                         |
| ----------------- | ----------------------------- | -------------------------------------------------------------------- |
| `/boss:pm`        | PM                            | `prd.md`                                                             |
| `/boss:architect` | アーキテクト                  | `architecture.md`                                                    |
| `/boss:ui`        | UI デザイナー                 | `ui-spec.md`、`ui-design.json`                                       |
| `/boss:review`    | テックリード                  | diff に対する `code-review.md`、または `tech-review.md` と `plan.md` |
| `/boss:tasks`     | スクラムマスター              | `tasks.md`                                                           |
| `/boss:dev`       | フロントエンド / バックエンド | コードとテスト                                                       |
| `/boss:qa`        | QA                            | `qa-report.md`                                                       |
| `/boss:ship`      | DevOps                        | Pull Request、または `--deploy` でデプロイ                           |
| `/boss:verify`    | 検証者                        | 既存の成果物に対する `verification.md`                               |

`--continue` を付けるとチェーンの先へ進み続け、`--stop-after <stage>` を付けると後のステージで止まります。完全なチェーンは `pm → architect → ui → review → tasks → dev → qa → ship` です。全体を実行するには、Claude Code で `/boss:boss <request>` を使うか、Boss に最初から最後まで作るよう頼みます。

Claude Code では、これらは実際のスラッシュコマンドです。他のエージェントでは、Boss スキルを呼び出してステージを指定します。たとえば「Boss でこのブランチをレビューして」のように伝えます。

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

最初の試し方は、いまいるブランチの読み取り専用レビューが最も安価です。`/boss:review` は `.boss/<branch>/code-review.md` を書き、ソースファイルは一切変更しません。フルチェーンを回すには:

```text
/boss:boss Build a local personal todo app --skip-ui
```

`--skip-ui` は API / CLI プロジェクトで UI 設計を省略し、`--quick` は定型的な確認を省略します。

成果物は `.boss/<feature>/` にあります: `prd.md`、`architecture.md`、`ui-spec.md`、`ui-design.json`、`tech-review.md`、`plan.md`、`code-review.md`、`tasks.md`、`qa-report.md`、`deploy-report.md`、`verification.md`。どれも要約から始まり、下流のエージェントが先に結論を読めます。成果物はリクエストの言語で書かれます。`--lang <code>` で上書きできます。

## ワークフロー

パイプライン全体です。各ステージは、次のステージが始まる前に検証されます:

```text
リクエスト → 明確化（--quick 以外）
  → PM: prd.md
  → アーキテクト: architecture.md
  → UI: ui-spec.md + ui-design.json（--skip-ui で省略）
  → テックリード: tech-review.md + plan.md
  → スクラムマスター: tasks.md
  → フロントエンド / バックエンド: TDD 実装
  → QA: qa-report.md
  → DevOps: Pull Request またはデプロイ、deploy-report.md
```

## 品質ゲート

各ステージの契約は 2 回チェックされます。`skill/scripts/check-artifacts.mjs` がスクリプトで判定できるルールを適用し、残りは検証エージェントが判断します。契約に加えて、各ゲートは実際のコマンドで判定され、結果はそのステージの成果物に記録されます:

| ゲート              | ステージ          | 確認内容                                                               |
| ------------------- | ----------------- | ---------------------------------------------------------------------- |
| 0（コード品質）     | 開発後、QA 前     | typecheck と lint が通り、依存に高重大度の脆弱性がない                 |
| 1（テスト）         | QA 後、デプロイ前 | ユニット・統合テストが通り、カバレッジ ≥ 70%、P0/P1 なし、E2E 作成済み |
| 2（パフォーマンス） | Web デプロイ前    | Lighthouse ≥ 80、API P99 < 500 ms（Web プロジェクトのみ）              |

追跡可能な `.boss/` フォルダーが不要なら、フルチェーンも不要なはずです。単一のロールを使ってください。

## セキュリティとプライバシー

Boss はローカル優先で、デフォルトでは外向きのリクエストを行いません。`ship` がプッシュやデプロイを行うのは、あなたが実行したときか確認したときだけです。リリースの来歴は `.agents/plugins/provenance.json` にあり、リポジトリ URL、ソースコミット、発行者、マニフェストのダイジェストを固定します。`npm run provenance:verify` で検証できます。データとネットワークの境界は [PRIVACY.md](./PRIVACY.md) を参照してください。

## Evals

3 つの層で Boss 自体をチェックします:

```bash
npm run test:install-smoke   # skills CLI と `claude plugin validate` でリポジトリを読み込む
npm run evals                # 記録済みのトランスクリプトを採点する。モデルは呼び出さない
npm run evals:agent          # evals/ を実際の Claude Code エージェントで実行する（API クレジットを消費）
```

`npm run evals:agent` は [`claude plugin eval`](https://code.claude.com/docs/en/plugin-evals) をラップしています。そのケースは、小さな編集で Boss が起動しないこと、ステージが完了したら止まること、レビューがソースファイルを編集しないこと、検証が破られた契約を報告することを確認します。`ANTHROPIC_API_KEY` シークレットを設定すると、同じスイートが `.github/workflows/skill-behavior.yml` で毎週実行されます。

## 開発

Node.js ≥ 22.18 が必要です。

```bash
git clone https://github.com/echoVic/boss-skill.git
cd boss-skill
npm install
npm run typecheck
npm test
```

その他のスクリプト: `npm run test:skills`（トランスクリプトの解析）、`npm run test:contracts`（成果物チェッカー）、`npm run lint`（Biome）。リリースは `npm run release -- patch|minor|major|<version>` で行います。スクリプトはクリーンなワークツリーを確認し、typecheck・lint・テストを実行してから、バージョン同期、コミット、タグ、プッシュを行います。[CONTRIBUTING.md](./CONTRIBUTING.md) と [docs/dsh-release.md](./docs/dsh-release.md) も参照してください。

## 設計

Boss は BMAD（Breakthrough Method of Agile AI-Driven Development）と「より少なく、より高品質なコードを書く」思想に触発されています。エキスパートスクワッドモデルは harness を軽量に保ちます — ランタイムのステートマシン、イベントソーシング、hooks はありません — 一方で厳格な品質契約と成果物駆動の協働は維持します。[DESIGN.md](./DESIGN.md) と `skill/references/principles.md` を読んでください。

## ライセンス

[MIT](LICENSE)
