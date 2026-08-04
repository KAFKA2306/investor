# Investor — 証拠優先の投資研究・企業知識基盤

`KAFKA2306/investor`は、企業開示、金利・為替、市場データ、投資仮説、バックテスト、企業知識、公開ダッシュボードを、**出典、時点、計算、予測、実運用証拠を分離して扱うための統合研究ワークスペース**です。

公開画面だけのリポジトリではありません。次の複数の責務を同じ証拠モデルの下で管理します。

1. **AAARTS研究基盤** — 仮説登録、特徴量、バックテスト、OOS検証、ペーパートレード、執行証拠
2. **企業知識・財務DB/API** — EDINETを中心とする企業、開示、財務fact、事業セグメント、企業史、来歴
3. **金利・為替データ基盤** — 公式データと派生系列をPostgreSQLで管理
4. **Evidence-first Pages** — 調査結果と実運用準備状況を混同しない公開閲覧画面

> **公開サイト:** https://kafka2306.github.io/investor/  
> **主要言語:** TypeScript / JavaScript / Python / SQL  
> **Python:** 3.12以上  
> **主要runtime:** Bun、Node.js、PostgreSQL、Docker Compose  
> **用途:** 研究・監査・比較。投資助言や収益保証ではありません。

---

## このリポジトリの基本原則

### 研究結果と実運用を分ける

良いバックテスト結果を、そのまま売買可能なアルファや運用実績として扱いません。

```text
市場・企業開示を観測
  → 仮説を事前登録
  → 特徴量・モデルを作成
  → バックテスト
  → 凍結した時系列OOS検証
  → ペーパートレード
  → 実運用候補
  → 注文・約定・費用を記録
  → promote / reject / retire
```

### 事実、派生値、予測、文章を分ける

- **公式fact** — EDINET、企業IR、公式統計などから取得した値
- **派生値** — 複数factから計算した値
- **推定・予測** — モデル、前提、評価期間を持つ値
- **解釈** — 人間またはLLMによる文章
- **執行証拠** — 注文、約定、時刻、費用、スリッページ

同じ数値欄や同じラベルへ混在させません。

### 観測専用の公開画面

GitHub Pagesは調査結果を閲覧するための静的画面です。公開画面から注文を送信したり、実運用へ昇格させたりしません。

---

## 現在の主要コンポーネント

## 1. AAARTS研究基盤

AAARTSは、投資仮説を探索し、検証し、採択または棄却する研究系です。

主な状態:

| 状態 | 意味 |
|---|---|
| `Research` | 仮説作成、データ分析、モデル開発 |
| `Backtest` | 過去データを使った検証 |
| `Frozen OOS` | 事前に固定した未来期間での検証 |
| `Paper Trading` | 実資金を使わない運用試験 |
| `Live Candidate` | 実運用条件の確認段階 |
| `Live` | 実際の注文・約定証拠がある |
| `Retired` | 優位性消失、条件不成立、運用停止 |

インサンプル結果だけでは昇格できません。実績を主張するには、注文、約定、時刻、手数料、スリッページ、ブローカーまたは取引所の証拠が必要です。

主要実装は`ts-agent/`にあります。

---

## 2. 企業知識・財務データベース/API

`db/company_intelligence/`と`services/company-intelligence/`は、企業情報を一次資料と来歴付きで扱います。

### 正準方針

- EDINETの開示を財務factの主要な正準候補として扱う
- 企業公式IRを四半期速報、会社予想、受注、セグメント説明などの根拠として保持する
- The社史などの外部資料は照合・企業史用途として区別する
- 原文レスポンス、取得時刻、SHA-256、公開可否を保持する
- 事業利益と営業利益、実績と会社予想、連結と単体を分離する
- 修正開示、撤回、会計基準、期間、単位、コンテキストを保持する

### 主な構成

```text
compose.company-intelligence.yaml
db/company_intelligence/
  001_schema.sql
  002_views.sql
  003_seed.sql
  900_smoke_test.sql
services/company-intelligence/
  src/server.js
  src/cli.js
  openapi.yaml
```

### 起動

秘密値を`.env`へ設定してから起動します。

```bash
docker compose -f compose.company-intelligence.yaml up --build
```

主な既定入口:

- API health: `http://localhost:8080/v1/health`
- OpenAPI: `http://localhost:8080/openapi.yaml`
- 互換企業一覧: `http://localhost:8080/api/companies.json`

