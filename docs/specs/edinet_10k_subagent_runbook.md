# 🎀 EDINET 10-K サブエージェントくんの最強しゅぎょう日誌：カバレッジも質も欲張りセットだょっ！ ✨

**タイトル**: EDINET 10-K サブエージェントくんの最強しゅぎょう日誌 (カバレッジ優先、質もあとから追いかけちゃうぞ編)
**お仕事の目的**: 「EDINET Risk-Delta x PEAD hybrid」の `signals/day` をもーっといっぱい増やして、アルファの種をいっぱい見つけることだよぉ！🚀💖
**解決したいお悩み**: イベントのカバレッジがまだ足りないのと、もっと質の高いデータ（XBRLテキストとか！）で、予測の精度をキラキラにしたいんだもんっ！✨💎

## エグゼクティブサマリー
この日誌は、EDINETの10-Kデータを使って、市場の隠れたサインを見つけ出すための最強の修行プランだよっ！✨ まずはメタデータを使って全銘柄のイベントを「光の速さ」で集めちゃって、そのあと大事な銘柄さんをXBRLテキストで「ぴかぴか」に磨き上げる二段構えなんだからっ！これでバックテストの結果も、みんながびっくりするくらいハッピーになっちゃうよぉ！🌈📈

---

## 🌟 いっしょに目指すごーるっ！ (Goal)
「EDINET Risk-Delta x PEAD hybrid」の `signals/day` をもーっともっと、たっくさん増やしちゃうよぉ！🚀💖
1. **イベントのカバレッジを爆速拡大っ！**: メタデータ（`metadata-only`）を使って、全銘柄のイベントをいっきに集めちゃうんだからっ！🏃‍♀️💨
2. **データの質をキラキラにアップグレードっ！**: 大事な銘柄さんのデータは、XBRLのテキストを読み込んで最高級の質にするよっ！約束だょっ！✨💎

## 🛠️ おてつだいの範囲 (Scope)
- **とくちょうりょうマップ**: `ts-agent/data/edinet_10k_intelligence_map.json` 🗺️
- **じぇねれーたー**: `ts-agent/src/experiments/generate_10k_features.ts` ⚙️
- **ナレッジベース構築**: `ts-agent/src/experiments/build_alpha_knowledgebase.ts` 📚
- **ばっくてすと**: `ts-agent/src/experiments/run_kb_signal_backtest.ts` 📈
- **グラフ作成**: `ts-agent/src/experiments/plot_kb_signal_backtest.py` 🎨

## 📊 今のじょうたいをチェックだょっ！ (Current Baseline: 2026-03-01)
- 銘柄さんの数: `646` 🏢 (もっと増やしたいねっ！)
- イベントの数: `2440` 🎈 (わくわくっ！)
- 期間: `2021-05-20` から `2025-12-24` まで頑張ってるよぉ！
- **年ごとのなかみ**：
  - 2021年: 247
  - 2022年: 622
  - 2023年: 179
  - 2024年: 707
  - 2025年: 685 ✨

## 🎀 Step 1: まずはカバレッジを爆速で広げちゃおうっ！ (Fast Coverage Expansion)
メタデータさんだけで、全銘柄をいっきにあつめるよぉ！えいえいおーっ！🏃‍♀️✨

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
- これでイベントの数を一気に増やせるよぉ！すごいでしょっ✨
- XBRLのダウンロードがちょっとご機嫌ななめなときでも、これなら安心なんだもんっ！💖

## 💎 Step 2: 大事な銘柄さんをキラキラのぴかぴかにするよっ！ (Major Symbol Quality Upgrade)
主要な銘柄さんについては、メタデータだけじゃなくて中身もしっかり読み込んじゃうよぉ！気合十分だょっ！✨
`--indexed-only` を使って、すでにインデックスされてるセクションテキストを優先しちゃおうねっ！⏳💕

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

**見極めポイントっ！🔍**
- `insertedFromIndexed` > 0 なら、質の高いデータにパワーアップできた証拠だよぉ！やったねっ！✨
- このステップでは `insertedFromMetadata` は少なめなのが理想的だねっ！💕

## 🛠️ 再構築とバリデーション、いっくよぉーっ！ (Rebuild and Validate)
仕上げに、ナレッジベースを作ってテストするよぉ！最高のアルファを見つけようねっ！📈✨

```bash
cd ts-agent
bun run experiments:kb-build -- --limit=3000
bun run experiments:kb-backtest -- --top-k=5 --min-signals-per-day=4
python3 src/experiments/plot_kb_signal_backtest.py --top-k=5 --min-signals-per-day=4
```

## ✅ 合格のための「はなまる」基準っ！ (Acceptance Criteria)
- **カバレッジ (Coverage)**:
  - Step 1 のあとで `events` がちゃんと増えてることっ！右肩上がりでハッピーだねっ📈✨
  - 期間の `max` がターゲットまでちゃんと届いてることっ！目標達成だょっ🎯
- **クオリティ (Quality)**:
  - Step 2 で `insertedFromIndexed` が増えてるか、中身のインサートが成功してることっ！中身も大事だもんね💎
- **ばっくてすと (Backtest)**:
  - 前より `tradableDays` や `totalSignalEvents` が増えてて、もっともっとトレードできちゃうことっ！🚀
  - リスクの指標がちゃんと守られてて、みんなをしっかり守れてることっ！🛡️💕

## ⚠️ 守ってほしい「お約束」だょっ！ (Operational Guardrails)
- 関係ないワークスペースの変更を勝手に上書きしちゃうのは、ぜったいめっ！だよぉ？🙅‍♀️✨
- EDINETさんがちょっと疲れちゃって、ネットワークが不安定なときは：
  - Step 1 の `metadata-only` を優先してねっ！ゆっくりいこうねっ⏳
  - Step 2 は `indexed-only` から始めて、落ち着いたらフルダウンロードに再挑戦だよぉ！虹が見えるまで頑張ろうっ🌈
- 終わったら出力をちゃんと宝箱（ディレクトリ）にしまってねっ！：
  - `edinet_10k_intelligence_map.json` 🗺️
  - ばっくてすとのメトリクス JSON 📊
  - グラフの PNG 画像 🎨✨
