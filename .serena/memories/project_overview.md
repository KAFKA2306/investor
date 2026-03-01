# 💖 Investor Project Overview 💖

## 🌟 Purpose（目的だよっ！）
BunとTypeScriptで動く、とっても賢い自律型のクオンツ・トレーディング＆リサーチシステムだよ！✨ 市場データや財務データを「もぐもぐ」読み込んで、エージェントさんやパイプライン（LESとかの実験！）が一生懸命ロジックを回してくれるの！💕 最後には結果をしっかり評価して、ダッシュボードでキラキラ確認できるようにログや成果物を出力してくれるんだよ！🎨

## 🛠️ Tech Stack（使ってる技術さんたち！）
- **Runtime**: [Bun](https://bun.sh/) - 爆速で動くエンジンの主役だよ！🚀
- **Language**: TypeScript (ESM) - 型安全でバッチリ！💎
- **Type safety**: `@tsconfig/strictest` + `strict: true` - とっても厳しい設定でミスを許さないよ！💢✨
- **Validation**: [Zod](https://zod.dev/) - データの中身を可愛くチェック！✅
- **Lint/format**: [Biome](https://biomejs.dev/) - コードをいつもピカピカに整えてくれるよ！🧹
- **Dashboard**: `ts-agent/src/tools/dashboard` にある Vite アプリだよ！📊
- **Supplemental Python workflows**: `ts-agent/src/experiments/foundation_models` で `uv` を使ってるよ！🐍

## 📂 High-Level Structure（フォルダ構成だよ！）
- `ts-agent/`: メインのコードが入ってる大切な場所だよ！🏠
- `ts-agent/src/agents`: 戦略やエージェントさんのロジックが詰まってるよ！🤖
- `ts-agent/src/core`: システムを動かすための大事な部品たち！⚙️
- `ts-agent/src/gateways`: データプロバイダーさんとの仲良し窓口だよ！🌐
- `ts-agent/src/schemas`: Zodのスキーマや契約が書かれているよ！📜
- `ts-agent/src/pipeline`: 評価やマイニング、バリデーションの通り道だよ！🛤️
- `ts-agent/src/experiments`: 実験をぽちっと実行する入り口だよ！🧪
- `ts-agent/src/tools/dashboard`: ダッシュボードアプリとログの管理ツールだよ！📱
- `logs/`: 生成されたキラキラな成果物たちだよ！ (`daily`, `unified`, `benchmarks`, `readiness`) 💎
- `docs/`: アーキテクチャやレポートが保管されてるよ！📚

## 📝 Notes（大事なメモだよ！）
- `logs/` の中身は自動で作られた成果物だから、大切に扱ってね！🎁
- APIキーや秘密の情報はローカルの `.env` ファイルに隠してね！絶対にコミットしちゃダメだよ！🤫🔐
