# Alpha Discovery Mission: Macro-Micro Lead-Lag (Mission 3.0)

## mission
探索目的: **e-Stat (経済統計)** の行使・公表マクロ指標（IIP: 鉱工業指数、CPI: 消費者物価指数）と、特定セクター銘柄の価格形成における「時間的リード・ラグ関係」を特定せよ。
マクロ指標の公表タイミング（PIT）に基づき、数日から数週間後に顕在化するセクター別の「超過収益のうねり」を捉える直交アルファを検索せよ。

### 探索の重点
1. **Industry-IIP Sensitivity**: 鉱工業指数の「製造工業」サブカテゴリと、製造業セクター銘柄の先行・遅延関係を AST 式で表現せよ。
2. **CPI-Consumption Lag**: 物価上昇（CPI）が内需・消費セクターの利益率（Margin）に反映されるまでの lag を捉え、先行する物価指標が個別株価に波及するポイントを特定せよ。
3. **Cross-Macro Synergy**: IIP と CPI の複合因子による、景気サイクル・フェーズ別の動的レジーム・スイッチングを抽出せよ。

## constraints
- ターゲット銘柄: TOPIX100 およびセクター別主要銘柄。
- 禁止領域: 統計的有意性が低い（p > 0.05）単発のイベント・ドリブン。
- 納入条件: Sharpe Ratio > 1.5, IC > 0.05, 低相関（既存の 10-K 感情因子との相関 < 0.2）

## memory_context
- **履歴シード**: Macro-Socio Divergence (ALPHA-QUANT-12DC0604), Industrial Lead (Hypothesis).
- **既存採否理由**: 10-K 感情因子 (`12DC0604`) はバックテストでのシグナル分散が低かった。今回はより「公表頻度」と「ボラティリティ」が明確な e-Stat マクロ指標をトリガーとし、明確な IC の創出を狙う。

## data_contract
- 必須カラム: MacroIIP, MacroCPI, SectorPrice, AnnouncementDate
- PIT条件: e-Stat の「公表予定日」および「確報値」のタイミングを厳格に順守。
- 納入閾値: quality_score > 0.85, data_freshness > 2024

## evaluation_contract
- 指標公表後 T+1 から T+10 までの累積超過収益（CAR）の予測精度を重点的に評価。

## return_path
- マクロデータの取得に失敗する場合: `EstatProcessor` の API 接続をリフレッシュし、手動 ingestion パスを検討。
- 相関が高い場合: グラム・シュミット過程による直交化を `FactorComputeEngine` に追加検討。
