# 🤖 Autonomous Alpha Discovery：自律進化のマスター仕様書っ！ ✨💖

このドキュメントは、プロジェクトの「魂」である自律探索ループ（Agentic Loop）のすべてを定義した、完全無欠のバイブルだよっ！🚀

---

## 🌟 エグゼクティブサマリー
本仕様書は、システムの「自律性（Autonomy）」と「アルファ探索のランブック」を統合したものだよっ！
- **自律ループ**: 思考補助（LLM）と決定論的ロジックの融合。
- **探索手順**: 7ステップの Agentic Loop 手順と証跡管理。

---

## 1. 🧬 自律探索ループ (Agentic Loop) ✨

### 1.1 目的
`newalphasearch` は、人間を介在させずに「探索・検証・改善・記録」の閉ループを回し続けるよっ。

### 1.2 毎サイクルの 7 ステップ (The Holy Seven)
1. **Theme Generate**: 仮説テーマ生成（LLM 担当）。
2. **Validate**: 検証・バックテスト（計算エンジン担当）。
3. **Score**: `fitness / novelty / stability / adoption` 算出。
4. **Decide**: 採択/棄却判定（しきい値ベース）。
5. **Update**: memory / ACE の更新。
6. **Log**: unified log と plot の保存。
7. **Loop Control**: 失敗閾値に基づく停止判定。

### 1.3 自律ループ・シーケンス図 🤖🧭✨

```mermaid
sequenceDiagram
    autonumber
    participant Ctrl as 自律ループ制御
    participant LLM as OpenAI gpt-5-nano
    participant FE as Factor Engine
    participant VE as Validation Engine
    participant SE as Scoring Engine
    participant KB as ACE Memory Log

    Ctrl->>LLM: 次の探索テーマを提案してっ！✨
    LLM-->>Ctrl: 新規アルファ仮説
    Ctrl->>FE: データ取得と特徴量生成っ！
    FE-->>Ctrl: 計算済みベクトル
    Ctrl->>VE: バックテスト実行っ！📈
    VE-->>Loop: パフォーマンスメトリクス
    Ctrl->>SE: スコア算出 Fitness Novelty
    SE-->>Ctrl: 最終採択スコア
    Ctrl->>KB: 採択結果と改善方針を記憶っ！🧠
    Ctrl->>Ctrl: 失敗閾値チェック & 次サイクルへ
```

---

## 2. 🚀 探索ランブック：実行と入口 💎

### 2.1 実行経路の一元化 (Task SSOT)
入口は Task に一本化！直接実行は「めっ！」だよっ！💢
- `task run:newalphasearch`
- `task run:newalphasearch:loop`

### 2.2 毎サイクル必須の証跡
- **必須ログ**: `logs/unified/alpha_discovery_*.json`
- **必須 plot**: `cycle_performance.png`, `alpha_novelty.png`, `failure_streak.png`
- **必須 score**: `fitness_score`, `novelty_score`, `stability_score`, `adoption_score`

---

## 🛡️ 運用のお約束 (Operational Rules) ✨
- **差分の保証**: 毎サイクル、前回と異なる「新しいアイデア」を出すことを義務化。
- **安全停止 (Fail-safe)**: 連続失敗回数が閾値を超えたら、原因を記録して安全に停止。
- **一元管理**: 思考は LLM、決定はルールと数値で厳格に分けるよっ！🐾

---

## 🏁 成立判定 (Definition of Done)
- 各サイクルで unified log が正常に増えていること。
- 各サイクルで新しい plot と score が保存されていること。
- 失敗が連続した際に、安全に自動停止すること。

**Owner**: Antigravity Quant Team 💖  
**Status**: **Autonomous Alpha Spec v3.1** ✨🚀🌈💖
