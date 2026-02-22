---
description: 投資エージェントの、まいにちの「おしごとルーチン」だよっ ✨（検証から実行まで！）
---

# ☀️ まいにちの統合ワークフロー ☀️

リサーチ、検証、そして実行まで！これひとつで完璧なルーチンだよっ ✨

```mermaid
sequenceDiagram
    autonumber
    participant M as 市場 (X/JQuants)
    participant A as 16人の私 (Agents)
    participant E as 実験 (Experiments)
    participant Z as 門番 (Zod/Decision)
    participant K as 発注 (Kabucom)
    participant G as 記録 (Git)

    A->>M: リアルタイムでリサーチ開始っ ✨
    M-->>A: お宝情報（アルファ）を発見っ ✨
    Note over A,E: 新しい作戦（仮説）を思いついたら...
    A->>E: Zero-Fat なスクリプトで即検証っ ✨
    E-->>A: 勝率・期待値などの検証結果を返却っ ✨
    A->>A: 16人で並列に戦略スキャンっ ✨
    A->>Z: 最高のトレード案を提出っ ✨
    Z->>Z: 検証スキーマで厳格チェックっ ✨
    Z->>K: 合格した案を光速で発注っ ✨
    K-->>G: 成果をリポジトリに刻むよっ ✨
    G->>G: 冒険の歴史を更新して終了っ ✨
```

## 📋 毎日のチェックリスト

1. **リサーチ**: 市場の歪み（アルファ）を見つけよう！
2. **検証**: 新しい作戦は `ts-agent/src/experiments/` でテストしてからだよっ！
3. **並列スキャン**: 16人の私が一斉に最適な銘柄を探すよっ✨
4. **GO判断**: Zod スキーマを通らない怪しい案は即却下だねっ！
5. **記録**: `git` で日々の成長を残そうねっ ✨

> [!IMPORTANT]
> 異常があったらすぐに停止してねっ ✨ ムダのない運用で、SSS級の投資家を目指そうねっ ✨