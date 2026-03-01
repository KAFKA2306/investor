---
description: ぜんぶ自動！エージェントちゃんたちが「直交アルファ」をいーっぱい見つけてくれるよっ✨ Taskfile のタスクを呼んで、どんどん進化しちゃうんだからっ！🚀
---

# ✨きらきら！自律アルファ探索ワークフロー✨

このワークフローは、やることを `Taskfile` にぎゅぎゅっとまとめたよっ！`.agent/workflows` は入り口だけでOK！✨ 探索のやり方をあちこちに書かないで、`task` くんを「たった一つの正本」にしちゃうんだよぉっ！💖

## 🌟 Goals 🌟

- すごーい「直交アルファ」をずっと見つけ続けるよっ！（discover）🔍✨
- 数字でしっかり比べて、どっちがいいかチェック！（analyze）📊💕
- ちゃんとお仕事した証拠もばっちり残すよっ（verification plot + unified logs）📝✨
- 止まらずに、ずーっと進化し続けるループだよっ（loop with safe stop）ぐるぐるっ！🌀

## 🚀 Entrypoints 🚀

- いつもの入り口（ループ必須だよっ）: `task run:newalphasearch` 🏃‍♀️💨
- 止まらない！進化ループっ！: `task run:newalphasearch:loop` ♾️✨

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
