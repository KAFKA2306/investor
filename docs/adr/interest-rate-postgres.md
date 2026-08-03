# ADR: 金利・為替市場データをPostgreSQLへ集約する

- Status: Accepted
- Date: 2026-08-03

## Context

日米の名目・実質イールドカーブ、金利差、ドル円の分析データがチャート単位のCSVに分散し、出典・観測時点・補間方法・派生値の入力関係を横断的に監査しにくかった。

`investor` は金融データ取得から仮説、検証、執行証拠までを扱う正本であり、汎用マクロ市場データの保存先として適合する。`WealthAudit` は個人資産監査、`semiconductor-earnings-model` は半導体企業決算に特化しているため対象外とした。

## Decision

- `KAFKA2306/investor` に `market_data` PostgreSQLスキーマを置く
- Docker Official Image `postgres:18.4-bookworm` を固定利用する
- PostgreSQL 18公式イメージの仕様に従い、永続ボリュームを `/var/lib/postgresql` にマウントする
- 出典、系列、観測、取込実行、派生来歴を別テーブルにする
- 日本の実質金利は、公式の連続カーブと誤認させず、補間値・代理値を品質区分で明示する
- 初期seedには現在の分析済みスナップショットと過去1年の月次系列を収録する

## Consequences

- 同じ系列の時点比較とrevision管理が可能になる
- 実質金利差の計算根拠を観測単位で追跡できる
- GitHub ActionsでSQLとseedの再現性を検証できる
- 日本の実質カーブには流動性、元本フロア、銘柄差のバイアスが残るため、公式固定年限カーブとしては扱わない
