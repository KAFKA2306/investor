# Alpha Discovery Runbook (直行アルファ探索)

本ワークフローは `investor` において、既存のアルファ仮説とは直行する（相関が低い）全く新しい投資戦略を**自律的に発見・評価・報告**するための手順書です。日次運用のオーバーヘッドを排除し、純粋な仮説生成と検証に特化しています。

## 🤖 エージェントの自律実行手順 (Agent Execution Steps)

以下の手順を順番に実行し、各手順の完了ごとに自律的に結果を分析して次に進んでください。

### 1. 直行アルファ探索の実行 (Alpha Discovery)
`task run:newalphasearch` を実行する。
- **指示 (Agent Prompt)**: 
  - `ts-agent/src/experiments/alpha_mining_experiments.ts` が駆動する `LesAgent` の生成プロセス（ personas × themes ）を監視し、**「どのような新しいアルファ仮説が生成されたか」**（ロジックと経済学的背景）を深く理解すること。
  - 生成された仮説は `financial_domain_schemas.ts` で定義された Zod スキーマで即座に検証される。

### 2. 定量評価とバックテスト (Backtest & Metrics)
発見されたアルファを `backtest_core.ts` を用いて検証し、結果を `evaluation_metrics_core.ts` の `QuantMetrics` エンジンで分析する。
- **指示 (Agent Prompt)**: 
  - `bun run pipeline:ab`（A/Bテスト）を実行し、既存のベースラインに対する優位性と、相関係数（直行性）を確認すること。
  - シャープレシオや最大ドローダウンだけでなく、市場の地合い（Market Regime）に対する耐性を評価すること。

### 3. モデルレジストリとの統合 (Model Registry Integration)
アルファが時系列基盤モデル（Chronos等）の予測とどう連動するか、`model_experiments_core.ts` で確認する。
- **指示 (Agent Prompt)**:
  - `python run_inference.py` を介した高速なバッチ推論結果と、アルファシグナルの適合性を分析すること。
  - 有望なアルファは `ts-agent/data/playbook.json` へ自動登録するための準備を行う。

### 4. ユーザーへの完了報告 (Executive Reporting)
すべての探索と評価が完了したら、以下のフォーマットで簡潔かつ魅力的な「アルファ発見レポート」を作成し、ユーザーに通知 (`notify_user`) すること。

**【レポートフォーマット】**
- **🧪 発見された新アルファ仮説**: (簡潔な1行要約と、その経済学的・行動ファイナンス的根拠)
- **📊 パフォーマンス評価**: (Sharpe ratio, IC などの主要メトリクス、もしくはテスト結果のサマリー)
- **🧩 直行性（既存戦略との違い）**: (なぜこれが既存の成功ルートに依存しない新しいアプローチなのか)
- **🚀 次のアクション提案**: (この仮説を本番パイプラインに追加するための具体的なネクストステップ)

---

## 🧭 探索の三原則 (Guiding Principles for AI)
エージェントは自律探索を行う際、必ず以下の三原則を意識的して推論 (`thought`) すること。

1. **Blind Planning**: 過去の成功ログ（既存のテクニカル指標や単純なボラティリティ・ブレイクアウト）にとらわれず、全く新しい視点（例：マクロ経済の歪み、特定セクター固有の需給イベント、センチメント・ダイバージェンス等）を創造すること。
2. **Context Isolation**: 新しい仮説の評価は独立して行い、既存ロジックと相互汚染させないこと。
3. **Orthogonality Check**: リスクの分散効果を高めるため、既存のメイン因子と「相関が低い」系統を最も高く評価すること。
