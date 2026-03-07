#!/usr/bin/env bash
# ✨ path守護者くん (Hardcoded Path Checker) ✨
# ソースコード内の不適切な絶対パスを検知するよっ！💖

ROOT_DIR="/home/kafka/finance/investor"
SRC_DIR="$ROOT_DIR/ts-agent/src"

echo "🔍 ハードコードされた「悪いパス」を探すよっ！⚡️"
echo "--------------------------------------------------"

# 1. /mnt/d/... の直接参照をチェック！ ❌
echo "📍 /mnt/d/ の直接参照をチェック中..."
grep -r "/mnt/d/" "$SRC_DIR" --exclude-dir=node_modules --include="*.ts" | grep -v "PathRegistry" || echo "✅ /mnt/d/ のハードコードは見つからなかったよ！すごーいっ！✨"

echo ""

# 2. /home/kafka/... の直接参照をチェック！ ❌
echo "📍 /home/kafka/ の直接参照をチェック中..."
grep -r "/home/kafka/" "$SRC_DIR" --exclude-dir=node_modules --include="*.ts" | grep -v "PathRegistry" || echo "✅ /home/kafka/ のハードコードは見つからなかったよ！ピカピカだねっ！💖"

echo "--------------------------------------------------"
echo "🎀 チェック終了！ PathRegistry を信じて進もうねっ！🌈"
