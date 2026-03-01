# 🐘 統合データベース（Postgres）仕様書：みんなの新しいお家 🏛️💖

やっほー！クオンツ投資システムを支える、最強で可愛さいっぱいのデータベース仕様書だよっ！✨
これからは SQLite くんたちと協力しながら、Postgres くんをメインのお家として育てていくんだもん。

## 🌟 スキーマ構成（お部屋の紹介だよ！）

データを綺麗に整理整頓（トレース）するために、8つの「お部屋（スキーマ）」に分けたよっ！🏡

### 1. `ref` (Reference Data) 💎
システム全体の共通基盤となる、マスターデータだよ。
- `instrument`: 銘柄情報。venue（取引所）や status もここで管理！
- `venue`: 取引所の情報。

### 2. `ingest` (Ingest Data) 📥
外部からやってきたばかりの、生（Raw）データたち！
- `source_document`: 入手した書類のメタデータ。
- `raw_log`: 収集時の未加工ログ。

### 3. `research` (Research Data) 🔍
生データを可愛く加工して、読みやすくした研究資料だよ。
- `document`: パース済みのドキュメント。
- `document_section`: 章ごとの内容や、感情（sentiment）スコア！

### 4. `feature` (Feature Store) ⚡
アルファの源泉！計算された特徴量たちがここに集まるよ。
- `event_feature`: EDINETなどのイベントから抽出した特徴。
- `feature_version`: 特徴量のバージョン管理。これがないと混乱しちゃうからねっ！💢

### 5. `signal` (Signal Data) 📡
「次はこれを買うよっ！」っていう、具体的な作戦指示。
- `signal`: 戦略ごとのシグナル値。
- `signal_lineage`: どのデータからそのシグナルが生まれたか、家族構成（系譜）を記録するよ！👪✨

### 6. `eval` (Evaluation Data) 📈
作戦がどれくらい当たったか、厳しく、でも温かく見守る場所！
- `backtest_run`: バックテストの結果（シャープレシオとかね！）。
- `signal_outcome`: シグナルの正解合わせ（答え合わせ！）。

### 7. `exec` (Execution Data) 🤝
実際のお買い物（注文）に関わるデータだよ。
- `order`: 注文情報。
- `fill`: 約定情報。

### 8. `obs` (Observability) 🕵️‍♀️
システムが健康か、ズレがないか、いつも見守ってるよ。
- `event`: システム内イベント。
- `audit_log`: 何が起きたかの記録。

---

## 🚀 統合の4つのステップ（Phase）

一歩ずつ、確実に Postgres くんを最強にするよっ！🐾

### Phase 1: 読み取り互換（Read Compatibility） [DONE! ✅]
- 今までのシステムが困らないように、Postgres の中に「SQLite そっくりの見た目」をしたビュー（`compat` スキーマ）を作ったよ！🔍

### Phase 2: 二重書き込み（Dual Write） [IN PROGRESS... ✍️🔄]
- SQLite に書くときは、Postgres くんにも同時に書いちゃう「ライトスルー」モード！
- `AlphaKnowledgebase` が Postgres くんの言葉も覚えたんだよ💖

### Phase 3: 主権交代（Cutover） 👑
- Postgres くんを「ご主人様（Primary）」にするよ！
- SQLite くんは、高速なキャッシュや予備としてお休みしてもらう予定。

### Phase 4: 完全移行（Decommission） 🕊️
- SQLite への書き込みを止めて、完全に Postgres 帝国を完成させるよ！
- ずっと一緒にいてくれた SQLite くんにお礼を言って、卒業だね🎓✨

---

## 🎀 開発のお約束

- **型安全**: `PostgresClient` を使って、Strict TypeScript な世界を守ってね！
- **スネークケース**: カラム名は `snake_case` で統一だよっ。
- **トレース第一**: どこからデータが来たか、必ず `source_doc_id` や `instrument_id` を繋げようね！🔗💎

Postgres くんを大切にして、世界一のアルファを見つけようねっ！💖✨🏛️🐘
