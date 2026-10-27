# boss-skill

[![skills.sh](https://skills.sh/b/echovic/boss-skill)](https://skills.sh/echovic/boss-skill)
[![CodeRabbit Pull Request Reviews](https://img.shields.io/coderabbit/prs/github/echoVic/boss-skill?utm_source=oss&utm_medium=github&utm_campaign=echoVic%2Fboss-skill&labelColor=171717&color=FF570A&link=https%3A%2F%2Fcoderabbit.ai&label=CodeRabbit+Reviews)](https://coderabbit.ai)
[![G-Star Incubation](https://img.shields.io/badge/G--Star-Incubation-C71D23)](https://atomgit.com/echoVic/boss-skill)
[![AtomGit Mirror](https://img.shields.io/badge/AtomGit-Mirror-1F6FEB)](https://atomgit.com/echoVic/boss-skill)
[![Boss trust badge](https://img.shields.io/endpoint?url=https%3A%2F%2Fhol.org%2Fapi%2Fregistry%2Fbadges%2Fplugin%3Fslug%3Dechovic%252Fboss%26metric%3Dtrust%26style%3Dflat)](https://hol.org/registry/plugins/echovic%2Fboss)

**Languages / 语言 / 言語 / 언어 / Idiomas / Langues:** [English](./README.md) · [中文](./README.zh-CN.md) · [日本語](./README.ja.md) · [한국어](./README.ko.md) · [Español](./README.es.md) · [Français](./README.fr.md) · [Português](./README.pt-BR.md)

![boss-skill promo](https://raw.githubusercontent.com/echoVic/boss-skill/main/boss-skill-promo.png)

> このプロジェクトは AtomGit G-Star Incubation Program の一部です。GitHub が正規リポジトリであり、AtomGit は中国国内での高速アクセスのための自動同期ミラーを提供しています。Issue や Pull Request は [GitHub](https://github.com/echoVic/boss-skill) に投稿してください。
>
> GitHub: <https://github.com/echoVic/boss-skill> · AtomGit ミラー: <https://atomgit.com/echoVic/boss-skill>

**Boss はコーディングエージェント向けのエキスパートスクワッドワークフローです。** 1 つのコーディングエージェントを、PM、Architect、UI Designer、Tech Lead、Scrum Master、Frontend、Backend、QA、DevOps という構造化されたエンジニアリングチームへと変えます。プロンプトのみのエージェントチームとは異なり、Boss はロールごとの硬性品質契約を強制し、再生可能なアーティファクトを生成し、ステージを自動的に連鎖させます——どこから始めても、あなたが止めるまで後続のステージを実行し続けます。

Boss は Claude Code、Codex、OpenClaw、Antigravity、Hermes で動作します。

## Boss を選ぶ理由

プロンプトのみのオーケストレーションは整然としているように見えても、計画どおりに実行されたこと、テストが実行されたこと、ゲートを通過したことを証明できないのが普通です。Boss はエビデンスと硬性契約を中心に構築されています:

- **硬性品質契約**: すべてのロールには妥協できない要求事項テーブルがあります（例: PRD には Given-When-Then シナリオが必須、アーキテクチャは少なくとも 2 つの選択肢を比較、QA は検証済みまたは正直に未検証と記載したエビデンスが必須）。契約に失敗した場合は、明示的にオーバーライドしない限り次のステージに進めません。
- **アーティファクト駆動**: すべてのステージは `.boss/<feature>/` 配下に実ファイルを書き出します。進捗はエージェントの主張ではなく、ディスク上のアーティファクトで判断されます。
- **継続チェーン**: 任意のステージ（`/boss:pm`、`/boss:dev` ...）から開始すると、Boss は `ship` またはあなたが停止するまで、すべての下流ステージを自動実行します。手動の引き継ぎは不要です。
- **エンジニアリング原則**: スクワッドは 10 の原則を共有します——実物を検証する、根本原因を修正する、レバーを作る、ドメインをモデル化する、境界を守る、検証可能な単位にシーケンス化する、振る舞いをテストする、読者の負担を最小限にする、構造化された経験、自律的ルール。各エージェントは適用した原則を明記します。
- **デフォルトで TDD**: 開発ステージでは最初に失敗するテストを書き、RED を確認してから、GREEN にする最小限のコードを書きます。
- **デフォルトでゼロ通信**: テレメトリなし、フォンホームなし、リモート LLM プロキシなし。唯一のネットワーク面は UI プロトタイピング用のオプトイン・ループバックプレビューサーバ（`127.0.0.1`）のみです。詳細は [PRIVACY.md](./PRIVACY.md)。
- **決定的な eval**: 記録されたトランスクリプトは、実際の LLM を呼び出すことなくスコアリングできます。

## エキスパートスクワッドコマンド

Boss は単一のモノリシックなコマンドではありません。各スラッシュコマンドはエントリポイントであり、デフォルトですべての下流ステージを自動実行します。

| コマンド | 起点 | 自動継続先 | 使う場面 |
| --- | --- | --- | --- |
| `/boss` | PM | 全チェーン → ship | アイデアから出荷可能な成果物まで進めたい場合 |
| `/boss:pm` | PM | Architect → ... → Ship | 要件分析から始める |
| `/boss:architect` | Architect | UI → ... → Ship | 仕様はあるが設計が必要な場合 |
| `/boss:ui` | UI Designer | Review → ... → Ship | アーキテクチャはあるが UI が必要な場合 |
| `/boss:review` | Tech Lead | Tasks → ... → Ship | 技術レビュー + 実装計画が必要な場合 |
| `/boss:tasks` | Scrum Master | Dev → QA → Ship | タスク分解が必要な場合 |
| `/boss:dev` | Frontend/Backend | QA → Ship | 実装を始める |
| `/boss:qa` | QA | Ship | テストエビデンスが必要な場合 |
| `/boss:ship` | DevOps | （終点） | デプロイのみ |

完全なチェーン:

```
pm → architect → ui → review → tasks → dev → qa → ship
```

「止めて」「このステップだけ」と言うか、`--stop-after <ステージ>` を渡すと継続が停止します。

## クイックスタート

### 1. インストール

Boss はコーディングエージェントにインストールするスキルです。配布はマーケットプレイスのみで、npm パッケージもグローバルバイナリもありません。

**Claude Code — プラグインマーケットプレイス（推奨）:**

```text
/plugin marketplace add echoVic/boss-skill
/plugin install boss@boss-skill
```

**Codex — プラグインマーケットプレイス:**

```bash
codex plugin marketplace add echoVic/boss-skill
```

プラグインブラウザ（`/plugins`）を開いて **boss** をインストールします。

**任意のエージェント — `skills` CLI（[vercel-labs/skills](https://github.com/vercel-labs/skills)、skills.sh）経由:**

```bash
npx skills add echoVic/boss-skill
```

### 2. 既存プロジェクトで試す

最低コストの初回実行は、既存コードに対する読み取り専用レビューです:

```
/boss:review
```

`.boss/<feature>/` 配下にリスク、所見、深刻度を含む `tech-review.md`（と `plan.md`）が生成されます。リポジトリの他のファイルは一切変更されません。

検証可能なテストエビデンスが必要な場合は？ `/boss:qa` がテストを実行し、`qa-report.md` を書き出します。

### 3. フルパイプラインを実行

コーディングエージェント内で:

```text
/boss Build a local personal todo app --skip-ui
```

- `--skip-ui` は UI 設計ステージをスキップします（API 専用/CLI プロジェクト向け）。
- `--quick` は通常の確認プロンプトをスキップします。

### 4. 結果を確認

アーティファクトは `.boss/<feature>/` 配下にあります:

```text
.boss/todo-app/
├── prd.md
├── architecture.md
├── ui-spec.md
├── ui-design.json
├── tech-review.md
├── plan.md
├── tasks.md
├── qa-report.md
└── deploy-report.md
```

各 Markdown アーティファクトは `## 摘要`（サマリー）セクションで始まり、下流のエージェントは結論を先に読み、必要に応じて全文を読みます。

## ワークフロー

```text
ユーザー要求
  → 要件の明確化（--quick を除く）
  → PM: 要件分析 → prd.md
  → Architect: システム設計 → architecture.md
  → UI Designer: UI/UX 仕様 → ui-spec.md + ui-design.json（--skip-ui でスキップ）
  → Tech Lead: 技術レビュー + 実装計画 → tech-review.md + plan.md
  → Scrum Master: タスク分解 → tasks.md
  → Frontend / Backend: TDD 実装
  → QA: テスト実行、バグレポート、エビデンス → qa-report.md
  → DevOps: ビルド、デプロイ、ヘルスチェック → deploy-report.md
```

### ロールとアーティファクト

| ロール | 責務 | アーティファクト |
| --- | --- | --- |
| PM | 要件分析、PRD、隠れたニーズ、エッジケース | `prd.md` |
| Architect | システムアーキテクチャ、技術設計、API | `architecture.md` |
| UI Designer | UI/UX 仕様、レンダリング可能な設計 JSON、HTML プロトタイプ | `ui-spec.md`、`ui-design.json` |
| Tech Lead | 技術レビュー、リスク評価、実装計画 | `tech-review.md`、`plan.md` |
| Scrum Master | タスク分解と受け入れ基準 | `tasks.md` |
| Frontend | UI 実装、TDD、フロントエンドテスト | ソースコード |
| Backend | API、ストレージ、TDD、バックエンドテスト | ソースコード |
| QA | テスト実行、バグレポート、検証エビデンス | `qa-report.md` |
| DevOps | ビルド、デプロイ、ヘルスチェック | `deploy-report.md` |

## 品質契約

Boss の品質管理は 2 層構造です:

- **ロールごとの硬性要求**: 各エージェントのプロンプトには妥協できない要求事項テーブルが定義されています。エージェントは引き継ぎ前にセルフチェックし、契約に失敗した場合は次のステージに進めません。
- **品質ゲート**: 実際に実行されるコマンドであり、その判定はステージのアーティファクトに記録されます。

| ゲート | タイミング | チェック内容 |
| --- | --- | --- |
| Gate 0（コード品質） | 開発後、QA 前 | TypeScript/lint パス、高深刻度の依存関係脆弱性なし |
| Gate 1（テスト） | QA 後、デプロイ前 | 単体 + 結合テストパス、カバレッジ ≥ 70%、P0/P1 バグなし、E2E テスト作成済み |
| Gate 2（パフォーマンス） | Web デプロイ前 | Lighthouse ≥ 80、API P99 < 500ms（Web プロジェクトのみ） |

## Boss を使うべきとき

| 適している | 適さない |
| --- | --- |
| 要件、設計、実装、テスト、納品エビデンスが必要な新機能 | 1 行修正や小さなローカル編集 |
| API、フルスタック、UI、中規模プロダクト作業 | 純粋なコードリーディングや説明 |
| `.boss/<feature>/` アーティファクトが価値を持つ作業 | 既存の完全な仕様があり、クイックパッチだけが必要なタスク |
| 反復可能な品質ゲートと監査証跡を求めるチーム | 調整やレビューエビデンスが不要な作業 |

経験則: トレース可能な `.boss/` フォルダが必要ないなら、完全な `/boss` パイプラインは不要かもしれません。単一のロールを使うか、コーディングエージェントに直接編集させてください。

## セキュリティとプライバシー

Boss はローカルファーストであり、デフォルトで一切の外部ネットワークリクエストを行いません。唯一のネットワーク面は、UI 設計ステージで使用されるオプトインのループバック専用（`127.0.0.1`）HTML プロトタイプサーバです。

リリースの provenance は `.agents/plugins/provenance.json` にあります。リポジトリ HTTPS URL、不変のソースコミット SHA、パブリッシャー ID、プラグインマニフェストの SHA-256 ダイジェストを記録しています。以下で検証できます:

```bash
npm run provenance:verify
```

完全なデータとネットワーク境界については [PRIVACY.md](./PRIVACY.md) を参照してください。

## パイプラインアーティファクト

```text
.boss/<feature>/
├── prd.md              # PM — 製品要件
├── architecture.md     # Architect — システム設計
├── ui-spec.md          # UI Designer — UI/UX 仕様（--skip-ui でスキップ）
├── ui-design.json      # UI Designer — レンダリング可能な設計 JSON
├── tech-review.md      # Tech Lead — 技術レビュー
├── plan.md             # Tech Lead — 実装計画
├── tasks.md            # Scrum Master — タスク分解
├── qa-report.md        # QA — テストエビデンス
└── deploy-report.md    # DevOps — デプロイ記録
```

## Evals

Boss の eval は、実際の LLM を起動することなく、キャプチャされたフィクスチャをスコアリングします:

```bash
npm run evals
npm run evals:release
```

リリース eval には release-evidence と pipeline-compliance のチェックが含まれます——アーティファクトの記録、廃止された runtime コマンドの回避、エキスパートスクワッドのオーケストレーション動作を検証します。

詳細は [test/evals/README.md](./test/evals/README.md) を参照してください。

## 開発

要件:

- Node.js >= 22.18

セットアップ:

```bash
git clone https://github.com/echoVic/boss-skill.git
cd boss-skill
npm install
npm run typecheck
npm test
```

便利なスクリプト:

```bash
npm run typecheck    # tsc --noEmit
npm test             # vitest（単体 + スキル振る舞い + evals）
npm run test:skills  # スキル振る舞いテストのみ
npm run evals        # 決定的トランスクリプト eval
npm run lint         # biome ci
```

## リポジトリ構成

```text
boss-skill/
├── skill/                      # コーディングエージェントにインストールされるスキルバンドル（自己完結）
│   ├── SKILL.md                # メインオーケストレーションエントリ（不変条件 + インデックス）
│   ├── agents/                 # ロールプロンプト（boss-pm、boss-architect、...）
│   ├── commands/               # スラッシュコマンド（/boss、/boss:pm、...）
│   ├── references/             # 共有メソッドロジー（principles、quality-gate、...）
│   ├── skills/                 # ドメイン別メソッドロジースキル（pm/、qa/、devops/、...）
│   └── templates/              # アーティファクトテンプレート（.md.template）
├── test/                       # Vitest、スキル振る舞い、eval テスト
├── scripts/                    # release.js、provenance.js
├── docs/                       # 履歴的な specs、plans、reports
├── examples/                   # サンプルプロジェクト
├── .claude-plugin/             # Claude Code プラグインマニフェスト + マーケットプレイス
├── .codex-plugin/              # Codex プラグインマニフェスト + マーケットプレイス
├── .agents/plugins/            # リポジトリスコープのプラグインマーケットプレイス + provenance
├── tsconfig.json               # 型チェックのみの設定（noEmit）
└── package.json                # プライベート開発ワークスペース（公開されない）
```

## リリース

リリーススクリプトを使って、パッケージメタデータとスキル/プラグインマニフェスト間のバージョン番号を同期させます:

```bash
npm run release -- patch
npm run release -- minor
npm run release -- major
npm run release -- 4.1.0
npm run release -- 4.1.0 --dry-run
```

リリーススクリプトは、ワークツリーのクリーン状態を確認し、完全な検証チェーン（typecheck、lint、test）を実行し、すべてのマニフェストのバージョンを同期し、整合性を検証し、コミットとタグを作成してプッシュします。リリース物は git タグです: マーケットプレイスはリポジトリを読み取ります——npm publish もビルドステップもありません。

詳細は [CONTRIBUTING.md](./CONTRIBUTING.md) を参照してください。

## 設計

Boss は BMAD（Breakthrough Method of Agile AI-Driven Development）と「write less, higher quality code」の哲学に触発されています。エキスパートスクワッドモデルは、ハーネスを軽量に保ちます——runtime 状態機械もイベントソーシングも hooks もなし——それでいて硬性品質契約とアーティファクト駆動のコラボレーションを維持します。

詳細は [DESIGN.md](./DESIGN.md)、`skill/references/bmad-methodology.md`、`skill/references/principles.md` を参照してください。

## Star History

[![Star History Chart](https://api.star-history.com/svg?repos=echoVic/boss-skill&type=Date)](https://star-history.com/#echoVic/boss-skill&Date)

## License

MIT
