# AAARTS — 自律進化型アルファ探索・執行研究基盤

**公開サイト:** https://kafka2306.github.io/investor/

AAARTS（Autonomous Agentic Alpha Trade System）は、金融データ取得、投資仮説の登録、特徴量生成、バックテスト、時系列OOS検証、ポートフォリオ構築、注文・約定記録までを扱う研究基盤です。

このリポジトリは、研究結果と実運用実績を明確に分けます。バックテストが良好だったという理由だけで、売買可能なアルファや実績として昇格させません。

## 研究の流れ

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

## 状態の区分

- **Research** — 仮説作成、データ分析、モデル開発
- **Backtest** — 過去データを使った検証
- **Frozen OOS** — 事前に固定した未来期間での検証
- **Paper Trading** — 実資金を使わない運用試験
- **Live Candidate** — 実運用条件の確認段階
- **Live** — 実際の注文・約定証拠がある状態
- **Retired** — 優位性消失、条件不成立、運用停止

インサンプル結果だけでは昇格できません。実績を主張するには、注文、約定、時刻、手数料、スリッページ、ブローカーまたは取引所の証拠が必要です。

## 主な機能・研究対象

- 市場・企業開示データの取得
- 仮説レジストリ
- 特徴量・モデル生成
- バックテスト
- 時系列OOS検証
- ポートフォリオ構築
- リスク制約
- ペーパートレード
- 執行記録と証拠保存
- 判断理由と失敗条件の記録

## 主要資料

| 内容 | ファイル |
| --- | --- |
| システムのシーケンス | [docs/diagrams/sequence.md](docs/diagrams/sequence.md) |
| 全体フロー | [docs/diagrams/simpleflowchart.md](docs/diagrams/simpleflowchart.md) |
| エージェント運用ルール | [AGENTS.md](AGENTS.md) |
| 設計判断 | [docs/adr/](docs/adr/) |
| 過去のREADME | [docs/archive/README_LEGACY.md](docs/archive/README_LEGACY.md) |

機械可読な定義:

- [プロジェクト・オントロジー](ontology/project.yaml)
- [共通因果・証拠オントロジー](https://github.com/KAFKA2306/know/blob/main/ontology/causal-evidence-core.yaml)

## セットアップ

```bash
task setup
cp .env.example .env
uv sync
```

APIキー、証券口座情報、秘密鍵、個人情報をコミットしないでください。

## 実行

```bash
task run:newalphasearch  # 新しいアルファ仮説を探索
task view                # ダッシュボードを起動
```

## 研究品質の条件

- データの時点と取得元が分かる
- 将来情報の混入を防止している
- 比較対象と取引費用を含む
- 仮説の採択・棄却条件を事前に定義している
- 同じ入力から再現できる
- 欠損・上場廃止・銘柄入替を考慮する
- 実運用の主張には注文・約定証拠がある

時間的リーケージ、データ来歴欠落、再現不能な実行は`reject`または`UNKNOWN`として扱います。

## `investor2`との関係

新しい証拠ダッシュボードと企業業績予測研究は、[KAFKA2306/investor2](https://github.com/KAFKA2306/investor2)でも進めています。本リポジトリは、データ取得から執行までを含む、より広い研究・運用アーキテクチャを保持します。

## 注意

このリポジトリは研究用です。公開されたモデル、仮説、指標は投資助言、売買推奨、将来収益の保証ではありません。

**README最終監査:** 2026-08-01
