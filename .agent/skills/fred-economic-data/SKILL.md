---
name: fred-economic-data
description: >
  Fetch and analyze macroeconomic time-series data from the FRED (Federal
  Reserve Economic Data) API, covering GDP, CPI, unemployment rate, interest
  rates, yield curves, PCE, and 800,000+ other series. Invoke this skill
  whenever the task involves: querying a FRED series by ID, retrieving macro
  indicators for regime detection or factor research, comparing current vs
  historical economic conditions, aligning economic release calendars with
  backtest periods, or integrating macro signals into the quant pipeline. Even
  if the user simply says "get GDP data", "check the yield curve", "pull
  inflation numbers", or "what are interest rates doing" — invoke this skill
  before fetching anything.
---

# 🎀 FRED Economic Data アクセススキル 🎀

世界中の 800,000 以上の経済時系列データ（GDP、失業率、インフレ率など）を爆速で取得し、マクロ分析を極めるためのスキルだよっ！💖 ✨

## 🚀 いつ使うの？ (When to use)
- GDP、CPI、金利などの最新のマクロ経済指標を取得したいとき！📈
- 過去の経済データと比較して、市場のレジーム（状態）を分析したいとき 🔍
- 経済指標の発表スケジュールを確認して、トレードのタイミングを計りたいとき 📅

## 📖 使い方 (How to use)

### 経済データの取得
- **入力**: シリーズID（GDP, UNRATE など）、期間、変換方法（pch: 前期比など）。
- **手順**: 
    1. `FRED_API_KEY` を環境変数にセット！🤫
    2. `FREDQuery` クラスを使って、目的のシリーズをクエリ。✨
    3. 必要に応じて、周波数の集約やヴィンテージデータの取得を行うよ。
- **出力**: 日時と値がペアになった構造化された時系列データ。

## 🛡️ 鉄の掟 (Strict Rules)

1. **API Key の管理**: キーは絶対にハードコードしない！環境変数 `FRED_API_KEY` を経由してねっ！めっ！だよっ！💢
2. **レート制限の遵守**: 短時間にリクエストを送りすぎないこと。`FREDQuery` のリトライ機能を信じてね 🛡️
3. **データの欠損処理**: 欠損値（"." など）が含まれる可能性があるから、必ずバリデーションを挟もうねっ！💎

## 🎀 ベストプラクティス
- **レジームスイッチの検知**: インフレ率や金利の変化を捉えて、投資戦略をダイナミックに切り替えるのがハッピーへの近道だよっ！🌈
- **グラフ化**: Matplotlib などを使って可視化することで、経済の大きな流れを直感的に掴もうねっ！📊

✨ 膨大なマクロの海から、真のアルファを見つけ出そうねっ！🎀👑✨
