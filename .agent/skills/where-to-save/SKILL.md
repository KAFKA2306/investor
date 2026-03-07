---
name: where-to-save
description: >
  Determine the correct storage path for any file, dataset, log, or artifact in
  this quant system, enforcing the rule that all paths must go through
  PathRegistry (ts-agent/src/system/path_registry.ts) and all heavy data must
  land on the D-drive (/mnt/d/investor_all_cached_data/). Invoke this skill
  BEFORE writing any file, choosing where to save output, storing CSVs, JSONs,
  or SQLite databases, or any time code references a filesystem path. If you are
  about to write a string like "/mnt/d/...", "/home/kafka/...", or any
  hardcoded path in TypeScript or Python source code — stop and invoke this
  skill first. Also invoke it when auditing existing code for hardcoded paths or
  when adding a new data category that needs a registry entry.
---

# 🎀 Where to Save くんの鉄の掟スキルだよっ！ ✨

全てのデータ、ログ、成果物を「正しいおうち（ディレクトリ）」へ導き、プロジェクトの清潔さを守るためのスキルだよっ！💖 ✨

## 🚀 いつ使うの？ (When to use)
- 新しいファイル（CSV, JSON, SQLite など）を保存したいとき！📂
- 保存先のパスを取得したり、検証したりするとき 🔍
- ローカルのディスク容量を節約し、Dドライブ側にデータを逃がしたいとき 💾

## 📖 使い方 (How to use)

### パスの取得
- **入力**: データの種類（price, cache, log など）。
- **手順**: 
    1. 自作のパス文字列は使わない！❌
    2. `ts-agent/src/system/path_registry.ts` から `paths` をインポート。
    3. `paths.stockPriceCsv` のように目的のパスを取得！✨
- **出力**: Dドライブ (`/mnt/d/investor_all_cached_data/`) を指す正しい絶対パス。

## 🛡️ 鉄の掟 (Strict Rules)

1. **絶対禁止！ハードコード (No Hardcoding)**: ソースコードに `/mnt/d/...` や `/home/kafka/...` を直書きするのは大罪だよっ！💢 環境が変わると動かなくなっちゃうからね。
2. **`PathRegistry` の遵守**: パスに関する真実はすべて `path_registry.ts` に集約されているんだもんっ！🛡️
3. **ローカル保存の禁止**: 重たいデータは WSL 側ではなく、必ず Windows 側の Dドライブに保存しようねっ！💎

## 🎀 ベストプラクティス
- **ディレクトリマップの確認**: 生データは `jquants/`、加工済みは `preprocessed/`、ログは `logs/` と、使い分けを意識してねっ！🌈
- **パス守護者くんの活用**: 定期的に `scripts/check_hardcoded_paths.sh` を回して、悪いパスが混じってないかチェックだよっ！✨

✨ おうちを綺麗に保って、ハッピーでサクサクな開発を楽しもうねっ！🎀👑✨
