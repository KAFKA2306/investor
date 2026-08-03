# 金利・為替データベース

`KAFKA2306/investor` のマクロ市場データ正本です。PostgreSQL公式Dockerイメージを使い、日米の名目・実質イールドカーブ、日米金利差、ドル円を、出典と計算来歴を保ったまま保存します。

## 起動

```bash
cp .env.example .env
# .env の CANONICAL_DB_PASSWORD を開発環境固有の値へ変更
docker compose -f compose.interest-rates.yaml up -d
```

接続確認:

```bash
PGPASSWORD="$CANONICAL_DB_PASSWORD" \
psql -h localhost -p "${CANONICAL_DB_PORT:-5432}" \
  -U "${CANONICAL_DB_USER:-investor}" \
  -d "${CANONICAL_DB_NAME:-investor}" \
  -c 'select * from market_data.v_us_japan_real_spread;'
```

停止:

```bash
docker compose -f compose.interest-rates.yaml down
```

初期化SQLは、公式イメージの `/docker-entrypoint-initdb.d` に読み込ませています。公式イメージの仕様上、これらは**空のデータディレクトリを初期化するときだけ**実行されます。スキーマやseedを変更して開発用DBを作り直す場合は、必要なデータを退避してから次を実行します。

```bash
docker compose -f compose.interest-rates.yaml down -v
docker compose -f compose.interest-rates.yaml up -d
```

## PostgreSQLイメージ

- `postgres:18.4-bookworm`
- Docker Official Image
- PostgreSQL 18以降の公式イメージに合わせ、永続ボリュームは `/var/lib/postgresql` にマウント
- ホスト認証は `scram-sha-256`

`latest` は使わず、メジャー・マイナー・ディストリビューションを固定します。更新時はCIのDB smoke testを通してからタグを変更します。

## スキーマ

| オブジェクト | 役割 |
| --- | --- |
| `market_data.source` | 一次情報の提供機関、URL、取得方式 |
| `market_data.series` | 系列定義、年限、単位、算出法 |
| `market_data.observation` | 日付ごとの値、品質区分、観測時刻 |
| `market_data.observation_lineage` | 派生値と入力値の対応、補間ウェイト |
| `market_data.ingestion_run` | 取込単位、実行状態、コード版 |

主要ビュー:

- `market_data.v_curve_observation`
- `market_data.v_latest_curve_point`
- `market_data.v_us_japan_real_spread`
- `market_data.v_monthly_usdjpy_rate_spreads`

## 初期収録データ

1. 2026年7月31日の米国名目パーカーブ
2. 2026年7月31日の米国TIPS実質パーカーブ
3. 2026年7月31日の日本名目コンスタント・マチュリティー
4. 2026年7月30日15時気配の日本物価連動国債第22〜31回の銘柄別実質YTM
5. 5年・7年・10年の日米実質金利差
6. 2025年8月〜2026年7月のドル円月中平均と日米名目2年・10年金利差

## 日本の実質金利の扱い

米国は米財務省が公表するTIPSの固定年限パー実質利回りです。日本には同形式の連続した公式実質カーブがないため、日証協の物価連動国債価格と財務省の銘柄条件から算出した銘柄別実質YTMを使います。

- 5年・7年: 隣接銘柄を残存年数で線形補間
- 10年: 最長の第31回、残存9.612594年を代理値として使用。外挿はしない
- `quality_flag` と `observation_lineage` に計算法と入力系列を保存

したがって、日本10年実質値は厳密な公式10年パーカーブではありません。分析時には名目カーブ、期待インフレ、流動性・元本フロアの影響と分離して扱います。

## データ原則

- 一次情報URLと提供機関を必須化
- 観測日と取得時刻を分離
- 公式値、計算値、補間値、代理値を区別
- 派生値には入力観測へのlineageを付与
- 上書きではなくrevisionで改訂を保持
- APIキー、認証情報、個人情報は保存しない

## 検証

```bash
PGPASSWORD="$CANONICAL_DB_PASSWORD" \
psql -h localhost -U "${CANONICAL_DB_USER:-investor}" \
  -d "${CANONICAL_DB_NAME:-investor}" \
  -f db/interest_rates/900_smoke_test.sql
```

GitHub ActionsでもPostgreSQL公式イメージをサービスコンテナとして起動し、スキーマ、CSV seed、ビュー、件数、主要クエリを検証します。
