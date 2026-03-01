# 🎀 きらきらっ！自律アルファ探索ワークフローちゃん ✨

**タイトル**: 自律アルファ探索ワークフロー
**description**: antigravity / codex / task のどの入力経路からでも、Task 一元管理の同一路線で自律探索ループを回し、毎サイクルで新規検証・新規記録・差分アイデア採択を保証する運用手順書だよっ！
**お仕事の目的**: 止まらないループの魔法を使って、世界に一つだけの最強「直交アルファ」をいーっぱい掘り当てて、システムをどんどん進化させることだよっ！🌀💎
**解決したいお悩み**: 「アルファ探しをずっと手作業でやるのは疲れちゃう…💦」「途中で止まらずに、賢いアルファを自動で見つけ続けてほしいっ！✨」そんな願いを全部かなえちゃうんだもんっ 💖🚀

## エグゼクティブサマリー
`Taskfile` くんの力を借りて、探索（discover）から分析（analyze）、そして証拠の保存（verification）までをぜーんぶ自動で回しちゃう、夢の「進化ループ」が誕生したよっ！🌟✨ `task` コマンドひとつで、エージェントちゃんたちが一生懸命働いて、新しいお宝アルファをどんどん運んできてくれるんだよぉ 🤖🎀 失敗してもお利口に止まるセーフティ機能もついてるから、安心して見守っていられる、最高に可愛くて頼れるワークフローなんだからねっ 🎀🌟

---

## 🌟 Goals 🌟

- すごーい「直交アルファ」をずっと見つけ続けるよっ！（discover）🔍✨
- 数字でしっかり比べて、どっちがいいかチェック！（analyze）📊💕
- ちゃんとお仕事した証拠もばっちり残すよっ（verification plot + unified logs）📝✨
- 止まらずに、ずーっと進化し続けるループだよっ（loop with safe stop）ぐるぐるっ！🌀

## 🚀 Entrypoints 🚀

- いつもの入り口（ループ必須だよっ）: `task run:newalphasearch` 🏃‍♀️💨
- 止まらない！進化ループっ！: `task run:newalphasearch:loop` ♾️✨
- 自然言語インプット専用の入り口だよっ: `task run:newalphasearch:nl NL_INPUT="ここに指示"` 🗣️✨

> どの入口から入っても、実行経路は `run:newalphasearch -> run:newalphasearch:loop -> run:newalphasearch:cycle` で統一するよっ！

## 🗣️ Natural Language I/O（antigravity / codex 対応）🗣️

起動元が `antigravity` でも `codex` でも、Task 経路を固定して同じループに流すよっ！

- 入力チャンネル: `UQTL_INPUT_CHANNEL`（例: `antigravity`, `codex`, `task`）
- 自然言語入力（文字列）: `UQTL_NL_INPUT`
- 自然言語入力（ファイル）: `UQTL_NL_INPUT_FILE`

優先順位はつぎの通りだよっ。
1. `UQTL_NL_INPUT`
2. `UQTL_NL_INPUT_FILE` の中身
3. 未指定（空）

実行例だよっ ✨

- `UQTL_INPUT_CHANNEL=codex task run:newalphasearch:nl NL_INPUT="TOPIX大型株で短期逆張りテーマを提案して"`
- `UQTL_INPUT_CHANNEL=antigravity UQTL_NL_INPUT_FILE=/tmp/mission.txt task run:newalphasearch`

## 🧾 Unified Log の入力監査項目（必須）🧾

各サイクルで `alpha_discovery` の unified log に、入力トレースも残すよっ！

- `input.channel`: `antigravity` / `codex` / `task`
- `input.nlInputProvided`: 自然言語入力があるかどうか
- `input.nlInputHash`: 入力本文のハッシュ（監査向け）
- `input.nlInputPreview`: 入力先頭の短いプレビュー

## 🎀 Loop Controls 🎀

以下の「環境変数」で、ループの動きを可愛くコントロールできるよっ！

- `ALPHA_LOOP_MAX_CYCLES` 🔄
  - 既定値: `3`
  - `N >= 1`: `N` サイクルまわったら、お利口に停止するねっ！
- `ALPHA_LOOP_SLEEP_SEC` 😴
  - サイクルが終わるたびに、何秒ねんねするか決めるよっ（既定は `0` 秒！）
- `ALPHA_LOOP_MAX_FAILURES` 💦
  - もし失敗が続いちゃったら、危ないから止まる閾値だよっ（既定は `3` 回！）

実行する時のれいっ！：

- `ALPHA_LOOP_MAX_CYCLES=3 ALPHA_LOOP_SLEEP_SEC=10 task run:newalphasearch:loop` 🚀✨

## 💎 Required Outputs 💎

ループが終わるたびに、これらが新しくなってることを期待しちゃうぞっ！わくわくっ✨

- `logs/unified/alpha_discovery_*.json` 📜
- `ts-agent/data/standard_verification_data.json` 📊
- `ts-agent/data/playbook.json` 📖

さらにさらにっ、各サイクルで `alpha_discovery_*.json` の件数が増えていなかったら、「ぷんぷんっ！失敗だよぉっ！」って判定しちゃうから気をつけてねっ💢

## 🛡️ Safety Policy 🛡️

- 失敗がいっぱい重なったら、自動で「めっ！」って止まるよっ🛑
- なんで止まったのかは、標準出力でちゃんとお話しするからねっ！💬
- もう一回やりたいときは、同じコマンドをまたぽちっとしてねっ！待ってるよっ✨