ポートは環境変数で変更できます。READMEのURLだけを根拠に、サービス起動済みとは判断しません。

### CIで確認する内容

- Docker Compose設定
- PostgreSQL schemaの適用と冪等性
- SQL smoke test
- Node.js service test
- API health
- 互換JSON
- OpenAPI配信

---

## 3. 金利・為替データベース

`db/market_data/`を中心に、公式系列と派生系列をPostgreSQLへ保存します。

目的:

- 名目金利、実質金利、期待インフレ、為替の時点を統一する
- 公式観測値と計算値を分離する
- 出典、取得時刻、系列ID、単位、改訂を保持する
- 日米金利差、実質金利差、イールドカーブなどを再計算可能にする

派生系列だけを保存して、元の公式系列や計算式を失わないようにします。

詳細は関連するDB設計文書とADRを参照してください。

---

## 4. 公開ダッシュボード

公開サイトは、2026年8月4日にEvidence-firstのResearch Consoleへ刷新されています。

主な目的:

- 調査結果と執行準備状態を分けて表示する
- 根拠不足を「未確認」「証拠なし」として明示する
- 静的Pagesを観測専用にする
- 装飾的な表現より、数値、状態、警告、証拠リンクを優先する
- desktopと375px幅の両方で表示を検証する

公開workflowでは、生成したHTMLの文書識別と実際の公開URLを照合します。

---

## 必要環境

基本開発:

- Python 3.12以上
- `uv`
- Bun
- Node.js / npm
- `go-task`
- Git

データベースを使う場合:

- Docker
- Docker Compose
- PostgreSQL clientを直接使う場合は`psql`

画面検証を行う場合:

- Playwrightが利用できるブラウザ環境

ローカルLLM、GPU推論、時系列基盤は任意です。特定マシンの絶対パスやGPU構成は、リポジトリ共通の動作保証ではありません。

---

## セットアップ

```bash
task setup
cp .env.example .env
```

`task setup`は、TypeScript系、ダッシュボード、Python環境の依存関係を導入します。

個別に行う場合:

```bash
uv sync
cd ts-agent && bun install
cd ts-agent/src/dashboard && npm install
```

`.env`には実際の秘密値を入れます。APIキー、証券口座情報、データベースpassword、秘密鍵をコミットしません。

---

## 主なコマンド

### 利用可能なtaskを確認する

```bash
task --list-all
```

### 全体検証

```bash
task check
```

主に次を実行します。

- TypeScript format / lint
- typecheck
- unit test
- self-healing lint
- Python Ruff
- Pyright

### 軽量な研究系smoke test

```bash
task smoke
```

### APIとUIを同時に起動する

```bash
task view
```

既定ではAPIとVite UIをローカル起動します。終了時には起動したprocessと使用portをcleanupします。

### APIだけ起動する

```bash
task api
```

### UIだけ起動する

```bash
task ui
```

### 新しいアルファ探索

```bash
task run:newalphasearch
```

自然言語入力を渡す場合:

```bash
NL_INPUT="検証したい仮説" task run:newalphasearch:nl
```

### EDINET研究パイプライン

```bash
task pipeline:edinet-daily
```

I/O検証まで含む厳格経路:

```bash
task pipeline:edinet-daily:strict
```

期間、取得上限、採用条件はTaskfileの変数で上書きできます。

### Pythonのallocation入口

```bash
task allocation:run
```

---

## 検証の考え方

## データ品質

- データの時点と取得元が分かる
- 原文またはraw responseを保持できる
- 将来情報の混入を防ぐ
- 会計期間、単位、連結区分、改訂を区別する
- 欠損、上場廃止、銘柄入替を扱う
- 推測で欠損を埋めない

## モデル品質

- 比較対象を定義する
- 取引費用、税、スリッページの有無を明示する
- 学習期間と評価期間を分離する
- frozen OOSを後から変更しない
- 仮説の採択、棄却、retire条件を残す
- 同じ入力から再現可能にする

## 公開品質

- production buildが成功する
- UI copy contractを満たす
- desktopと375pxのrendered evidenceを確認する
- 公開HTMLが意図した文書である
- 公開URLとdeploy commitを記録する

CI成功だけでは、分析内容の正しさや公開データの鮮度を保証しません。

---

## ディレクトリ構成

