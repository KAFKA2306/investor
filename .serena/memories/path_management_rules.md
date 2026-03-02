# パス管理ルール（Path Management Rules）

**最終更新**: 2026-03-02 | **ステータス**: ✅ 統合完了

## 📍 マスター・データロケーション

```
/mnt/d/investor_all_cached_data/  ← 唯一の真実の源（SSOT）
```

全データは以下にセグメント化：
- `jquants/` — J-Quants マーケットデータ
- `cache/` — SQLite キャッシュ層
- `edinet/` — EDINET ドキュメント + API キャッシュ
- `outputs/` — パイプライン検証結果
- `preprocessed/` — 前処理済みデータ
- `logs/` — 監査ログ + アルファディスカバリーログ

## ⚠️ 絶対ルール

### ✅ 正しい（推奨）
```typescript
import { paths } from './src/system/path_registry.ts';

const dataPath = paths.dataRoot;
const cacheDb = paths.marketCacheSqlite;
const logs = paths.unifiedLogDir;
```

### ❌ 間違い（禁止）
```typescript
// ハードコードパス
const dataPath = "/mnt/d/marketdata";
const cacheDb = "/home/kafka/finance/investor/logs/cache/market_cache.sqlite";
const logs = join(process.cwd(), "logs", "unified");
```

## 📖 参照ドキュメント

1. **DATA_STRUCTURE.md** — 完全なディレクトリツリー + PathRegistry フィールド一覧
2. **ts-agent/src/config/default.yaml** — パス設定（原始値）
3. **ts-agent/src/system/path_registry.ts** — PathRegistry 実装
4. **CLAUDE.md** — プロジェクト全体の指針（Path Management セクション追加済み）

## 🔧 新しいパスを追加する場合

1. `default.yaml` の `paths:` セクションに追加
2. `path_registry.ts` の `PathRegistry` 型にフィールドを追加
3. `buildPathRegistry()` で新フィールドを構築
4. `DATA_STRUCTURE.md` を更新
5. このメモリファイルを更新

## 🔐 環境変数オーバーライド

テスト環境など異なるパスが必要な場合：
```bash
export UQTL_DATA_ROOT=/custom/jquants
export UQTL_CACHE_ROOT=/custom/cache
export UQTL_EDINET_ROOT=/custom/edinet
export UQTL_LOGS_ROOT=/custom/logs
export UQTL_VERIFICATION_ROOT=/custom/outputs
export UQTL_PREPROCESSED_ROOT=/custom/preprocessed
```

## 🔍 デバッグ方法

PathRegistry が正しく構築されているか確認：
```bash
bun -e "import { paths } from './ts-agent/src/system/path_registry.ts'; console.log(JSON.stringify(paths, null, 2))"
```

全て `/mnt/d/investor_all_cached_data/` で始まることを確認。

## 🎀 後方互換性

古いパスへのアクセスは symlink で自動リダイレクト：
- `/mnt/d/marketdata` → `jquants/`
- `logs/cache/` → `cache/`
- `logs/unified/` → `logs/unified/`
- `ts-agent/data/` → `outputs/`

新しいコード開発時はこれに頼らず、PathRegistry を使用してください。
