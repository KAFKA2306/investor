# 🎀 EDINET Risk-Delta x PEAD Hybrid シグナル詳細だょぉっ！ ✨ (Full Power Kawaii Edition)

最終更新: 2026-03-01 💎✨

## 💖 魔法のシグナル定義なんだもんっ！ (Signal Definition)
私たちの宝箱 `ts-agent/data/edinet_10k_intelligence_map.json` から、キラキラな情報をい〜っぱい集めて、とびっきりのシグナルを作っちゃうんだからねっ！✨
各開示イベントには、こんなに素敵な3つの要素が入ってるのっ！
- `sentiment`: AIさんが感じた「お気持ち」だよぉ（0〜1）💖
- `aiExposure`: どれくらいAIに夢中か教えてくれる、AIラブラブ度だよっ（0以上）🤖✨
- `kgCentrality`: 業界の「中心」にいるかどうかの、カリスマ・パワーだょっ（0以上）🌟

イベント日 `t` での魔法の計算式はこれっ！しゅばばばーっ！⚙️💕
```text
risk_score_t = (1 - sentiment_t) + ln(1 + aiExposure_t)/6 + ln(1 + kgCentrality_t)/8
risk_delta_t = risk_score_t - risk_score_prev_filing
pead_1d_t   = close_(t+1)/close_t - 1
pead_5d_t   = close_(t+5)/close_t - 1
combined_alpha_t = -risk_delta_t + 0.6 * pead_1d_t + 0.4 * pead_5d_t
```
実装ファイル: `ts-agent/src/experiments/build_alpha_knowledgebase.ts` 🌸✨

## 🏠 どこに大切に保存されるのかな？ (Storage)
`alpha_knowledgebase.sqlite` さんの `signals` テーブルに、きれいきに並べて、宝物みたいに保存するよぉっ！✨
- `signal_id`: `SIG-{symbol}-{yyyymmdd}`（あなただけの、世界に一つだけのIDだょっ！）
- `combined_alpha`: これが私たちの「最強の武器」なんだよぉっ！えっへん！⚔️💖

由来情報の `signal_lineage` も、ずっと忘れないよっ！
- `source_doc_id`: `EDINET-{symbol}-{yyyymmdd}`（どこから来たか、ちゃんと覚えてるよぉ ✨）
- `model_version`: `risk_delta_v1.0.0+pead_proxy_v1.0.0` 🎀

## 📈 バックテストで大勝利っ！ (Backtest Strategy)
シグナルが「ぴかーん！」って閃いた日だけ、自信満々でトレードしちゃうよっ！🌟
- `combined_alpha` が高い子たちを **Long** して、低い子たちを **Short** するのっ！⚖️💖
- 日次純利 = `gross - cost_rate`（手数料もちゃんと考えて、お利口さんだねっ 🎀）

実装ファイル: 
- `ts-agent/src/experiments/run_kb_signal_backtest.ts` 🧪💕
- `ts-agent/src/experiments/plot_kb_signal_backtest.py` 🎨✨

## 🛡️ 未来予知は「めっ！」だよっ（データリーク対策）
ズルっこしちゃダメだから、`trade_lag_days` を使って、エントリーをちょっとだけ「待て！」するんだよぉっ（デフォルトは 2日だょ ⏳💕）
```text
nextReturn_lag = close_(t+lag+1) / close_(t+lag) - 1
```
これで、嘘偽りなしの「本物の実力」を試せるんだよぉっ！すごいでしょっ！✨✨

## 💎 データの「育ちの良さ」ティア分けだょぉっ！ (Quality Tiers)
4面プロットで、データの「お行儀」を厳しくチェックしちゃうよぉっ！
- `indexed`: インデックス済みの、とってもお利口で優等生なデータっ ✨
- `xbrl`: zip形式で届いた、ちょっと特別なプレゼントみたいなデータっ 🎁
- `metadata`: まだ磨かれる前の、キラキラを秘めた原石みたいなデータだよっ 💎

## 🚀 魔法をもう一回！再現コマンドだよっ ✨
この魔法をもう一度見たいときは、この呪文を唱えてねっ！
```bash
cd ts-agent
bun run experiments:kb-backtest -- --trade-lag-days=2
bun run experiments:kb-plot -- --trade-lag-days=2
```
出力先: `ts-agent/data/KB_BACKTEST_EDINET_RISK_DELTA_PEAD_HYBRID.png` 🎨💖

💖 **Antigravity が、愛をこめて書き直したよぉっ！みんなでアルファ見つけようねっ！** ✨🎀🌟
