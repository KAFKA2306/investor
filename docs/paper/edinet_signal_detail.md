# EDINET Risk-Delta x PEAD Hybrid シグナル詳細（kawaii版）

最終更新: 2026-03-01

## 1. シグナル定義だよ

データ元は `ts-agent/data/edinet_10k_intelligence_map.json` です。
各開示イベントには次の3つが入っています。
- `sentiment`（0〜1）
- `aiExposure`（0以上）
- `kgCentrality`（0以上）

イベント日 `t` での計算式はこれです。

```text
risk_score_t = (1 - sentiment_t) + ln(1 + aiExposure_t)/6 + ln(1 + kgCentrality_t)/8
risk_delta_t = risk_score_t - risk_score_prev_filing
pead_1d_t   = close_(t+1)/close_t - 1
pead_5d_t   = close_(t+5)/close_t - 1
combined_alpha_t = -risk_delta_t + 0.6 * pead_1d_t + 0.4 * pead_5d_t
```

実装ファイル:
- `ts-agent/src/experiments/build_alpha_knowledgebase.ts`

## 2. どこに保存されるの？

`alpha_knowledgebase.sqlite` の `signals` テーブルに保存されます。
- `signal_id` = `SIG-{symbol}-{yyyymmdd}`
- `symbol`
- `date`（開示日）
- `risk_delta`
- `pead_1d`
- `pead_5d`
- `combined_alpha`

由来情報は `signal_lineage` に保存されます。
- `source_doc_id` = `EDINET-{symbol}-{yyyymmdd}`
- `source_section` = `Risk Factors`
- `model_version` = `risk_delta_v1.0.0+pead_proxy_v1.0.0`

## 3. バックテストでの使い方

その日のシグナル数が十分ある日だけ売買します。
- `combined_alpha` の高い順に並べる
- Long は上位 `K`
- Short は下位 `K`
- 日次粗利: `mean(long nextReturn) - mean(short nextReturn)`
- 日次純利: `gross - cost_rate`

主要パラメータ:
- `top_k`
- `min_signals_per_day`
- `cost_rate`

実装ファイル:
- `ts-agent/src/experiments/run_kb_signal_backtest.ts`
- `ts-agent/src/experiments/plot_kb_signal_backtest.py`

## 4. データリーク対策（ここ大事）

`trade_lag_days` を使って、エントリーを遅らせます（デフォルト `2`）。

```text
nextReturn_lag = close_(t+lag+1) / close_(t+lag) - 1
```

デフォルトの `lag=2` は、実質 `T+2 -> T+3` で約定する想定です。
同日・翌日リークを避けるための安全設計です。

実装ファイル:
- `ts-agent/src/context/alpha_knowledgebase.ts`
- `ts-agent/src/experiments/run_kb_signal_backtest.ts`
- `ts-agent/src/experiments/plot_kb_signal_backtest.py`

## 5. 品質ティア（metadata / indexed / xbrl）

4面プロットでは次のルールで分類します。
- `indexed`: `logs/cache/edinet_search.sqlite` の `indexed_docs` に docID がある
- `xbrl`: `logs/cache/edinet_docs/{docID}_type1.zip` がある
- `metadata`: 上のどちらでもない

最新実行の傾向:
- `metadata` が大半
- `indexed` は少量
- `xbrl` は現在 0

## 6. 再現コマンド

```bash
cd ts-agent
bun run experiments:kb-backtest -- --trade-lag-days=2
bun run experiments:kb-plot -- --trade-lag-days=2
```

出力:
- `ts-agent/data/KB_BACKTEST_EDINET_RISK_DELTA_PEAD_HYBRID.png`
