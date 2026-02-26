# ts-agent：投資システムの中心部

このプロジェクトは、自律型投資エンジンの心臓部です。

## 🧬 システムの流れ

```mermaid
sequenceDiagram
    autonumber
    participant P as データ提供元
    participant C as コア（型定義）
    participant A as エージェント（知能）
    participant U as 実行プログラム
    participant L as ログ保存

    U->>C: 1. 初期設定
    U->>P: 2. データの取得
    P-->>U: 生データ
    U->>C: 3. データの確認（厳密なチェック）
    C-->>U: 正しいデータ
    U->>A: 4. 分析と戦略の実行
    A-->>U: 投資スコアとシグナル
    U->>L: 5. 結果を保存 (JSON 形式)
```

## 🚀 使い方

```bash
# 必要なソフトをインストール
bun install

# 分析プログラムを実行
bun run start
```

## 🏗️ フォルダの中身

- `src/agents/`: 分析を行う「知能」部分。
- `src/use_cases/`: 具体的な実行手順（データの流れ）。
- `src/experiments/`: 新しい投資戦略を試す場所。
- `src/schemas/`: データが正しいか厳密にチェックする定義。
- `src/providers/`: 外部サービスとの連携。

---
このプロジェクトは Bun を使用して作成されています。
💖🚀💰✨
