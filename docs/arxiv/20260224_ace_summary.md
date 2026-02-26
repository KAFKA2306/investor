# Agentic Context Engineering (ACE) フレームワーク概要報告書

## エグゼクティブ・サマリー (Executive Summary)
本ドキュメントは、ArXiv 2510.04618にて提唱されたACE (Agentic Context Engineering) フレームワークの要旨とその投資モデルへの応用可能性をまとめたものです。ACEは、LLMのコンテキスト（前提知識や指示）を静的なプロンプトではなく、経験を通じて進化する動的な「Playbook（戦略・ルール・洞察の集合体）」として扱う革新的なアプローチです。

## 概念フレームワーク (Key Concepts)
ACEの根幹を成す主要概念は以下の通りです。

- **Context Playbook (コンテキスト・プレイブック)**: 戦略、厳密なルール（Hard Rules）、および学習された洞察（Insights）をセクションごとに体系化した構造化データ。
- **専門エージェント・アーキテクチャ (Specialized Agents)**:
  - **Generator (生成エージェント)**: 現在のPlaybookを参照し、タスクを実行・意思決定を行う主体。
  - **Reflector (内省エージェント)**: 過去の成果（成功および失敗事象）を分析し、法則性や改善点を抽出する主体。
  - **Curator (編集エージェント)**: Reflectorの分析結果に基づき、Playbookの各項目（ブレット）の追加、更新、削除を管理する主体。
- **適応学習モデル (Adaptive Adaptation)**:
  - **オフライン学習 (Offline)**: 蓄積されたバッチ教示データからの事後的な学習と最適化。
  - **オンライン学習 (Online)**: 推論プロセスにおけるリアルタイムなコンテキストの更新。
- **意味論的重複排除 (Semantic Deduplication)**: ベクトル埋め込み（Embeddings）技術を活用し、Playbook内の情報の重複や肥大化（Bloating）を自動的に検知・整理する仕組み。

## パフォーマンス改善効果 (Performance Benefits)
原著論文において実証されたACEフレームワークの優位性は以下の通りです。

- 汎用エージェント・タスクにおける精度向上: **+10.6%**
- 金融特化ベンチマークにおける精度向上: **+8.6%**
- コンピューティング効率の劇的な改善:
  - 適応レイテンシ (Adaptation Latency): **-86.9%** (削減)
  - トークン・コスト (Token Costs): **-83.6%** (削減)

## 投資エージェントへの実装戦略 (Relevance to Investor Agent)
本プロジェクトにおける既存のマルチ・エージェント・アーキテクチャ（Media, Research, Tradeエージェント群）に対し、ACEを以下の要領で統合することを提言します。

1. **Playbookの永続化**: `ts-agent/src/core/playbook.ts` に、動的に更新可能なPlaybook基盤を実装する。
2. **Reflectorの導入**: 日次のアルファ戦略パフォーマンス、および市場リサーチの予測精度を事後評価するReflectorエージェントを追加する。
3. **Curatorによる自動運用**: ResearchおよびTradeエージェントが利用する投資ルール・戦略を、Curatorを用いて市場環境に応じて自動的に適応・洗練させる。

## 実装・技術参照情報 (Implementation Details)
- **ソースリポジトリ**: [JRay-Lin/ace-agents (GitHub)](https://github.com/JRay-Lin/ace-agents)
- **コア・コンポーネント構成**: `Generator`, `Reflector`, `Curator`の3モジュール。
- **システム統合手法**: ダイレクト・HTTPリクエストを通じた通信、およびローカルJSONストレージによるPlaybookの永続化で導入可能。

---
*作成日: 2026-02-24 / 情報源 (Source): [ArXiv 2510.04618](https://arxiv.org/abs/2510.04618)*
