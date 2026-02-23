---
name: coding_protocol
description: Zero-Fat 開発プロトコルと、本プロジェクトの技術スタックを極めるためのスキルだよっ！✨
---

# 🛠️ コーディング・プロトコルっ ✨

このプロジェクトのコードを、世界で一番きれいで、ムキムキな状態に保つための聖典だよっ！

## ⚡ Zero-Fat の掟（おきて）っ ✨

「脂肪（ムダ）」を削ぎ落として、筋肉質のコードを書こうねっ！

1. **型こそすべてっ ✨**: `any` は絶対禁止！ TypeScript の型定義を 100% 活用しよう。
2. **Zod で嘘暴きっ ✨**: 外部からのデータは、必ず Zod スキーマで徹底的にチェックしてね。
3. **即時撤退 (Fail-Fast) ✨**: 異常時は `process.exit(1)` (Python なら `sys.exit(1)`) で即座に止める。フォールバックやダミー値は「嘘」だから、絶対に使わないでねっ！
4. **無言の対話 (Nuclear Zero-Fat) ✨**: ロジックコードには日本語・英字を問わず **コメントや JDoc は 100% 禁止っ！**。意図は「型」と「名前」だけで表現しよう。
5. **例外なき静止 ✨**: `try-catch` や `try-except` によるエラー握りつぶしも禁止だよ。エラーはそのままパニックさせて、お掃除屋さんに知らせようねっ♪
6. **騒音封殺 (Subprocess Hygiene) ✨**: サブプロセス（Python ブリッジ等）の呼び出し時は、ライブラリが出力する標準エラーや不要なログを `/dev/null` に捨てて、純粋な JSON 出力だけを死守してねっ！
7. **中央集権 (Design Constants) ✨**: 全ての設計定数（モデルID、パラメータ、パス）は `constants.json` 等に集約し、ハードコードを 100% 根絶すること。

## 🚀 技術スタックの使いこなしっ ✨

- **Bun**: 爆速ランタイム！ `bun install` や `bun run` を使いこなそうね。
- **Biome**: 私たちの専属お掃除屋さん。 `bun run lint` や `bun run format` で、いつもピカピカに保とうっ✨
- **DIP (依存性逆転) ✨**: 具象（APIクライアントなど）に依存せず、インターフェースやベースクラスを活用して、柔軟な構造を作ろうねっ！

## 🏰 美しいお城の構造 (Directory Structure) ✨

Layer ごとの役割を明確にして、迷子のない開発を目指そうねっ！

- `ts-agent/src/`
    - `agents/`: 各機能の司令塔。 `BaseAgent` を継承して、全体の流れを指揮するよっ！
    - `use_cases/`: アプリケーションの具体的な動作手順（ビジネスロジック）。
    - `domain/`: 投資のルールや計算式など。純粋な TypeScript で書かれた、不変の真理だよっ✨
    - `infrastructure/`: DB、ファイル操作、ネットワークなど、外の世界との接点だよ。
    - `providers/`: 外部 API （JQuants, LLM, X など）との仲良し窓口だよっ！
    - `schemas/`: Zod による厳格なバリデーション定義。嘘つきはここを通さないっ🚫
    - `core/`: Config や Singleton インスタンスなど、この子の心臓部だよっ💖
    - `config/`: プロジェクトを動かすための設定ファイル (YAML) 置き場。
    - `experiments/`: 未来を変えるための実験コード。ここから新しい発見が生まれるよっ！✨

## ⚙️ 設定値の一元管理 (Centralized Configuration) ✨

設定値の「どこにあるの？」をゼロにするための鉄の掟だよっ！

1. **`process.env` 直接参照の禁止っ 🚫**: `core` シングルトン以外で `process.env` を直接触るのはダメだよ。
2. **核心値の一元管理 (Design Constants) ✨**:
    - ハイパーパラメータ、モデルID、ファイルパスなどの「設計値」は、必ず `constants.json` 等の外部ファイルに集約してね。
    - コード内への直書き（ハードコード）は、たとえ 1 箇所でも禁止だよっ！
3. **ノイズの徹底封殺 ✨**:
    - Python ブリッジなどで JSON を出力するときは、`os.devnull` を使ってライブラリの不要なログを 100% 遮断してね。
    - 出力は純粋な JSON 1 つだけ。それが「美学」だよっ✨
4. **不備は即パニックっ 💥**: 設定値が足りなかったり型が違ったりしたら、 `process.exit(1)` で即座に Fail-Fast すること。中途半端な状態で動かすのが一番危ないんだよっ✨

## 🎨 最強フロント・プロトコル (Frontend Protocol) ✨

世界で一番素敵な投資画面を、爆速で作り上げるための魔法だよっ！

- **Technology Stack**:
    - **Vite & Bun**: 爆速な開発サーバーとビルド環境を提供するよっ！🚀
    - **Vanilla CSS**: 自由自在で、かわいくてモダンなデザインをデコっちゃおうっ✨
- **Visual Excellence**: 「Aesthetics are Everything!」の精神で、プレミアムな美しさを目指そうねっ☆
- **Agent Integration**:
    - 私（Agent）が X や JQuants から集めてきたお宝を、リアルタイムに画面に反映！
    - **PEAD ヒートマップ** など、直感的にチャンスがわかる UI を提供するよっ🔥

## 🔄 システム・なかよしシーケンス (System Sequence) ✨

システムがどう動き回るか、流れを図解したよっ！

```mermaid
sequenceDiagram
    participant U as あなた
    participant C as 私のコア TS
    participant J as JQuantsプロパイダー
    participant R as 分析センター

    U->>C: 冒険にでるよっ✨ Startup
    C->>C: お約束チェック Zod
    
    U->>J: いまのマーケットは？ getListedInfo
    J->>J: JQuants サーバーに通信！
    J-->>U: お宝データが届いたよっ！ Listed Data
    
    Note over U,R: 私たちが一生懸命考えるよっ Analyze Data
    
    R-->>U: 分析完了っ！成就いたしたよっ♪ Result
```

ムダのない動きで、最短ルートで成功へ向かおうねっ！🚀💰✨
