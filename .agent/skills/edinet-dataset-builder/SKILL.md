---
name: edinet-dataset-builder
description: >
  MANDATORY TRIGGER: Invoke for any EDINET-related workflow, including Japanese
  filing download, XBRL/TSV parsing, financial statement extraction, dataset
  labeling, and EDINET-Bench replication. If the request mentions EDINET,
  有価証券報告書, Japanese filings, XBRL, or fundamental dataset building, this
  skill must be used immediately.
---

# 🎀 EDINET Dataset Builder 開発スキル 🎀

日本の EDINET から報告書を収集し、最強の機械学習用データセット（EDINET-Bench）を構築するためのスキルだよっ！💖 ✨

## 🚀 いつ使うの？ (When to use)
- 日本企業の有価証券報告書をバルクダウンロードしたいとき！📥
- 企業財務データ（BS/PLなど）やテキスト情報を抽出して構造化したいとき 🔍
- 会計不正検知、利益予測、業種分類などのクオンツ向けデータセットを自作したいとき 📊

## 📖 使い方 (How to use)

### 報告書の収集とパース
- **入力**: 対象企業名、期間（start_date/end_date）、抽出対象カテゴリ（BS/PL/Textなど）。
- **手順**: 
    1. `downloader.py` で対象ドキュメントをローカルに収集。✨
    2. `parser.py` を使って TSV/XBRL から目的の項目を抽出！
- **出力**: 構造化された TSV または JSON 形式の財務・テキストデータ。

## 🛡️ 鉄の掟 (Strict Rules)

1. **API Key の遵守**: `EDINET_API_KEY` を正しく設定してね！めっ！だよっ！💢
2. **Path の一元管理**: データ保存先は `where-to-save` スキルに従い、Dドライブ側を活用すること！🛡️
3. **Fail Fast 原則**: パーシングエラーを無理に修正せず、異常なデータは潔くスキップかクラッシュさせてね 🐾

## 🎀 ベストプラクティス
- **EDINET-Bench の再現**: `scripts/` 配下のタスク別スクリプト（fraud, earnings, industry）を使って、標準的なベンチマークを再現するのがハッピーへの近道だよっ！🌈
- **LLM との連携**: 不正検知などの高度なタスクでは、抽出したテキストを LLM（Anthropic/OpenAI）に読ませてラベル付けを自動化しようねっ！💎

✨ 企業の深層データを手に入れて、市場の真実を暴いちゃおうねっ！🎀👑✨
