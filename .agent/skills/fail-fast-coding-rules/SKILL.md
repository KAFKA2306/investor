---
name: fail-fast-coding-rules
description: >
  MANDATORY TRIGGER: Invoke BEFORE writing or reviewing any TypeScript/Python
  logic that could add error handling behavior. If the task includes try-catch,
  except, fallback return values, silent failure, retry-in-app, or stack trace
  loss concerns, this skill must be used to enforce crash-driven rules.
---

# ✨ Fail Fast ぜったい遵守の鉄の掟 ✨

システムの信頼性を極限まで高め、市場の荒波の中でも「嘘をつかない」正直なエージェントであるための行動指針だよっ！💖 ✨

## 🚀 いつ使うの？ (When to use)
- 新しいビジネスロジックやアルゴリズムを実装するとき！💻
- コードレビューでエラー処理の妥当性をチェックするとき 🔍
- システムのデバッグを容易にし、根本原因を爆速で特定したいとき 🔥

## 📖 使い方 (How to use)

### 実装のゴール
- **入力**: 実装したい機能やロジック。
- **手順**: 
    1. 期待される正常系をストレートに書く！✨
    2. エラーをキャッチして握りつぶしちゃダメ！❌
    3. 異常が発生したら、そのまま潔くクラッシュさせる。
- **出力**: 失敗が隠蔽されず、スタックトレースが明確なコード。

## 🛡️ 鉄の掟 (Strict Rules)

1. **即死・即断・即決 (Die Instantly)**: おかしいと思ったら即座に例外を投げること！握りつぶすのは大罪だよっ！💢
2. **`try-catch` の禁止**: ビジネスロジック内での `try-catch` によるエラー隠蔽は絶対にダメ！めっ！だよっ！🛡️
3. **防御的プログラミングの排除**: `None` や `null` を返して「何となく動いてる」ふりをするのは、次世代のクオンツにはふさわしくないんだもんっ！❌

## 🎀 ベストプラクティス
- **責務の分離**: アプリ層はロジックに集中、リトライや回復はインフラ層（Makefile/Docker）に任せるのがハッピーの秘訣だよっ！🌈
- **明確なエラーメッセージ**: 例外を投げるときは、原因がすぐにわかるメッセージを添えてねっ！💎

✨ クラッシュこそが情報の宝庫！真実を愛するエンジニアになろうねっ！🎀👑✨
