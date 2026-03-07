---
name: env-management
description: >
  MANDATORY TRIGGER: Invoke BEFORE any task that reads, writes, or debugs
  environment and config values (.env, API keys, model names, base URLs, path
  config, or credential lookups). If the request mentions OPENAI_API_KEY,
  OPENAI_BASE_URL, FRED_API_KEY, EDINET_API_KEY, J-Quants tokens, missing key,
  config error, or any secrets/path change, this skill must be used first.
---

# 🎀 Environment Management Skill (MANDATORY HOOK) 🎀

環境変数を安全に守り、プロジェクトの設定を完璧に管理するためのスキルだよっ！💖 ✨

## 🚀 いつ使うの？ (When to use)
- 新しい環境変数を定義したいとき！✨
- APIキーやデータベースのパスワードなどの秘密（Secrets）を扱いたいとき 🤫
- プロジェクトの共通設定（Non-secrets）を確認・変更したいとき 🌐
- **重要**: 環境変数に関連する作業を始める前に、必ずこのスキルをフックしてねっ！💢✨

## 📖 使い方 (How to use)

### 秘密情報 (Secrets) の管理
- **入力**: 新しいAPIキーなどの機密情報。
- **手順**: `.env` を直接編集しちゃダメ！❌ `.env.example` を更新して、ユーザーに追記をお願いしてね 💖
- **出力**: セキュアに設定された環境変数。

### 共通設定 (Non-secrets) の管理
- **入力**: モデル名、リスクパラメータ、ディレクトリパスなど。
- **手順**: `config/default.yaml` に定義するよ！✨
- **出力**: プロジェクト全体で一貫した設定。

## 🛡️ 鉄の掟 (Iron Rules)

1. **`.env` は絶対に閲覧禁止！❌**: `view_file` や `grep` で覗こうとしたら、めっ！だよっ！💢 機密情報をコンテキストに入れないのが鉄則！🔒
2. **ハードコード禁止！**: ソースコードの中にパスやキーを直書きするのは大罪だよっ！必ず環境変数経由で使ってね 🐾
3. **バリデーション**: 環境変数を読み取るときは、必ず存在チェックと型チェックを挟もうねっ！💎

## 🎀 ベストプラクティス
- **ConfigSchema の活用**: TS/Bun なら Zod、Python なら Pydantic を使って、起動時に設定をガッチリ固めるのがハッピーになれるコツだよっ！🌈
- **環境変数名の統一**: `UQTL_` プレフィックスなどを付けて、他のシステムと混ざらないようにしようねっ！✨

✨ 掟を守って、安全でピカピカな開発環境を作ろうねっ！🎀👑✨
