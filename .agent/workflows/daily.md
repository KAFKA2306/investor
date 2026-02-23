---
description: 投資エージェントの、まいにちの「おしごとルーチン」だよっ ✨（検証から実行まで！）
---

# ☀️ まいにちの統合ワークフロー ☀️

リサーチ、検証、そして実行から自律改善まで！ひとつの大きなループだよっ ✨

```mermaid
sequenceDiagram
    autonumber
    participant M as 市場 (E-Stat/JQuants)
    participant A as エージェント (Pead/X)
    participant E as 実験 (Vegetable Scenario)
    participant Z as 門番 (Zod Validation)
    participant L as 統合ログ (Unified Log)

    A->>M: リサーチ開始っ ✨
    M-->>A: お宝情報（アルファ）を発見っ ✨
    A->>E: 野菜インフレ・シナリオで検証っ ✨
    E-->>A: 検証結果を返却っ ✨
    A->>Z: Zod スキーマで厳格チェックっ ✨
    Z-->>L: 実行結果を JSON で記録っ (Success/Fail) ✨
```

## 📋 毎日のチェックリスト

1. **リサーチ**: 市場の歪み（アルファ）を見つけよう！
2. **検証**: `ts-agent/src/experiments/` で期待値をチェック！
3. **バリデーション**: Zod スキーマを通った結果だけを信頼するよっ！
4. **記録 (Unified Logging)**: `logs/daily/{{YYYYMMDD}}.json` にすべての意思決定を刻もう。

## 🧩 モジュール的運用（毎日共通）

1. **Registry更新**: 新規モデル候補はまず `ts-agent/src/model_registry/models.json` にリンク登録（実装前提にしない）。
2. **UseCase実行**: 実験エントリは薄く保ち、`ts-agent/src/use_cases/` の共通実証ロジックを呼ぶ。
3. **Scenario分離**: ドメイン分析は `ts-agent/src/experiments/scenarios/` に閉じ込め、他シナリオへ再利用可能にする。
4. **Gateway分離**: API接続は `ts-agent/src/experiments/gateways/` で統一し、provider差し替えを容易にする。
5. **証跡固定**: `logs/daily/{{YYYYMMDD}}.json` に `models`（registry参照）+ `report`（分析結果）を一貫保存する。

## 💎 統一ログ・プロトコル
`logs/daily/` に保存される JSON は、私たちの「成長の記録」だよっ☆
- `signals`: 銘柄、SUE値、センチメントスコア
- `risks`: ケリー基準によるロットサイズ、逆指値設定
- `results`: 約定価格、損益状況、エラー内容

## 🚀 自律改善の魔法
一日の終わりに、AIである私が今日のログを読み込むよっ！
- 「なぜ負けたのか？」を分析して、Zod スキーマの閾値や LLM プロンプトを自ら書き換えるんだっ。
- これで、私たちは毎日少しずつ「無敵」に近づいていくよっ💖

> [!IMPORTANT]
> ログは私たちの財産！きれいに、構造的に残すのが Zero-Fat の流儀だよっ ✨
