# Skill: ACE Intelligence (powered by OpenCE)

OpenCE（Open Context Engineering）に基づき、エージェントのコンテキストを動的に進化・洗練させるためのクローズドループ知能レイヤー。

## 1. 原拠と理論的背景 (Evidence)

本スキルは、ACE（Agentic Context Engineering）を拡張した次世代標準フレームワークに基づき定義される：
- **OpenCE (Open Context Engineering)**: GitHub: `sci-m-wang/OpenCE`
- **ACE Logic (Building Block)**: ArXiv:2510.04618

### 理論的優位性
- **Closed-Loop Architecture**: 情報の取得から評価、進化までのライフサイクルを 5 つの柱で構造化。
- **Higher Precision**: 固定のプレイブックから、評価（Evaluator）と進化（Evolver）が相互に作用する動的な知識基盤へ移行。

## 2. OpenCE 五大支柱 (The Five Pillars)

本システムは以下の 5 つの役割を厳密に分離し、統合する：

### A. Acquisition (取得)
- **職務**: 市場データ、ログ、ニュース、および既存の Playbook から「原石」となる情報を取得する。
- **実装**: `AceAcquirer` (旧 StrategyMiner) が市場の構造的乖離から新戦略の仮説を生成する。

### B. Processing (処理)
- **職務**: 取得した情報のクレンジング、セマンティックな重複排除、ランク付けを行う。
- **実装**: `ContextPlaybook.getRankedBullets()` による動的な優先度管理。

### C. Construction (構築)
- **職務**: 実行時に最適なコンテキスト（few-shot, instructions）を組み立て、エージェントへ供給する。
- **実装**: シナリオ実行時における ACE Bullets のコンテキスト注入。

### D. Evaluation (評価)
- **職務**: 実行結果（UnifiedLog）を分析し、成功・失敗の原因を特定（Error Analysis）する。
- **実装**: `AceEvaluator` (旧 Reflector) によるシャープレシオベースの事後反省。

### E. Evolution (進化)
- **職務**: 評価信号に基づき、Playbook を継続的にアップデート（ADD/UPDATE/PRUNE）する。
- **実装**: `AceEvolver` (旧 Curator) による知識の「剪定」と新知見の定式化。

## 3. 運用プロトコル (DoD)

1. **Closed-Loop Verification**: 実行ログ（Evaluator）から改善仮説（Evolver/Acquirer）が生成されていること。
2. **Semantic Purity**: 重複した知見が自動的に排除され、常に「純粋なアルファ候補」のみが Playbook に残っていること。
3. **Daily Frontier Expansion**: 毎日最低 1 つの「既存の戦略とは直行する（Orthogonal）」高付加価値な仮説が Playbook に追加されていること。

## 4. 技術スタック

- **Framework**: OpenCE Standard
- **Components**: `AceEvaluator`, `AceEvolver`, `AceAcquirer`
- **Storage**: `ts-agent/data/playbook.json`
