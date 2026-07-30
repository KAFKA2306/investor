# AAARTS: 自律進化型アルファ探索システム

AAARTS（Autonomous Agentic Alpha Trade System）は、金融データ取得、仮説登録、特徴量生成、バックテスト、時系列OOS検証、ポートフォリオ構築、執行を扱う研究基盤です。

## 因果・証拠オントロジー

このリポジトリの上位システムは `QuantitativeResearchAndExecutionSystem` です。

```text
市場・開示の観測
→ 仮説登録
→ 特徴量・モデル生成
→ バックテスト
→ 凍結済み時系列OOS検証
→ ペーパートレード
→ 実運用
→ 注文・約定証拠
→ 昇格・棄却・退役
```

研究、バックテスト、ペーパートレード、実運用は別の状態です。インサンプル結果だけでは昇格できず、実績を主張するには注文、約定、時刻、費用、ブローカーまたは取引所の証拠が必要です。時間的リーケージ、データ来歴欠落、再現不能な実行は `reject` または `UNKNOWN` とします。

- [プロジェクト・オントロジー](ontology/project.yaml)
- [共通因果・証拠オントロジー](https://github.com/KAFKA2306/know/blob/main/ontology/causal-evidence-core.yaml)

## 主要資料

- [設計図（シーケンス）](docs/diagrams/sequence.md)
- [設計図（フロー）](docs/diagrams/simpleflowchart.md)
- [運用ルール](AGENTS.md)
- [ADR一覧](docs/adr/)
- [過去のREADME](docs/archive/README_LEGACY.md)

## セットアップ

```bash
task setup
cp .env.example .env
uv sync
```

## 実行

```bash
task run:newalphasearch
task view
```

詳細な要求、反証条件、主張型、必要証拠、判定規則は `ontology/project.yaml` を正とします。