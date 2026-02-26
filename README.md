# 投資エージェント：自律型クオンツ・トレードシステム

このシステムは、最新の AI（Gemini）と厳格な TypeScript プログラムを使い、市場データから利益を生み出す自律型の投資システムです。

## 🧬 システムの流れ

データの取得から分析、意思決定、結果の表示までを自動で行います。

```mermaid
sequenceDiagram
    autonumber
    participant GW as 市場データ・ゲートウェイ
    participant MR as モデル・レジストリ
    participant LES as LES エージェント
    participant PEAD as PEAD エージェント（決算）
    participant LOG as 統一ログ
    participant DS as ダッシュボード

    Note over GW, LES: 1. データ取得とアルファ生成
    GW->>LES: 市場・財務データを取得
    LES->>MR: モデル情報の読み込み
    MR-->>LES: 登録情報を返却
    LES->>LES: SAF：投資因子の自動生成
    LES->>LES: 信頼性とリスクの評価

    Note over LES, PEAD: 2. 戦略の実行
    LES->>PEAD: アルファ因子と感情分析を共有
    PEAD->>PEAD: 決算サプライズ分析
    
    Note over PEAD, LOG: 3. 保存と検証
    PEAD->>LOG: 分析結果を保存
    LOG->>LOG: バックテストで妥当性を検証
    
    Note over LOG, DS: 4. 結果の表示
    LOG->>DS: データを生成
    DS-->>DS: 自動デプロイ
    DS-->>User: ダッシュボードで見える化
```

---

## 🎭 働いているエージェント

以下の専門エージェントが協力して市場を分析しています。

| エージェント | 技術 | 役割 |
| :--- | :--- | :--- |
| `LesAgent` | LES フレームワーク | 因子の生成、評価、重み付け |
| `PeadAgent` | 決算サプライズ分析 | 業績発表と感情を合わせたトレンド追随 |
| `XIntelligenceAgent` | SNS 分析 | トレンドの予測 |

---

## 📈 対応している予測モデル

最新の時系列予測モデルをサポートしています。

- **Chronos (Amazon)**：ゼロショット時系列予測
- **TimesFM (Google)**：時系列基盤モデル
- **TimeRAF (Microsoft)**：金融特化型 RAG 予測
- **MOIRAI (Salesforce)**：万能時系列トランスフォーマー
- **Lag-Llama**：確率的時系列予測
- **LES**：LLM によるマルチエージェント型アルファ生成

---

## 🛠️ 技術構成

- **実行環境**：Bun (JavaScript ランタイム)
- **言語**：TypeScript (厳格な型チェック)
- **表示**：Vite & Vanilla CSS (ダッシュボード)
- **AI**：Gemini 2.0 Flash

---

## 🚀 使えるコマンド

| コマンド | 内容 |
| :--- | :--- |
| `task setup` | 環境のセットアップ |
| `task check` | プログラムの品質チェック |
| `task verify` | API と実行環境の確認 |
| `task run` | 分析の実行（メイン処理） |
| `task view` | ダッシュボードの確認 |

## 🌐 公開ダッシュボード

以下の URL で最新の分析結果を確認できます。
- [https://kafka2306.github.io/investor/](https://kafka2306.github.io/investor/)

---
誠実なロジックで、未来の富を。
💖🚀💰✨
