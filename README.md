

**Investor Agent** は、LLM（Gemini 3 Flash）によるインテリジェンスと厳格な TypeScript プロトコルを活用し、資本を自律的に運用する次世代のクオンツ・トレードシステムである。多層的なエージェント・アーキテクチャを通じて、生の市場データを「富」へと変換する。

### 🎭 司令塔 (エージェント)

現在は「野菜インフレ・ローテーション」戦略を中心に、以下の特化型エージェントが連携して動作しているよっ！

| エージェント | 役割 | 使用データソース |
| :--- | :--- | :--- |
| `PeadAgent` | 決算サプライズの解析 | JQuants |
| `XIntelligenceAgent` | SNSセンチメントの数値化 | X (Grok) |
| `LesAgent` | 財務ドキュメントの定性解析 | LLM (Gemini) |

---

## 🛠️ 技術スタック & アーキテクチャ

- **ランタイム**: [Bun](https://bun.sh/) (最速の JS ランタイム)
- **言語**: [TypeScript](https://www.typescriptlang.org/) (Strict モード, Zod バリデーション)
- **ダッシュボード**: [Vite](https://vitejs.dev/) & Vanilla CSS
- **インテリジェンス**: Gemini 3 Flash (Primary LLM)
- **ツール**: [Biome](https://biomejs.dev/) (Lint & フォーマット)
- **コア原則**:
    - **Fail-Fast**: バリデーションエラーや通信エラー発生時は即座に終了。
    - **不変性 (Immutability)**: シグナルと設定は作成後、厳格に読み取り専用。
    - **DIP (依存性逆転)**: 堅牢なテストとモック化を可能にする設計。

---

## 🚀 はじめに

### 事前準備
- [Bun](https://bun.sh/) がインストールされていること。
- JQuants, EDINET 等の API キー (`.env` で設定)。

### クイックセットアップ
```bash
# 依存関係のインストール
task setup

# デイリー統合ワークフローの実行
task daily
```

### 利用可能なタスク
| コマンド | 説明 |
| :--- | :--- |
| `task setup` | 環境の初期化と依存関係のインストール。 |
| `task daily` | 全行程のワークフローを実行 (Lint -> Check -> Start)。 |
| `task check` | 厳格な TypeScript 型チェック。 |
| `task lint` | Biome によるコードのクリーンアップ。 |
| `task format` | プロジェクト標準に従ったコード整形。 |

---

## 🛡️ コーディング・プロトコル

本プロジェクトでは **Zero-Fat** 開発プロトコルを遵守する。すべてのコードは必要不可欠であり、型付けされ、検証されていなければならない。

> [!TIP]
> エージェントのライフサイクルやシグナル・プロトコルの詳細については、[AGENTS.md](file:///home/kafka/finance/investor/AGENTS.md) を参照。

---
世界で一番美しく、正確なロジックで。
私たちのコードが、未来の富を成就させる。 💖🚀💰✨
