# 🎀 Investor Agent: Autonomous Intelligence Ecosystem ✨

**Investor Agent** は、LLM（Gemini 2.0 Flash）によるインテリジェンスと厳格な TypeScript プロトコルを活用し、市場データを「富」へと変換する自律型クオンツ・トレードシステムである。

## 🧬 システム・シーケンス (Execution Flow)

市場データの取得からエージェントによる多層分析、最終的な意思決定とダッシュボード反映までの全工程を以下のシーケンスで定義する。

```mermaid
sequenceDiagram
    autonumber
    participant GW as Market Data Gateway
    participant MR as Model Registry (models.json)
    participant LES as LesAgent (LES Framework)
    participant PEAD as PeadAgent (Earnings)
    participant LOG as Unified Log (Zod)
    participant DS as Dashboard (GitHub Pages)

    Note over GW, LES: 1. Data Ingestion & Alpha Generation
    GW->>LES: Raw Market & Financial Data
    LES->>MR: 1.5 Load Model Metadata (arxiv/github)
    MR-->>LES: Registry Info
    LES->>LES: SAF (Seed Alpha Factory): 因子の動的生成
    LES->>LES: CSA/RPA: 信頼度・リスク評価

    Note over LES, PEAD: 2. Strategy Execution
    LES->>PEAD: Alpha Factors & Sentiment
    PEAD->>PEAD: Hybrid Surprise Analysis
    
    Note over PEAD, LOG: 3. Persistence & Verification
    PEAD->>LOG: SymbolAnalysis (Zod Schema)
    LOG->>LOG: runSimpleBacktest (Validation)
    
    Note over LOG, DS: 4. Deployment
    LOG->>DS: Generate YYYYMMDD.json & Manifest
    DS-->>DS: Deploy via GitHub Actions
    DS-->>User: Visualized Intelligence
```

---

## 🎭 知能ユニット (Active Agents)

現在は以下の特化型エージェントが連携して、多角的な市場分析を実行しているよっ！

| エージェント | 技術基盤 | 役割 |
| :--- | :--- | :--- |
| `LesAgent` | **ArXiv:2409.06289** | LES フレームワークによる因子生成、評価、動的重み付け。 |
| `PeadAgent` | **Hybrid Surprize** | 決算サプライズと LES センチメントを融合したドリフト捕捉。 |
| `XIntelligenceAgent` | **Social Analytics** | SNS 熱量とセンチメントの定量化によるトレンド予測。 |

---

## 📈 Supported Forecasting Models (Registry)

`Model Registry` を通じて、以下の最新の時系列予測（TS Forecasting）基盤モデルおよびアルファ生成フレームワークをサポートしているよっ ✨

- **Chronos (Amazon)**: ユニバリエート（単変量）時系列データのゼロショット予測。
- **TimesFM (Google)**: Transformer ベースの事前学習済み時系列基盤モデル。
- **TimeRAF (Microsoft)**: 金融データに特化した RAG (Retrieval-Augmented) 型予測。
- **MOIRAI (Salesforce)**: あらゆる時系列データに対応可能な万能トランスフォーマー。
- **Lag-Llama**: Llama アーキテクチャを時系列に転用した確率的予測。
- **LES (ArXiv:2409.06289)**: LLM によるマルチエージェント型アルファ因子生成。

> [!TIP]
> 各モデルの技術論文（ArXiv）や GitHub へのリンクは、[Model Registry README](./ts-agent/src/model_registry/README.md) を参照してねっ！

---

## 🛠️ 技術スタック & アーキテクチャ

- **ランタイム**: [Bun](https://bun.sh/) (最速の JS ランタイム)
- **言語**: [TypeScript](https://www.typescriptlang.org/) (Strict モード, Zod バリデーション)
- **ダッシュボード**: [Vite](https://vitejs.dev/) & Vanilla CSS
- **インテリジェンス**: Gemini 2.0 Flash (Primary LLM)
- **コア原則**:
    - **Fail-Fast**: バリデーションエラー発生時は即座に終了。
    - **不変性 (Immutability)**: シグナルと設定は作成後、厳格に読み取り専用。
    - **網羅性 (Comprehensiveness)**: [AGENTS.md](./AGENTS.md) に基づく完全な実装。

---

## 🚀 利用可能なタスク (Taskfile)

| コマンド | 説明 |
| :--- | :--- |
| `task setup` | 環境の初期化と依存関係のインストール。 |
| `task daily` | デイリー統合ワークフロー (Lint -> Check -> Start -> AB -> Readiness)。 |
| `task repro:les` | **ArXiv:2409.06289 (LES)** の再現実験を実行しログを生成。 |
| `task full:validate` | 全実験・検証シナリオを再実行し `logs/unified/` を出力。 |
| `task dashboard:dev` | ダッシュボードの開発サーバーを起動。 |
| `task check` | 厳格な TypeScript 型チェック (`tsc --noEmit`)。 |

## 🌐 Dashboard (GitHub Pages)

最新の分析結果は以下のパブリック URL で確認できるよっ ✨
- **URL**: [https://kafka2306.github.io/investor/](https://kafka2306.github.io/investor/)

---
世界で一番美しく、正確なロジックで。
私たちのコードが、未来の富を成就させる。 💖🚀💰✨
