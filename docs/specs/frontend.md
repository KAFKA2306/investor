## 0. Mission Control: Decision Support Interface (DSI)

The Antigravity **Decision Support Interface (Mission Control v3.0)** is an institutional-grade visual engine designed to calibrate alpha evidence, monitor risk attribution, and facilitate high-conviction investment decisions.

This interface is the "High-Fidelity" bridge between the **Autonomous Alpha Factory** and the portfolio manager. It adheres to the principle of **"Immutable Evidence"**: every visual data point is physically bound to an unchangeable audit trail in the backend ledger (UQTL).

## 1. Technological Foundation: Zero-Fat High-Performance UI

The DSI is built for extreme responsiveness and statistical accuracy, ensuring that the "Speed of Thought" is never limited by the "Speed of Render".

### 1.1 Tech Stack
- **Engine**: [Bun](https://bun.sh/) (Lighweight Build & Runtime)
- **Pipeline**: [Vite](https://vitejs.dev/) (Instant HMR)
- **Logic**: [TypeScript](https://www.typescriptlang.org/) (Strictly Typed Decision Models)
- **Styling**: [Vanilla CSS](https://developer.mozilla.org/en-US/docs/Web/CSS) (Zero-Abstraction Performance)
- **High-Fidelity Charting**: [D3.js](https://d3js.org/) / Canvas (For precise IC/DSR distribution rendering)

### 1.2 Design Philosophy: Actionable Alpha Hierarchy
To maximize "Signal-to-Noise", the interface enforces a strict hierarchy:
1. **Decision (Actionability)**: Leading with active trades and capital allocation.
2. **Analysis (Economic Logic)**: The "Why" behind the alpha (Signal decomposition).
3. **Evidence (Quantitative Rigor)**: Statistical proof (DSR, PSR, Orthogonality).
4. **Audit (Data Lineage)**: Raw PIT (Point-in-Time) logs for final verification.




---

## 2. インターフェース提供機能の詳細定義 (Functional Profile)

本検証インターフェースは、投資家および計量分析官に対し、以下の具体的機能（Functionality）を提供する。

### 2.1 実績データの不変同期および完全性保証 (L1)
- **【機能F1】投資実績データの不変同期**: バックエンド不変台帳と同期し、最新の `InstitutionalOutcome` を 100ms 以内の遅延で取得する。
- **【機能F2】リアルタイム整合性監査**: 受信パケットの署名検証を行い、1ビットの差異も許さず「証拠の純粋性」を保証する。
- **【機能F2.1】データ・ヘルス・レーダー**: 入力データの遅延、欠損率、および統計的な歪み（Skewness/Kurtosis）をリアルタイムで監視し、証拠の「鮮度」と「品質」を視覚化する。

### 2.2 計量検証および統計的反証プログラミング (L2)
- **【機能F3】図的 DSR/PSR 裁定**: 弃却済み試行回数履歴を加味した Deflated Sharpe Ratio (DSR) を算出し、その有意義性を標準正規分布曲線上の色分けされた領域として描画する。
- **【機能F4】CSCV 過学習ヒートマップ**: 組合せ論的クロスバリデーション結果をパラメータ軸と時間軸の 2 次元ヒートマップで可視化し、過学習領域を特定する。
- **【機能F5】動的ファクター・アトリビューション**: 実現リターンを市場ベータ、セクター、スタイル（Size, Value, Momentum等）へ分解。Brinson-Fachlerモデルに基づき、銘柄選択効果 (Selection) と配分効果 (Allocation) を図的に分離表示する。
- **【機能F5.1】アルファ減衰および IC Half-life**: 予測情報（アルファ）の時間経過に伴う有効性減衰を可視化。情報係数 (IC) の半減期を特定し、最適なリバランス周期を計量的に示唆する。

### 2.3 意思決定プロセスおよび論理系譜の可視化 (L3)
- **【機能F6】推論系譜 DAG レンダリング**: Gemini 3.0 Pro の推論ステップを SVG キャンバス上に有向グラフとして展開し、論理の飛躍がないかを視覚的に点検させる。
- **【機能F7】エビデンス・ハイライト同期**: 推論ステップを選択すると、対応するチャート上の期間および財務データポイントが強調表示され、図的な「証拠の立証」を完遂する。

### 2.4 執行現実性および流動性制約のモデリング
- **【機能F8】マーケットインパクト・カーブ提示**: 注文サイズに応じたマーケットインパクトの非線形な減衰曲線を描画し、運用限界（Capacity Cliff）を図的に明示した上で、L-VaR（流動性調整 VaR）を算出する。
- **【機能F9】レジーム別ストレス・テスト散布図**: 過去の金融危機レジーム（2008年リーマン、2020年コロナ等）を期間選択し、分布図上にオーバーレイ。特定の市場環境下での戦略の脆弱性を反証的に抽出する。
- **【機能F10】データ・リネージのビジュアル・トレース**: アルファ算出に供された正規化・前処理の各ステップを視覚化し、「証拠の汚染」がどの工程で混入したかを特定可能にする。

### 2.5 統合タスク台帳 (Unified Task Ledger: UQTL)

タスクの進行状況を単なる「％」ではなく、多次元の確信度ベクトルとして可視化する。

- **【機能F11】4次元インテリジェンス・ベクトル**: 進捗を「Time, Logic, Risk, Data」の 4 軸で構成。
  - **Time**: Readiness スコアおよびクロック同期。
  - **Logic**: バリデーションパイプラインの通過率。
  - **Risk**: Kelly 分数および損切設定の妥当性。
  - **Data**: データ鮮度とエビデンスの完全性。
- **【機能F12】Quantum Entropy (不確実性視覚化)**: 上記 4 軸の不足分を「不確実性（Entropy）」として表示し、意思決定の危険度を直感的に示す。
- **【機能F13】Self-Healing DAG (動的パイプライン)**: 監査プロセスで棄却されたパスを明示し、正常に完遂された論理パスを SVG グラフとして可視化する。


### 2.6 標準運用基盤および資産管理 (Standard Operational Core)
- **【機能F14】真実のポジション・台帳**: 不変台帳と完全同期した現在位置（Positions）および保有コストの提示。ベンチマーク対比でのアクティブ・ウェイトを動的に算出。
- **【機能F15】執行履歴および監査証跡**: 全ての約定（Fills）および注文（Orders）を時系列で網羅。執行タイミングのティックデータとバインドし、スリッページ発生原因を直接検証可能にする。
- **【機能F16】マルチ・ベンチマーク比較チャート**: 累積リターン、ドローダウン、ボラティリティを主要指数（TOPIX, S&P500等）と動的に比較し、戦略の相対的優位性を実証する。

---

## 3. 実運用において遵守すべき投資適格基準 (Acceptance Criteria)

### 3.1 実績証拠の誠実性基準 (Evidence Sincerity Standards)
- **[条件E1] Point-in-Time (PIT) 証拠**: 全ての計量判断は、その判断に供されたデータが市場で一般利用可能となった時刻（Available Stamp）を証拠として保持しなければならない。
- **[条件E2] サバイバーシップ・バイアスの排除**: 銘柄ユニバース表示において、期間途中に上場廃止となった銘柄の時系列データが完全な証拠として含まれていることを検証可能にすること。
- **[条件E3] ゼロ・プルーニング原則**: 表示されるデータにおいて、好ましくない結果を意図的に隠蔽、または省略することを厳禁し、全ての失敗した試行も「証拠」として提示しなければならない。

### 3.2 統計的棄却および図的整合性の閾値
- **DSR 閾値**: $DSR < 1.1$ の戦略は「図的に棄却」対象とし、UI 上の信頼性ステータスを「拒絶」に固定すること。
- **P-Value 有意性**: 有意確率 $P > 0.001$ の場合、分布図において該当する不確実性領域を警告色でハッチング表示すること。

---

## 4. アーキテクチャ構成の詳細

インターフェースは以下の 3 つの裁定レイヤで構成され、データ駆動型の整合性を基軸とする。

### 4.1 L1: データ同期・整合性レイヤ (Data Sync Layer)
バックエンド（`logs/` ディレクトリ）から受領した JSON データのハッシュ整合性を検証する。ダッシュボードは **30秒間隔** で自動リフレッシュを行い、常に最新の「証拠」を同期する。

### 4.2 L2: 計量分析レイヤ (Analytics Engine)
受領した `DailyReport` から DSR, PSR, Kelly Fraction 等の計量指標を抽出し、UI 上の KPI カードおよびチャートへマッピングする。

### 4.3 L3: 可視化・執行レイヤ (Visual Execution Layer)
SVG または Canvas を用いた時系列チャートおよび DAG（有向グラフ）のレンダリング。`UQTL` インジケータによる意思決定の確信度表示を行う。


---

## 5. 付録：計量アルゴリズム、データ規格、および型定義（一切の省略なし）

### 5.1 数理的検証指標の計算および図的生成プロセス

#### A. Probabilistic Sharpe Ratio (PSR) と 証拠分布の統合
$$PSR(\text{threshold}) = Z\left(\frac{(\widehat{SR} - SR^{*})\sqrt{T-1}}{\sqrt{1 - \hat{\gamma}_3 \widehat{SR} + \frac{\hat{\gamma}_4 - 1}{4} \widehat{SR}^2}}\right)$$
各変数は、バックエンド不変台帳より供給された証拠値（観測リターン系列）より動的に算出される。

### 5.2 伝送データ整合規格 (Standardized Transmission Schemas)

### 5.2 伝送データ規格 (Standardized Data Schemas)

実際のダッシュボードで消費される、主要なデータインターフェース定義を以下に示す。

```typescript
/**
 * 投資検証インターフェース・コアデータ規格 (Daily Report v1)
 */
interface DailyReport {
  date?: string;
  analyzedAt?: string;
  workflow?: {
    dataReadiness?: string;
    alphaReadiness?: string;
    verdict?: string;
  };
  evidence?: {
    estat?: { status?: string };
    jquants?: { status?: string; listedCount?: number };
  };
  decision?: {
    strategy?: string;
    action?: string;
    topSymbol?: string;
    reason?: string;
  };
  results?: {
    expectedEdge?: number;
    basketDailyReturn?: number;
    status?: string;
    backtest?: {
      netReturn?: number;
      totalCostBps?: number;
    };
  };
  risks?: {
    kellyFraction?: number;
    stopLossPct?: number;
  };
  analysis?: Array<{
    symbol: string;
    alphaScore?: number;
    factors?: Record<string, number>;
  }>;
}
```


---

## 6. 結論：データと論理の「実証的」ダッシュボード

本仕様書（HEL v3.0）は、Antigravity システムにおけるフロントエンドの役割を、抽象的な監視ではなく**「データの整合性証明」**および**「意思決定のリスク可視化」**に再定義したものである。

全ての計量指標はバックエンドの不変ログに直結し、`UQTL` インジケータによって執行の確信度を定量的かつ図的に提示する。これにより、投資家はバイアスを排し、科学的かつ証拠に基づいた裁定を行うことが可能となる。


---

## 7. 実装済みのコア機能 (Implemented MVP Core)

現在のダッシュボードにおいて既に実装され、検証に供されている必須機能を定義する。

### 7.1 主要データ表示 (Essential Monitoring)
- **【実装済M1】リターン推移チャート**: `results.basketDailyReturn` を時系列で描画。
- **【実装済M2】KPI カード群**: `Edge`, `Return`, `Kelly`, `Stop Loss` 等の主要統計を最前面に表示。
- **【実装済M3】シグナル・ボード**: 銘柄ごとの Alpha Score および財務・テクニカル要因の分解一覧。

### 7.2 高度な検証ビュー (Advanced Verification)
- **【実装済M4】UQTL 4D ストリーム**: Time/Logic/Risk/Data の 4軸から算出した Entropy（不確実性）の可視化。
- **【実装済M5】Self-Healing DAG**: 処理フェーズ（Data -> Alpha -> Audit -> Execution）の状態遷移と成否をグラフ化。
- **【実装済M6】Evidence Bonding**: 実行中のタスクや銘柄スコアに関連する UUID 形式の証拠 ID を表示。

### 7.3 信頼性・品質保証 (Quality Safeguards)
- **【実装済M7】整合性インジケータ**: 取得したログの `immutableGitHash` に基づく証拠整合性の確認。
- **【実装済M8】30s ポーリング**: 自動更新による最新の意思決定ログの追随。

