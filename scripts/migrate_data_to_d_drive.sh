#!/bin/bash
set -euo pipefail

# ✨ investor_all_cached_data へのデータ統合お引っ越しスクリプトだよっ！ 🐘🛡️💖

TARGET_BASE="/mnt/d/investor_all_cached_data"
REPO_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
LOGS_DIR="$REPO_ROOT/logs"
TS_AGENT_DIR="$REPO_ROOT/ts-agent"

echo "🚛 同期を開始するよっ！ $TARGET_BASE へ出発進行ーっ！ ✨"

# 1. フォルダの準備をするよっ！
mkdir -p "$TARGET_BASE/jquants"
mkdir -p "$TARGET_BASE/edinet/docs"
mkdir -p "$TARGET_BASE/cache"
mkdir -p "$TARGET_BASE/preprocessed"
mkdir -p "$TARGET_BASE/outputs"
mkdir -p "$TARGET_BASE/logs/unified"
mkdir -p "$TARGET_BASE/logs/experiments"
mkdir -p "$TARGET_BASE/logs/verification"
mkdir -p "$TARGET_BASE/logs/benchmarks"

# 2. J-Quants データを運ぶよっ！
if [ -d "/mnt/d/marketdata" ]; then
    echo "📦 J-Quants データをコピー中..."
    rsync -av /mnt/d/marketdata/ "$TARGET_BASE/jquants/"
fi

# 3. EDINET キャッシュとドキュメントを運ぶよっ！
if [ -f "$LOGS_DIR/cache/edinet_cache.sqlite" ]; then
    cp "$LOGS_DIR/cache/edinet_cache.sqlite" "$TARGET_BASE/edinet/cache.sqlite"
fi
if [ -f "$LOGS_DIR/cache/edinet_search.sqlite" ]; then
    cp "$LOGS_DIR/cache/edinet_search.sqlite" "$TARGET_BASE/edinet/search.sqlite"
fi
if [ -d "$LOGS_DIR/cache/edinet_docs" ]; then
    rsync -av "$LOGS_DIR/cache/edinet_docs/" "$TARGET_BASE/edinet/docs/"
fi

# 4. 汎用 SQLite キャッシュを運ぶよっ！
echo "📀 SQLite キャッシュを移動中..."
find "$LOGS_DIR/cache" -maxdepth 1 -name "*.sqlite" ! -name "edinet_*" -exec cp {} "$TARGET_BASE/cache/" \;
if [ -f "$LOGS_DIR/memory.sqlite" ]; then
    cp "$LOGS_DIR/memory.sqlite" "$TARGET_BASE/cache/memory.sqlite"
fi

# 5. 前処理済みデータを運ぶよっ！
echo "🧶 前処理済みデータ（Map等）を移動中..."
cp "$TS_AGENT_DIR"/data/*_map.json "$TARGET_BASE/preprocessed/" 2>/dev/null || true

# 6. パイプライン出力を運ぶよっ！
echo "🖼️ 可視化結果と出力を移動中..."
rsync -av --include='VERIF_*.png' --include='*.json' --include='playbook.yaml' --exclude='*' "$TS_AGENT_DIR/data/" "$TARGET_BASE/outputs/"

# 7. 全てのログを運ぶよっ！
echo "📝 監査・実行ログを移動中..."
rsync -av --exclude='cache' "$LOGS_DIR/" "$TARGET_BASE/logs/"

# 8. シンボリックリンクで「案内看板」を立てるよっ！ 🛡️✨
echo "🪧 シンボリックリンクを作成中..."

# 旧 /mnt/d/marketdata -> 新 jquants/
if [ -d "/mnt/d/marketdata" ]; then
    mv /mnt/d/marketdata /mnt/d/marketdata_old_$(date +%Y%m%d)
fi
ln -s "$TARGET_BASE/jquants" /mnt/d/marketdata

# 旧 logs/cache -> 新 cache/
rm -rf "$LOGS_DIR/cache"
ln -s "$TARGET_BASE/cache" "$LOGS_DIR/cache"

# 旧 ts-agent/data -> 新 outputs/
# ※ preprocessed も混ざっているので注意が必要だけど、基本は outputs/ を指す
mv "$TS_AGENT_DIR/data" "$TS_AGENT_DIR/data_old_$(date +%Y%m%d)"
ln -s "$TARGET_BASE/outputs" "$TS_AGENT_DIR/data"

echo "🎉 お引っ越し完了っ！新しい住所でも元気に動こうねっ！ 💖✨🚀💎"
