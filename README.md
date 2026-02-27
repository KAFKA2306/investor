# investor

自律型の投資リサーチ/検証パイプラインを、**TypeScript + Bun** で実装したリポジトリです。  
日次シナリオ実行、API検証、時系列ベンチマーク、LLM運用準備度評価、ダッシュボード可視化までを一気通貫で扱います。

### 📊 Live Dashboard
**[https://kafka2306.github.io/investor/](https://kafka2306.github.io/investor/)**

> 本プロジェクトは研究・検証用途です。投資助言を目的としたものではありません。

## できること

- 日次シナリオの実行と `logs/daily` への構造化ログ保存
- e-Stat / J-Quants 連携を含む API ヘルス検証
- 基盤時系列モデルのベンチマーク（Naive 比較、RMSE/SMAPE/DA）
- LLM エージェント運用準備度（Readiness）のスコアリング
- Vite ダッシュボードによる結果の可視化

## アーキテクチャ（概要）

```mermaid
flowchart LR
  A[外部データ API\nJ-Quants / e-Stat / Yahoo] --> B[Gateway 層]
  B --> C[Use Cases / Experiments]
  C --> D[Agents\n戦略生成・評価]
  C --> E[Pipeline\nbenchmark/readiness/validation]
  D --> F[Zod Schema Validation]
  E --> F
  F --> G[logs/daily・benchmarks・readiness・unified]
  G --> H[Dashboard Vite]
```

## ディレクトリ構成

```text
.
├── ts-agent/                 # コア実装 TypeScript/Bun
│   └── src/
│       ├── agents/           # 戦略ロジック
│       ├── gateways/         # 外部API接続
│       ├── schemas/          # Zodスキーマ
│       ├── pipeline/         # 評価・検証パイプライン
│       ├── experiments/      # 再現実験/検証スクリプト
│       └── tools/dashboard/  # 可視化UI Vite
├── logs/                     # 実行成果物（生成物）
│   ├── daily/
│   ├── benchmarks/
│   ├── readiness/
│   └── unified/
└── docs/                     # 図・レポート
```

## セットアップ

### 前提

- Bun
- Node.js（ダッシュボード用）
- Task（`task` コマンド）
- （任意）Python + `uv`：基盤モデルベンチマークを実行する場合

### 1. 依存関係をインストール

```bash
# core
cd ts-agent
bun install

# dashboard
cd src/tools/dashboard
npm install
```

### 2. 環境変数を設定

`ts-agent/.env` 例:

```env
JQUANTS_API_KEY=your_jquants_api_key
ESTAT_APP_ID=your_estat_app_id
# 任意: 検証対象を絞る場合
VERIFY_TARGETS=jquants,estat
```

## クイックスタート

```bash
# リポジトリルートで実行

task check   # format + lint + typecheck
task run     # 再現実験 + foundation benchmark
task view    # ダッシュボード起動
```

ダッシュボードは通常 `http://localhost:5173` で確認できます。

## 主要コマンド

| コマンド | 目的 |
| --- | --- |
| `task check` | `format` / `lint` / `typecheck` をまとめて実行 |
| `task run` | `les_reproduction` と `foundation_benchmark` を実行 |
| `task view` | ダッシュボード開発サーバーを起動 |
| `cd ts-agent && bun run verify:api` | API接続検証 |
| `cd ts-agent && bun run pipeline:llm-readiness` | Readinessスコア算出 |
| `cd ts-agent && bun run pipeline:full-validation` | 総合検証パイプライン |

## ログと成果物

- `logs/daily/`: 日次シナリオログ（`investor.daily-log.v1`）
- `logs/benchmarks/`: 基盤モデルの比較結果
- `logs/readiness/`: LLM運用準備度レポート
- `logs/unified/`: 統合ログ
- `logs/cache/`: API/マーケットデータのキャッシュ

生成ログはダッシュボードのデータソースとして利用されます。

## 開発ガイド（要点）

- 型安全: `@tsconfig/strictest` + Zod 検証
- フォーマット/静的解析: Biome
- 命名: 実験スクリプトは `snake_case`、ドメインモジュールは意味ベースで命名
- コミット: Conventional Commits（`feat:`, `fix:`, `docs:` など）

詳細は以下を参照:

- `AGENTS.md`
- `Taskfile.yml`
- `ts-agent/README.md`

## 補足ドキュメント

- `docs/diagrams/`: 処理フロー図
- `docs/reports/`: 実験/検証レポート
- `ts-agent/src/model_registry/README.md`: モデルレジストリ運用
- `ts-agent/src/pipeline/README.md`: パイプライン概要
