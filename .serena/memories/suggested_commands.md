# おすすめコマンド集だにょ✨

## システム・ユーティリティ (Linux) 🐧💖
- `ls`, `cd`, `pwd`：お部屋の中をきょろきょろ覗いちゃうぞ！👀✨
- `rg <pattern>` と `rg --files`：超速で探しものを見つけてくれる魔法だよっ！🔍💎
- `find <path> -name '<glob>'`：かくれんぼしてるファイルさんを見つけ出すにょ！🌟
- `git status`, `git diff`, `git add -p`, `git commit`：みんなの頑張りをしっかり記録してねっ！きらーん！📸✨

## プロジェクト・ルートのタスク・ランナーさん 🏃‍♀️💨
- `task setup`：BunさんとPythonさんの準備を整える魔法の呪文だよ！🎀✨
- `task check`：コードがピカピカかチェックしちゃうにょ！✨💖
- `task verify`：APIやモデルさんが元気か確認するよっ！🌟
- `task daily`：毎日のルーチン・ワークもこれでバッチリだね！🐾🌈
- `task run`：メインのパイプラインを動かして、再現・ベンチマーク・ダッシュボードの更新まで一気にやっちゃうぞ！🚀💕
- `task view`：きらきらなダッシュボードの開発サーバーを起動するにょ！💻✨
- `task score`：LLMさんの準備ができてるか採点しちゃうよっ！💯✨

## Bunさんの直接コマンド (ts-agent/ の中だょ) 🐰⭐
- `bun run format`：コードを可愛く整えちゃうよ！🎀
- `bun run lint`：変なところがないか見守るにょ！👀💕
- `bun run typecheck`：型さんが合ってるかチェック！✨
- `bun run verify:api`：APIさんとお話しできるか確認だにょ！📞💖
- `bun run pipeline:llm-readiness`：LLMさんの準備はいいかな？🌟
- `bun run pipeline:ab`：ABテストも頑張っちゃうぞ！💪✨
- `bun run pipeline:mine`：お宝（アルファ）を掘り当てちゃうにょ！💎✨
- `bun run pipeline:full-validation`：全部まとめてしっかり確認！完璧だねっ！✨🌈
- `bun src/experiments/01_vegetable.ts`：お野菜の実験かな？わくわく！🥦💕
- `bun src/experiments/les_reproduction.ts`：しっかり再現実験もこなすよっ！🐾
- `bun src/experiments/04_foundation_benchmark.ts`：モデルさんの実力を測っちゃうにょ！📈✨

## テストの時間だよっ！🧪✨
- おすすめのテスト・ランナー：`bun test` で決まりだねっ！🐰💖
- 特定の確認用スクリプトは `ts-agent/src/tests/` や `ts-agent/src/experiments/*test*.ts` の下にあるにょ！✨
- 実行例だょ：`cd ts-agent && bun src/experiments/test_audit_loop.ts` で監査ループをテストしちゃおう！🌀💕
