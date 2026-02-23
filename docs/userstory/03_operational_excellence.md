# ユーザーストーリー：実運用と可視化 (Operation & Dashboard)

## 可視化と信頼性（Visualization & Reliability）
- **運用管理者として**、システムの推論プロセスを**レイテンシ 100ms 以下の高レスポンスなダッシュボード**で一気通貫で確認したい。
    - **詳細要件**: ArXiv Tier 1-4 の Standardized Outcome、Option Greeks、Numerai Metrics、Fama-French ファクターを統合可視化する。
    - **利益獲得への具体パス**: 
        2. 複雑なクオンツ指標（CORR/MMC）を直感的な UI で把握し、ポートフォリオの偏りを即座に修正。
        3. 運用・改善・検証のサイクル（PDCA）を高速化し、収益機会の最大化とリスク発生時の即時対応を実現する。
- **監査人として**、ArXiv スタイルの 4層 Outcome を含む**整合性のある統合ログ** (`logs/unified/YYYYMMDD.json`) を参照し、AI のロジックの透明性とトレーサビリティを確保したい。

