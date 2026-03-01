# 🎀 EDINET 10-K Subagent Runbook (Coverage First, Quality Second) ✨

## 🌟 ごーる！ (Goal)
「EDINET Risk-Delta x PEAD hybrid」の `signals/day` をもっともっと増やすよぉ！🚀💖
1. イベントのカバレッジを光の速さで広げるっ (`metadata-only`) 🏃‍♀️💨
2. 主要な銘柄のデータの質をぴかぴかに上げるっ (XBRLテキストを優先してねっ！) ✨💎

## 🛠️ おしごとの範囲 (Scope)
- **とくちょうりょうマップ**: `ts-agent/data/edinet_10k_intelligence_map.json` 🗺️
- **ジェネレーター**: `ts-agent/src/experiments/generate_10k_features.ts` ⚙️
- **ナレッジベース構築**: `ts-agent/src/experiments/build_alpha_knowledgebase.ts` 📚
- **ばっくてすと**: `ts-agent/src/experiments/run_kb_signal_backtest.ts` 📈
- **グラフ作成**: `ts-agent/src/experiments/plot_kb_signal_backtest.py` 🎨

## 📊 いまのじょうたいっ！ (Current Baseline: 2026-03-01)
- 銘柄数: `646` 🏢
- イベント数: `2440` 🎈
- 期間: `2021-05-20` から `2025-12-24` までっ！
- 年ごとの内訳だよぉ：
  - 2021年: 247
  - 2022年: 622
  - 2023年: 179
  - 2024年: 707
  - 2025年: 685 ✨

## 🎀 Step 1: まずはカバレッジを広げちゃおうっ！ (Fast Coverage Expansion)
メタデータだけで、全銘柄をばーっと集めるよぉ！🏃‍♀️✨

```bash
cd ts-agent
bun run experiments:10k-features -- \
  --from=2023-01-01 \
  --to=2025-12-31 \
  --all-symbols \
  --metadata-only \
  --sleep-ms=0 \
  --flush-every=300
```

**めもっ！📝**
- これでイベントの数を一気に増やせるよぉ！✨
- XBRLのダウンロードがちょっと不安定なときでも、これなら安心だねっ！💖

## 💎 Step 2: 主要な銘柄をぴかぴかにするよっ！ (Major Symbol Quality Upgrade)
主要な銘柄については、メタデータだけじゃなくて中身もしっかり読み込むよぉ！✨
`--indexed-only` を使って、すでにインデックスされてるセクションテキストを優先しようねっ！⏳💕

```bash
cd ts-agent
bun run experiments:10k-features -- \
  --from=2023-01-01 \
  --to=2025-12-31 \
  --symbols=6723,3656,6762,6857,3774,4056,4478,4765,6232,6282,6619,7733,7988,8002,9416,9434,1860,2767,2914,3036,3156,3686,3697,3903,3964,4401,4425,4461,4579,4582,4592,4599,4901,4912,5741,5902,5949,6136,6238,6381,6455,6460,6471,6521,6523,6588,6632,6702,6845,6988,7038,7270,7480,8008,8056,8601,8609,9268,9468,9755 \
  --overwrite-existing \
  --indexed-only \
  --sleep-ms=0 \
  --flush-every=100
```

**読み解きかたっ！🔍**
- `insertedFromIndexed` > 0 なら、質の高いデータにアップグレードできたってことだよぉ！✨
- このステップでは `insertedFromMetadata` は少なめがいい感じっ！💕

## 🛠️ 再構築とバリデーションっ！ (Rebuild and Validate)
仕上げに、ナレッジベースを作ってテストするよぉ！📈✨

```bash
cd ts-agent
bun run experiments:kb-build -- --limit=3000
bun run experiments:kb-backtest -- --top-k=5 --min-signals-per-day=4
python3 src/experiments/plot_kb_signal_backtest.py --top-k=5 --min-signals-per-day=4
```

## ✅ 合格基準だよぉっ！ (Acceptance Criteria)
- **カバレッジ (Coverage)**:
  - Step 1 のあとで `events` がちゃんと増えてることっ！📈✨
  - 期間の `max` がターゲットまで届いてることっ！🎯
- **クオリティ (Quality)**:
  - Step 2 で `insertedFromIndexed` が増えてるか、中身のインサートが成功してることっ！💎
- **ばっくてすと (Backtest)**:
  - 前より `tradableDays` や `totalSignalEvents` が増えてることっ！🚀
  - リスク指標がちゃんと守られてることっ！🛡️💕

## ⚠️ おしごとの守りごとっ！ (Operational Guardrails)
- 関係ないワークスペースの変更は上書きしちゃダメだよぉ！🙅‍♀️✨
- EDINETのネットワークが不安定なときは：
  - Step 1 の `metadata-only` を優先してねっ！⏳
  - Step 2 は `indexed-only` から始めて、安定したらフルダウンロードに再挑戦だよぉ！🌈
- 終わったら出力をちゃんと保存してねっ！：
  - `edinet_10k_intelligence_map.json` 🗺️
  - ばっくてすとのメトリクス JSON 📊
  - グラフの PNG 画像 🎨✨
