---
description: Task一元管理の力で、止まらない自律探索ループを回しちゃう魔法の手順書だよっ！🎀✨
---

# 🎀 きらきらっ！自律アルファ探索ワークフローちゃん ✨

**お仕事の目的**: 止まらないループの魔法を使って、世界に一つだけの最強「直交アルファ」をいーっぱい掘り当てて、システムをどんどん進化させることだよっ！🌀💎
**解決したいお悩み**: 「アルファ探しを手作業でやるのは疲れちゃう…💦」そんな願いをかなえて、自動で賢いアルファを見つけ続けるよっ 💖🚀

---

## 🚀 Entrypoints 🚀

- 🏃‍♀️ **いつもの入り口**: `task run:newalphasearch` (ループ必須だよっ！)
- ♾️ **止まらない進化ループ**: `task run:newalphasearch:loop`
- 🗣️ **おしゃべり入り口**: `task run:newalphasearch:nl NL_INPUT="ここに指示"`

> [!IMPORTANT]
> どの入口から入っても、実行経路は `run:newalphasearch -> run:newalphasearch:loop -> run:newalphasearch:cycle` で統一するよっ！✨

---

## 🎀 Loop Controls 🎀

以下の「環境変数」で、ループの動きを可愛くコントロールできるよっ！🎀

| 環境変数 | 既定値 | なにするの？ |
| :--- | :--- | :--- |
| `ALPHA_LOOP_MAX_CYCLES` 🔄 | `3` | `N` サイクルまわったら、お利口に停止するねっ！ |
| `ALPHA_LOOP_SLEEP_SEC` 😴 | `0` | サイクルが終わるたびに、何秒ねんねするか決めるよっ 💤 |
| `ALPHA_LOOP_MAX_FAILURES` 💦 | `3` | もし失敗が続いちゃったら、危ないから止まる閾値だよっ 🛑 |

#### 📖 実行する時のれいっ！
`ALPHA_LOOP_MAX_CYCLES=3 ALPHA_LOOP_SLEEP_SEC=10 task run:newalphasearch:loop` 🚀✨

---

## 💎 Required Outputs 💎

ループが終わるたびに、これらが新しくなってることを期待しちゃうぞっ！わくわくっ✨

- `logs/unified/alpha_discovery_*.json` 📜
- `ts-agent/data/standard_verification_data.json` 📊
- `ts-agent/data/playbook.json` 📖

各サイクルで `alpha_discovery_*.json` の件数が増えていなかったら、「ぷんぷんっ！失敗だよぉっ！」って判定しちゃうからねっ 💢

---

## 🛡️ Safety Policy 🛡️

- 失敗がいっぱい重なったら、自動で「めっ！」って止まるよっ🛑
- なんで止まったのかは、標準出力でちゃんとお話しするからねっ！💬
- もう一回やりたいときは、同じコマンドをまたぽちっとしてねっ！待ってるよっ✨
