# boss-skill

[![npm version](https://img.shields.io/npm/v/@blade-ai/boss-skill)](https://www.npmjs.com/package/@blade-ai/boss-skill)
[![CodeRabbit Pull Request Reviews](https://img.shields.io/coderabbit/prs/github/echoVic/boss-skill?utm_source=oss&utm_medium=github&utm_campaign=echoVic%2Fboss-skill&labelColor=171717&color=FF570A&link=https%3A%2F%2Fcoderabbit.ai&label=CodeRabbit+Reviews)](https://coderabbit.ai)
[![Boss trust badge](https://img.shields.io/endpoint?url=https%3A%2F%2Fhol.org%2Fapi%2Fregistry%2Fbadges%2Fplugin%3Fslug%3Dechovic%252Fboss%26metric%3Dtrust%26style%3Dflat)](https://hol.org/registry/plugins/echovic%2Fboss)

**Languages / 语言 / 言語 / 언어 / Idiomas / Langues:** [English](./README.md) · [中文](./README.zh-CN.md) · [日本語](./README.ja.md) · [한국어](./README.ko.md) · [Español](./README.es.md) · [Français](./README.fr.md) · [Português](./README.pt-BR.md)

![boss-skill promo](https://raw.githubusercontent.com/echoVic/boss-skill/main/boss-skill-promo.png)

**Boss は、コーディングエージェント向けの監査可能なエージェントチームワークフローです。** 1つのコーディングエージェントを、PM、Architect、UI Designer、Tech Lead、Scrum Master、Frontend、Backend、QA、DevOps という構造化されたエンジニアリングチームへと変えます。プロンプトのみのエージェントチームとは異なり、Boss にはランタイム状態、追記専用イベント、品質ゲート、決定的な eval、フック、再生可能なアーティファクトが追加されています。

Boss は Claude Code、Codex、OpenClaw、Antigravity、Hermes で動作します。

## Boss を選ぶ理由

プロンプトのみのオーケストレーションは整然としているように見えても、計画どおりに実行されたこと、テストが実行されたこと、ゲートを通過したこと、状態がハルシネーションではないことを証明できないのが普通です。Boss はエビデンスを中心に構築されています:

- **イベントソーシング方式のランタイム**: パイプライン状態は `.boss/<feature>/.meta/events.jsonl` に追記され、読み取り専用の実行状態へ投影されます。
- **バイパスできないゲート**: QA、デプロイ、最終チェックは、あいまいな指示ではなくランタイムステージとしてモデル化されます。
- **再生可能なアーティファクト**: PRD、アーキテクチャドキュメント、タスクリスト、QA レポート、デプロイレポート、サマリーは `.boss/<feature>/` 配下に保存されます。
- **決定的な eval**: 記録されたトランスクリプトは、実際の LLM を呼び出すことなくスコアリングできます。
- **エージェントフレンドリーな CLI**: コマンドは JSON 出力、`--describe`、ドライラン、制限付きフィールド、構造化エラーをサポートします。

## 1つのロール、またはチーム全体を使う

Boss は単一のモノリシックなコマンドではありません。既存のプロジェクトに対して1つのロールだけを実行することも、アイデアから納品までフルパイプラインを実行することもできます。

| コマンド | 機能 | 使う場面 |
| --- | --- | --- |
| `/boss` | 全4ステージのパイプライン | アイデアから出荷可能な成果物まで進めたい場合 |
| `/boss:plan` | PM + Architect による計画 | 実装前に PRD とアーキテクチャが欲しい場合 |
| `/boss:review` | Tech Lead によるレビュー | コード、PR、デザインの読み取り専用レビューが必要な場合 |
| `/boss:qa` | QA とゲート | 検証可能なテストエビデンスが必要な場合 |
| `/boss:ship` | DevOps によるビルド・デプロイチェック | リリースの準備ができている場合 |
| `/boss:extend` | カスタムエージェント、パック、ゲート | Boss を自チームに合わせて拡張したい場合 |
| `/boss:upgrade` | Boss スキルのアップグレードとフックの再インストール | 最新の npm パッケージとフック設定が欲しい場合 |

## Boss を使うべき場面

| 適しているケース | 適さないケース |
| --- | --- |
| 要件、設計、実装、テスト、納品エビデンスを必要とする新機能 | 1行の修正や小さなローカル編集 |
| API、フルスタック、UI、あるいは中規模のプロダクト開発 | コードを読む・説明するだけの作業 |
| `.boss/<feature>/` のアーティファクトに価値がある作業 | 仕様がすでに完成していて素早いパッチだけで済むタスク |
| 再現可能なゲートと監査証跡を求めるチーム | 調整やレビューのエビデンスが不要な作業 |

経験則: 追跡可能な `.boss/` フォルダが不要なら、おそらくフルの `/boss` パイプラインも不要です。単一ロールを使うか、コーディングエージェントに直接編集させましょう。

## CLI がなくても動作します

Boss は実行時に `boss` CLI を検出します。CLI がない場合、ワークフローはイベントストリームではなく `.boss/<feature>/` 配下の Markdown アーティファクトへ縮退します。CLI は監査可能性を強化するものです。イベントソーシング、再生可能な再開、決定的な eval、ランタイムゲート、構造化診断を提供します。

Boss は「一度インストールすれば自律的な納品が保証される」という意味ではありません。ランタイムワークフローとエビデンスゲートを提供するものであり、アクティブなコーディングエージェントが Boss プロトコルに従う必要は依然としてあります。

## クイックスタート

### 1. インストール

Boss はコーディングエージェントにインストールするスキルであり、他のスキルをインストールするためのツールではありません。

**推奨 — `skills` CLI([vercel-labs/skills](https://github.com/vercel-labs/skills)、skills.sh)を使用:**

```bash
npx skills add echoVic/boss-skill
```

これはスキルをインストールする標準的でエージェント非依存の方法です。リポジトリから `boss` を検出し、対象エージェント / スコープ(プロジェクトかグローバルか)/ インストール方法を尋ね、コミット可能な `skills-lock.json` を記録します。Boss は単一のスキルルートとして配布されるため、ピッカーには `boss` だけが表示され、その内部方法論も一緒に引き継がれます。

**代替案 — Boss 独自のマルチエージェントインストーラー**(Claude Code、Codex、OpenClaw、Antigravity、Hermes を自動検出してすべてにインストールし、Codex のフックもマージします):

```bash
# One-shot, no global install
npx @blade-ai/boss-skill

# Or install globally, then run the self-install wizard
npm install -g @blade-ai/boss-skill
boss-skill
```

Claude Code のプラグインモードの場合:

```bash
claude --plugin-dir "$(boss-skill path)"
```

### 2. 軽量パイプラインを実行する

コーディングエージェント内で:

```text
/boss Build a local personal todo app --roles core --skip-deploy
```

- `--roles core` は PM、Architect、Dev、QA を使用します。
- `--skip-deploy` は実装とテストエビデンスの後に停止します。

### 3. 結果を確認する

```bash
boss status todo-app --json
boss runtime inspect-pipeline todo-app
```

想定されるアーティファクト構成:

```text
.boss/todo-app/
├── design-brief.md
├── prd.md
├── architecture.md
├── tasks.md
├── qa-report.md
└── .meta/
    ├── events.jsonl
    ├── execution.json
    └── workflow-plan.json
```

## インストールの詳細

```bash
npm install -g @blade-ai/boss-skill
boss-skill install
```

便利なインストールコマンド:

```bash
boss-skill install --dry-run
boss-skill uninstall
boss-skill path
boss-skill --version
```

自動検出されるターゲット:

| エージェント | 検出方法 | インストール方法 |
| --- | --- | --- |
| OpenClaw | `~/.openclaw/` | `~/.openclaw/skills/boss/` にコピーし、メタデータを注入 |
| Codex | `~/.codex/` | `~/.codex/skills/boss/` にコピーし、メタデータを注入してフックをマージ |
| Antigravity | `~/.gemini/antigravity/` | Antigravity のスキルディレクトリにコピーし、メタデータを注入 |
| Hermes | `~/.hermes/` | `~/.hermes/skills/boss/` にコピーし、メタデータを注入 |
| Claude Code | 常に利用可能 | `--plugin-dir` によるプラグインモード |

## プラットフォームサポート

Boss は Node.js `>=20` を対象とし、Linux、macOS、Windows で動作します。CLI は明示的な引数配列を伴う `spawnSync` 経由でのみ外部コマンドを呼び出し(`shell: true` は使いません)、Windows では `npm`/`npx` をそれぞれの `.cmd` 版に解決するため、コアパイプラインに POSIX 限定の前提はありません。

2つの機能はオプションの外部ツールに依存しており、それらがない場合は穏やかに縮退します:

- **WIP チェックポイント**(スタッシュ/コミット/ブランチ)には `git` と Git の作業ツリーが必要です。リポジトリの外、または `PATH` に `git` がない場合、チェックポイントは警告なしにスキップされ、パイプラインには影響しません。
- **レガシーな手書き `gate.sh` プラグイン**は `bash` 経由で実行されます。`PATH` に bash がない Windows では起動に失敗するため、移植性のあるプラグインにはクロスプラットフォームの Node ゲートエントリ(`gate.js` / `gate.mjs`)を使用してください。

`boss doctor` を実行すると、解決済みのランタイム環境(Node のバージョン、プラットフォーム、`git` の利用可否)を、インストールとイベントストリームの健全性とともに確認できます。

## コマンド

よく使うスラッシュコマンド:

```text
/boss Build a todo app
/boss Add authentication to this existing project --skip-ui
/boss Build an API service --skip-deploy --quick
/boss Continue the previous task --continue-from 3
/boss Lightweight mode --roles core --hitl-level off
/boss:upgrade
```

よく使うオプション:

| オプション | 意味 |
| --- | --- |
| `--roles <preset>` | 9ロールすべてを使う `full`、または PM/Architect/Dev/QA を使う `core` |
| `--skip-ui` | UI デザインをスキップします |
| `--skip-deploy` | デプロイをスキップします |
| `--quick` | 確認ノードと要件明確化ノードをスキップします |
| `--template` | `.boss/templates/` を初期化して一時停止します |
| `--continue-from <1-4>` | パイプラインのステージから再開します |
| `--hitl-level <level>` | ヒューマンインザループモード: `auto`、`interactive`、`off` |

Boss CLI コマンド:

```bash
boss --help
boss status FEATURE
boss continue FEATURE
boss gate FEATURE
boss qa attack FEATURE
boss project init FEATURE
boss design preview FEATURE
boss packs detect
boss runtime inspect-pipeline FEATURE
boss runtime generate-summary FEATURE
```

エージェント向けの `boss` コマンドは、該当する場合にこれらの共通オプションを使用します。コマンドに `--describe` を付けると正確な JSON スキーマを確認できます:

- `--json`: 構造化出力。非 TTY の stdout はデフォルトで JSON になります
- `--describe`: JSON コマンドスキーマ
- `--dry-run`: 書き込みやリスクのある操作の構造化アクションプラン
- `--json-input=<json|->`: JSON 入力ペイロード
- `--fields=<a,b>` と `--limit=<n>`: 出力の制限
- `--yes`: 追加の確認が必要な高リスクの非対話型コマンドでのみ必須

構造化エラーは stderr に `{"error":{...}}` として書き込まれ、`code`、`message`、`input`、`retryable`、`suggestion` を含みます。

## ワークフロー

Boss は4ステージのワークフローに従います:

```text
User request
  -> requirement clarification
  -> Stage 1: PM, Architect, UI Designer
  -> Stage 2: Tech Lead, Scrum Master
  -> Stage 3: Frontend, Backend, QA, gates
  -> Stage 4: DevOps, deployment checks, summary
```

全ロール一覧:

| ロール | 責務 |
| --- | --- |
| PM | 要件の洗い出し、PRD、潜在的ニーズ、エッジケース |
| Architect | システムアーキテクチャ、技術設計、API |
| UI Designer | UI/UX 仕様とレンダリング可能なデザイン JSON |
| Tech Lead | 技術レビュー、リスク評価 |
| Scrum Master | タスク分解と受け入れ基準 |
| Frontend | UI 実装とフロントエンドテスト |
| Backend | API、ストレージ、バックエンドテスト |
| QA | テスト実行、バグ報告、検証エビデンス |
| DevOps | ビルド、デプロイ、ヘルスチェック |

## ランタイムと品質ゲート

Boss には2層の品質管理があります:

- **ハード制約**(コードと CI によって検証されます): ランタイムイベント、保護された `execution.json`、フック、インストールマトリックステスト、ハーネスシナリオ、Vitest カバレッジ。
- **エージェントプロトコル制約**(スキルバンドルによって誘導されます): DAG ディスパッチ、段階的なリファレンス読み込み、テストエビデンス、ゲート規律。

組み込みゲート:

| ゲート | タイミング | チェック内容 |
| --- | --- | --- |
| Gate 0 | 開発後、QA 前 | TypeScript、lint、基本的なコンパイルチェック |
| Gate 1 | QA 後、デプロイ前 | テストエビデンス、P0/P1 バグなし、E2E 期待値 |
| Gate 2 | Web デプロイ前 | 該当する場合の Lighthouse と API レイテンシの目標値 |

フックは環境変数で制御されます:

| 変数 | 値 |
| --- | --- |
| `BOSS_HOOK_PROFILE` | `minimal`、`standard`、`strict` |
| `BOSS_DISABLED_HOOKS` | カンマ区切りのフック ID |

ランタイム状態は `.boss/<feature>/.meta/workflow-plan.json` と `.boss/<feature>/.meta/execution.json` によって支えられています。ワークフロー定義には `workflowHash`、`packHash`、アーティファクト DAG ハッシュが記録されます。ランタイムの再開では `boss runtime resume <feature> --from-run <run-id>` を使用してプランを再読み込みし、ノード入力を比較して、次にスケジュール可能なノードのための `execution.workflow.nextNodeIds` を具体化します。`GateEvaluated` / `WaveVerified` イベントは、ゲートとエビデンスウェーブの完了時にワークフローノードのステータスを更新します。

## セキュリティ上重要な領域

Boss は公開するプラグインマニフェストを意図的に小さく保っています。宣言するのは同梱スキルのみで、MCP サーバー、アプリマニフェスト、アセット参照は、対応するファイルが存在しない限り記載しません。Codex のフックは、マーケットプレイスマニフェストではなく `boss-skill install` のフローによってインストールされます。

npm パッケージには、`.claude/settings.json` や `.claude/settings.local.json` といったローカル開発用のエージェント設定は含まれません。公開可能なプラグインメタデータは `.claude-plugin/`、`.codex-plugin/`、`.agents/plugins/marketplace.json` に置かれます。

リリースの来歴は `.agents/plugins/provenance.json` にあります。ここには、リポジトリの HTTPS URL、イミュータブルなソースコミット SHA、パブリッシャーの身元、プラグインマニフェストとセキュリティ上重要なコンポーネントの SHA-256 ダイジェストが固定されています。次のコマンドで検証できます:

```bash
npm run provenance:verify
```

パブリッシャーの検証はパッケージの外部で行われます。HOL レジストリでは、リポジトリ所有者の GitHub アカウントで `https://hol.org/guard/plugins` からプラグインを申請してください。公開トラストカードは `https://hol.org/registry/plugins/echovic%2Fboss/embed` で入手できます。

公開またはインストールの前に確認すべきセキュリティ上重要な動作:

- `boss-skill install` は `~/.codex/skills/boss/` などのエージェント設定ディレクトリに書き込みを行い、`~/.codex/hooks.json` に Boss 管理のエントリをマージする場合があります。
- フックエントリは `boss hooks run ...` を実行し、`scripts/hooks/` のスクリプトをディスパッチします。
- `.boss/plugins/<name>/plugin.json` 配下のランタイムプラグインは、ゲートフックやレポーターフックを登録できます。有効化する前にプロジェクトローカルのプラグインを確認してください。
- 機密性の高い環境でフックの動作を減らす必要がある場合は、`BOSS_HOOK_PROFILE=minimal` または `BOSS_DISABLED_HOOKS=<ids>` を使用してください。

Boss はローカルファーストで、デフォルトでは外部へのネットワークリクエストを行いません。唯一のネットワーク面は、オプトインでループバック限定の `boss design preview` サーバーです。データとネットワークの境界の全体像は [PRIVACY.md](PRIVACY.md) を参照してください。

## パイプラインのアーティファクト

```text
.boss/<feature>/
├── design-brief.md
├── prd.md
├── architecture.md
├── ui-spec.md
├── ui-design.json
├── tech-review.md
├── tasks.md
├── qa-report.md
├── deploy-report.md
├── summary-report.md
└── .meta/
    ├── events.jsonl
    ├── execution.json
    └── workflow-plan.json
```

生成された UI デザインをプレビューするには、対話型環境で次を実行します:

```bash
boss design preview <feature>
```

## Evals

Boss の eval は、実際の LLM を起動せずに、記録されたフィクスチャをスコアリングします:

```bash
npm run evals
npm run evals:release
```

リリース eval にはリリースエビデンスとパイプラインコンプライアンスのチェックが含まれます。ランタイムコマンドの使用、アーティファクトの記録、`execution.json` の直接編集の回避、ワークフローのスケジューリングフィールドを検証します。

[test/evals/README.md](./test/evals/README.md) を参照してください。

## 開発

必要条件:

- Node.js >= 20
- シェルベースのテストヘルパー用の `jq`

セットアップ:

```bash
git clone https://github.com/echoVic/boss-skill.git
cd boss-skill
npm install
npm run build
npm run typecheck
npm test
```

便利なスクリプト:

```bash
npm run build
npm run typecheck
npm test
npm run test:skills
npm run test:harness
npm run test:install-matrix
npm run evals
```

## リポジトリ構成

```text
boss-skill/
├── packages/boss-cli/          # TypeScript CLI and runtime
├── skill/                      # Skill bundle installed into coding agents
├── scripts/hooks/              # Node.js hook scripts
├── scripts/lib/                # Hook helpers
├── test/                       # Vitest, harness, eval, hook, and install tests
├── docs/superpowers/           # Historical specs, plans, and reports
├── examples/                   # Example projects
├── .claude-plugin/             # Claude Code plugin manifest
├── .codex-plugin/              # Codex plugin manifest
└── package.json
```

重要なソース領域:

- `packages/boss-cli/src/` には CLI とランタイムの TypeScript ソースが含まれます。
- `packages/boss-cli/dist/` には公開 npm bin が使用する生成済み CLI 出力が含まれます。手動で編集しないでください。
- `packages/boss-cli/assets/` には組み込みの DAG、パイプラインパック、プラグインスキーマ、プラグインが含まれます。
- `skill/SKILL.md` はエージェント向けオーケストレーションのメインエントリです。
- `skill/agents/` にはロールプロンプトが含まれます。
- `skill/commands/` にはスラッシュコマンドが含まれます。
- `skill/templates/` にはアーティファクトテンプレートが含まれます。

## リリース

パッケージメタデータとスキル/プラグインマニフェストの間でバージョン番号の同期を保つために、リリーススクリプトを使用してください:

```bash
npm run release -- patch
npm run release -- minor
npm run release -- major
npm run release -- 3.11.0
npm run release -- 3.11.0 --dry-run
npm run release -- 3.11.0 --no-publish
```

リリーススクリプトは、作業ツリーがクリーンであることを確認し、テストを実行し、バージョンを同期し、整合性を検証し、コミットとタグを作成し、`--no-publish` が指定されていない限り公開します。

[CONTRIBUTING.md](./CONTRIBUTING.md) を参照してください。

## 設計思想

Boss は BMAD(Breakthrough Method of Agile AI-Driven Development)に触発されています。このプロジェクトは、そのアイデアをエージェントによるソフトウェア開発のための監査可能なランタイムへと応用したものです。

詳細は [DESIGN.md](./DESIGN.md) と `skill/references/bmad-methodology.md` をご覧ください。

## スター履歴

[![Star History Chart](https://api.star-history.com/svg?repos=echoVic/boss-skill&type=Date)](https://star-history.com/#echoVic/boss-skill&Date)

## ライセンス

MIT
