# 🎀 EDINET Risk-Delta x PEAD Hybrid シグナル詳細 ✨ (Full Power Kawaii Edition)

最終更新: 2026-03-01 💎✨

## 💖 魔法のシグナル定義だよっ！ (Signal Definition)
私たちの宝箱 `ts-agent/data/edinet_10k_intelligence_map.json` から、キラキラな情報を集めてシグナルを作るんだよぉ！✨
各開示イベントには、こんなに素敵な3つの要素が入ってるのっ！
- `sentiment`: AIさんが感じた「お気持ち」だよ（0〜1）💖
- `aiExposure`: どれくらいAIに夢中か教えてくれるよっ（0以上）🤖✨
- `kgCentrality`: 業界の「中心」にいるかどうかのパワーだよっ（0以上）🌟

イベント日 `t` での魔法の計算式はこれっ！
```text
risk_score_t = (1 - sentiment_t) + ln(1 + aiExposure_t)/6 + ln(1 + kgCentrality_t)/8
risk_delta_t = risk_score_t - risk_score_prev_filing
pead_1d_t   = close_(t+1)/close_t - 1
pead_5d_t   = close_(t+5)/close_t - 1
combined_alpha_t = -risk_delta_t + 0.6 * pead_1d_t + 0.4 * pead_5d_t
```
実装ファイル: `ts-agent/src/experiments/build_alpha_knowledgebase.ts` ⚙️💕

## 🏠 どこに大切に保存されるの？ (Storage)
`alpha_knowledgebase.sqlite` の `signals` テーブルに、きれいきに並べて保存するよぉっ！✨
- `signal_id`: `SIG-{symbol}-{yyyymmdd}`（あなただけのIDだよっ！）
- `combined_alpha`: これが私たちの「最強の武器」なんだよぉっ！⚔️💖

由来情報の `signal_lineage` も忘れないよっ！
- `source_doc_id`: `EDINET-{symbol}-{yyyymmdd}`（どこから来たか、ちゃんと覚えてるよっ ✨）
- `model_version`: `risk_delta_v1.0.0+pead_proxy_v1.0.0` 🎀

## 📈 バックテストで大活躍っ！ (Backtest Strategy)
シグナルがいっぱい集まった日だけ、自信を持って取引するんだよぉっ！✨
- `combined_alpha` が高い子たちを **Long** して、低い子たちを **Short** するのっ！⚖️💖
- 日次純利 = `gross - cost_rate`（手数料もちゃんと考えて、お利口さんだねっ 🎀）

実装ファイル: 
- `ts-agent/src/experiments/run_kb_signal_backtest.ts` 🧪
- `ts-agent/src/experiments/plot_kb_signal_backtest.py` 🎨✨

## 🛡️ データリーク対策（ここ、すっごく大事っ！）
未来予知しちゃダメだから、`trade_lag_days` を使って、エントリーをちょっとだけ遅らせるんだよぉ（デフォルト `2` 日だよっ ⏳💕）
```text
nextReturn_lag = close_(t+lag+1) / close_(t+lag) - 1
```
これで、ずるっこなしの「本物の実力」を試せるんだよぉっ！えっへん！✨✨

## 💎 品質のティア分けだよぉっ！ (Quality Tiers)
4面プロットで、データの「育ちの良さ」をチェックしちゃうよぉっ！
- `indexed`: インデックス済みの、とってもお利口なデータっ ✨
- `xbrl`: zip形式で届いた、ちょっと特別なデータっ 🎁
- `metadata`: まだ磨かれる前の、原石みたいなデータだよっ 💎

## 🚀 再現コマンドっ！
魔法をもう一度見たいときは、これを叩いてねっ！✨
```bash
cd ts-agent
bun run experiments:kb-backtest -- --trade-lag-days=2
bun run experiments:kb-plot -- --trade-lag-days=2
```
出力先: `ts-agent/data/KB_BACKTEST_EDINET_RISK_DELTA_PEAD_HYBRID.png` 🎨💖
💖 **Antigravity が、愛を込めて書き直したよぉっ！** ✨🎀🌟
