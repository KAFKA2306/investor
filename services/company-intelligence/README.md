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
node src/cli.js ingest --source edinet --date 2026-06-26 --codes 2801,2897
```

公式CSV変換済みZIP（書類取得API `type=5`）を取得し、UTF-16・タブ区切りのfactを保存します。主要指標はcanonical conceptへマッピングし、未マッピングfactもelement/context付きで保持します。

## The社史参照アダプター

```bash
DATABASE_URL=... node src/cli.js ingest --source the-shashi --codes 2801,2897
DATABASE_URL=... node src/cli.js reconcile --codes 2801,2897
```

The社史は補助・照合ソースです。サイトの二次利用条件を踏まえ、raw payloadと定性情報は`export_allowed=false`を既定とし、公開API・静的exportから除外します。財務数値の正本はEDINETです。

## API

主要エンドポイント:

```text
GET /v1/companies?q=キッコーマン
GET /v1/companies/2801/financials?history=true
GET /v1/companies/2801/facts?concept=revenue
GET /v1/companies/2801/filings
GET /v1/companies/2801/reconciliation
GET /v1/compare?codes=2801,2897&concepts=revenue,operating_profit,total_assets
GET /v1/facts/{factId}/provenance
```

互換エンドポイント:

```text
GET /api/companies.json
GET /api/2801/manifest.json
GET /api/2801/financials.json
GET /api/2801/financials-longterm.json
GET /api/2801/timeline.json
```

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