```text
ts-agent/                         TypeScript研究runtime、API、dashboard
  src/dashboard/                  公開・ローカルUI
  src/system/                     runtime core、設定、証拠層
  data/                           検証出力など
main.py                           Python側のallocation入口
ontology/                         プロジェクトの機械可読な意味定義
db/company_intelligence/          企業知識DB schema、view、seed、test
db/market_data/                   金利・為替DB
services/company-intelligence/    企業知識APIとCLI
compose.company-intelligence.yaml 企業知識DB/APIのCompose
scripts/                          検証、生成、公開、補修
docs/                             設計、図、ADR、運用文書
Taskfile.yml                      人間向けの主要操作入口
AGENTS.md                         エージェント操作契約
```

実際のディレクトリは変更される場合があります。責務を変更したPRではREADMEと設計文書を同時に更新します。

---

## 正準と生成物

| 対象 | 正準または管理場所 |
|---|---|
| 横断的な研究runtime | `ts-agent/` |
| 企業知識DB schema | `db/company_intelligence/` |
| 企業知識API | `services/company-intelligence/` |
| 金利・為替DB | `db/market_data/` |
| プロジェクト意味定義 | `ontology/project.yaml` |
| 因果・証拠の共通語彙 | `KAFKA2306/know`のontology |
| 公開画面の実装 | `ts-agent/src/dashboard/` |
| 人間向け操作入口 | `README.md`、`Taskfile.yml` |
| エージェント操作契約 | `AGENTS.md` |

バックテスト出力、ログ、ローカルDB volume、ダウンロードしたraw data、秘密情報は、内容と利用条件に応じてGit管理外にします。

---

## `investor2`との関係

`KAFKA2306/investor2`は、別系統の企業業績予測・証拠ダッシュボード研究として存在します。

このリポジトリは、企業知識、金利・為替、アルファ探索、検証、執行証拠までを含む広い統合ワークスペースです。どちらを正準にするかは機能単位で明示し、同じデータやロジックを暗黙に二重管理しません。

---

## README.mdとAGENTS.md

- `README.md`は、人間が目的、構成、使い方、検証、制約を理解する正準入口です。
- `AGENTS.md`は、AIエージェントが変更時に守る操作順序、禁止事項、完了ゲートを定義します。

重要な人間向け情報をAGENTS.mdだけへ置きません。

---

## セキュリティ

公開リポジトリへ次を保存しません。

- EDINETなどのAPIキー
- 証券口座情報
- broker token
- データベース本番password
- 秘密鍵
- 個人情報
- 非公開の投資ポジション
- 認証済みsession
- ライセンス上再配布できないraw document

`.env.example`は変数名と安全な説明だけを保持します。実値は`.env`、GitHub Secrets、実行環境のsecret管理へ置きます。

---

## 既知の制約

- 本リポジトリの全機能を一つのコマンドで本番運用する完成済み取引システムではありません。
- 公開Pagesは観測専用で、注文執行機能を持ちません。
- 実運用状態を主張するには、外部brokerまたは取引所の証拠が必要です。
- 外部APIの取得可否、利用条件、rate limit、データ改訂に依存します。
- ローカルLLMやGPU推論は環境依存で、Taskfile内の例示パスは全環境で動く契約ではありません。
- 企業知識DBのseedや互換JSONは、すべての上場企業を常に網羅する保証ではありません。
- READMEの記述は、実データの鮮度そのものを保証しません。

---

## 主要資料

- [`AGENTS.md`](AGENTS.md) — エージェント運用契約
- [`ontology/project.yaml`](ontology/project.yaml) — プロジェクト・オントロジー
- [`docs/diagrams/sequence.md`](docs/diagrams/sequence.md) — システムのシーケンス
- [`docs/diagrams/simpleflowchart.md`](docs/diagrams/simpleflowchart.md) — 全体フロー
- [`docs/adr/`](docs/adr/) — 設計判断
- [`docs/adr/company-intelligence-platform.md`](docs/adr/company-intelligence-platform.md) — 企業知識基盤
- [`docs/archive/README_LEGACY.md`](docs/archive/README_LEGACY.md) — 過去README
- [`Taskfile.yml`](Taskfile.yml) — 主要コマンド

---

## 免責

本リポジトリのモデル、指標、仮説、文章、公開画面は、投資助言、売買推奨、運用実績、将来収益の保証ではありません。利用者は一次資料と自身の条件を確認してください。

**README実体監査:** 2026年8月4日
