# Investor Company Intelligence

EDINETを正本にし、企業の財務三表・XBRL fact・提出書類・セグメント・沿革・役員・大株主を、出典と計算来歴付きで保存・配信するサービスです。

The社史の静的JSONに似た互換エンドポイントを提供しつつ、次を追加します。

- EDINET文書ID、提出日時、訂正関係
- XBRL要素ID、コンテキストID、単位、連結・個別
- 公式値と補助情報の優先順位
- 原文スナップショットのSHA-256
- fact単位のlineageとprovenance API
- EDINET値と補助ソースの差異分類
- 複数企業の共通concept比較
- 実績と会社予想を`dimensions.scenario`で分離
- OpenAPI 3.1
- PostgreSQLと静的JSONの両方への出力

## 起動

```bash
cp .env.example .env
# CANONICAL_DB_PASSWORDを設定
docker compose -f compose.company-intelligence.yaml up -d --build
curl http://localhost:8080/v1/health
curl http://localhost:8080/v1/companies
```

## EDINET取得

EDINET API Version 2はAPIキーが必要です。

```bash
cd services/company-intelligence
npm install
DATABASE_URL=postgresql://investor:password@localhost:5433/investor \
EDINET_API_KEY=... \
node src/cli.js ingest --source edinet --date 2026-08-04 --codes 2801,2897,7011
```

公式CSV変換済みZIP（書類取得API `type=5`）を取得し、UTF-16・タブ区切りのfactを保存します。主要指標はcanonical conceptへマッピングし、未マッピングfactもelement/context付きで保持します。

## 企業IRの一次情報スナップショット

`004_mhi_fy2026_q1.sql` は、三菱重工業（7011）の2026年度第1四半期について、2026年8月4日公表の決算短信と説明資料をSHA-256付きで登録します。

収録範囲:

- Q1実績と前年同期比較: 受注高、売上収益、事業利益、税引前利益、親会社所有者帰属利益、EPS
- BS/CF: 売上債権、契約資産・負債、棚卸資産、現金、営業・投資・財務CF、事業売却収入
- 受注残高、有利子負債、純有利子負債
- セグメント別およびエナジー主要事業別の受注・売上・事業利益
- 2026年度会社予想

`事業利益`は企業固有の定義を持つため、`operating_profit`へ寄せず`business_profit`として保持します。会社予想は`dimensions.scenario = company_forecast`とし、`v_latest_financials`および会社プロフィールの最新実績日から除外します。

## The社史参照アダプター

```bash
DATABASE_URL=... node src/cli.js ingest --source the-shashi --codes 2801,2897,7011
DATABASE_URL=... node src/cli.js reconcile --codes 2801,2897,7011
```

The社史は補助・照合ソースです。サイトの二次利用条件を踏まえ、raw payloadと定性情報は`export_allowed=false`を既定とし、公開API・静的exportから除外します。財務数値の正本はEDINETです。

## API

主要エンドポイント:

```text
GET /v1/companies?q=三菱重工
GET /v1/companies/7011/financials?history=true
GET /v1/companies/7011/facts?concept=business_profit
GET /v1/companies/7011/facts?concept=order_backlog
GET /v1/companies/7011/filings
GET /v1/companies/7011/reconciliation
GET /v1/compare?codes=2801,2897,7011&concepts=revenue,profit_attributable_to_owners,total_assets
GET /v1/facts/{factId}/provenance
```

互換エンドポイント:

```text
GET /api/companies.json
GET /api/7011/manifest.json
GET /api/7011/financials.json
GET /api/7011/financials-longterm.json
GET /api/7011/timeline.json
```

## シナリオ区分

| `dimensions.scenario` | 意味 | 最新実績ビュー |
| --- | --- | --- |
| `actual` | 公表済み実績 | 対象 |
| `company_forecast` | 会社公表予想 | 対象外 |

将来、アナリスト予想や内部推定を入れる場合も別scenarioとし、実績へ混入させません。

## 静的JSON出力

```bash
DATABASE_URL=... node src/cli.js export-static --output ../../docs/api/company-intelligence
```

The社史由来で再配信不可のデータは出力しません。GitHub Pagesで認証不要のread-only APIとして公開できます。

## 品質区分

| quality_flag | 意味 |
| --- | --- |
| `official` | EDINET等の法定開示 |
| `company_official` | 企業IR |
| `secondary` | 補助情報 |
| `derived` | 計算値。lineage必須 |
| `estimated` | 推定値 |
| `conflict` | 出典間で重要な差異あり |

source priorityはEDINET=1、企業IR=10、補助情報=50、推定=100を基本とします。
