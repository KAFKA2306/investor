# ADR: EDINET-first企業知識・財務API

- Status: Accepted
- Date: 2026-08-03

## Context

企業史サービスの静的JSONは取得しやすい一方、財務数値の定義、訂正報告書、XBRL context、単位、原文来歴を利用側で監査しにくい。食品企業のBS・PL・CF比較でも、`資本合計/総資産`と`親会社所有者帰属持分/総資産`のような定義差を明示する必要があった。

EDINET API Version 2は公式正本だが、日付単位の書類一覧取得、文書ZIP/CSVの展開、XBRL要素の名寄せが必要である。The社史は認証不要の静的JSONを提供するが、正確性を保証せず、定性コンテンツの二次利用条件もある。

## Decision

- `company_intelligence` PostgreSQLスキーマを正本とする
- EDINET API Version 2のCSV変換済みZIP (`type=5`) を主要取得形式とする
- raw documentを不変スナップショットとしてSHA-256付きで保存する
- factにelement ID、context ID、unit、period、連結区分、source priorityを保持する
- canonical conceptへ標準化して企業比較を可能にする
- 公式値と補助値を自動照合し、丸め差・定義差・重要差異へ分類する
- The社史アダプターは補助・照合用途に限定し、既定では定性データを再配信しない
- `/api/*.json`互換層と、provenanceを備えた`/v1`層を併設する
- PostgreSQL 18.4 Docker Official ImageとNode.js 22を利用する

## Consequences

- 財務数値から原文文書までfact単位で追跡できる
- 訂正報告書とrevisionを安全に扱える
- JP GAAP・IFRS・US GAAPの要素差をcanonical conceptで吸収できる
- データ量は増えるが、rawとnormalizedを分離するため再処理可能
- The社史の使いやすさを維持しつつ、再配信条件に違反しない設計になる
