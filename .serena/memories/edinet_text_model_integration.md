# EDINET Text Model Integration

## 📊 アーキテクチャ

### Text Extraction Layer
**File**: `dashboard/src/utils/edinet_extractor.ts`
- 会社概要 (company overview)
- 財務指標 (financial metrics)
- 主要製品 (main products)
- リスク・課題 (risks/challenges)

⚠️ **Status**: Define済み but **使用されていない** (dashboard utilities only)

### Feature Integration Layer
**File**: `pipeline/factor_mining/factor_compute_engine.ts`

| Feature | Type | Source | Behavior | Status |
|---------|------|--------|----------|--------|
| `correction_freq` | Governance | EDINET event_features.correction_count_90d | Defaults to 0 | ✅ Safe |
| `macro_iip` | Macro | Unknown | Returns NaN if missing | ⚠️ Strict |
| `macro_cpi` | Macro | Unknown | Returns NaN if missing | ⚠️ Strict |

### LES Agent Feature Set
**File**: `agents/latent_economic_signal_agent.ts`

Available features for AST generation:
```
- OHLCV: close, open, high, low, volume
- EDINET: correction_freq, activist_bias
- Macro: macro_iip, macro_cpi
- Sentiment: segment_sentiment, ai_exposure, kg_centrality
```

## 🔍 データ品質問題

### Potential Issues in Ralph Loop Iteration 1

1. **macro_iip/macro_cpi 欠損**
   - NaN 返却 → Backtest fails
   - All alphas rejected with high MaxDD

2. **correction_freq 不適切な使用**
   - AST: `macro_iip - macro_iip = 0` (Alpine QUANT-ACE1C43A)
   - 意味のない因子生成

3. **Intelligence Map Missing**
   - `/mnt/d/.../edinet_10k_intelligence_map.json` 未生成
   - I/O verification できない

## ⚡ 改善の方向性

### Option 1: Text Model 活性化
- `extractKeyInsightsFromEdinetContent()` を使って sentiment/risk features 作成
- NLP 特徴量を alpha generation に組み込む

### Option 2: Data Quality修復
- `task pipeline:edinet-io-repair` 実行
- Intelligence map regenerate
- macro_iip/macro_cpi 填補

### Option 3: Feature Engineering強化
- Text embedding from EDINET (e.g., risk sentiment score)
- Company health metrics from disclosure patterns
- Correction penalty integration into alpha scoring

## 🎯 推奨次アクション

1. **Data Quality**: repair -> verify (Intelligence map)
2. **Text Model**: Activate extractor in feature pipeline
3. **LES Agent**: Prompt改善 for better AST generation
