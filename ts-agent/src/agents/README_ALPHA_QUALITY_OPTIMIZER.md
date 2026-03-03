# AlphaQualityOptimizer Agent

## 概要（Overview）

The AlphaQualityOptimizer agent evaluates and enhances LLM-generated alpha DSL using 4 lightweight quality metrics to target fitness scores > 0.5.

目的：LLM 生成アルファ DSL を多角的に評価・最適化し、fitness スコア 0.5+ を達成するエージェント

## アーキテクチャ（Architecture）

- **Input**: Alpha prompt (text), market snapshot (OHLCV), playbook patterns (historical successful factors)
- **Process**: Qwen DSL generation → validation → 4-metric evaluation → fitness aggregation
- **Output**: Optimized DSL + fitness score + detailed report

## 4 つのメトリクス（4 Metrics）

1. **Correlation Score**: Pearson correlation between factor and returns (normalized to [0, 1])
   - Measures how strongly the extracted factors correlate with market returns
   - Ranges from 0 (no correlation) to 1 (perfect positive correlation)

2. **Constraint Score**: Compliance with Sharpe > 1.5, IC > 0.04, MaxDD < 0.10
   - Evaluates whether the factor meets risk-adjusted return thresholds
   - Score = 1.0 if all constraints met, decays to 0.0 if violated
   - Sharpe ratio weight: 0.5 | Information coefficient weight: 0.3 | Max drawdown weight: 0.2

3. **Orthogonality Score**: Jaccard distance from existing playbook patterns (1.0 = fully new)
   - Measures how unique the DSL is compared to historical successful factors
   - Prevents redundant factor development
   - Encourages innovation and diversification

4. **Backtest Score**: Normalized from Sharpe and IC ranges
   - Aggregates Sharpe ratio and information coefficient into single quality metric
   - Sharpe normalization: target range [0.5, 3.0], clamped to [0, 1]
   - IC normalization: target range [0.01, 0.15], clamped to [0, 1]

## 統合ポイント（Integration Point）

Integrates into `pipeline_orchestrator.ts` BEFORE the `factor_mining` phase. Transforms alpha prompt into optimized DSL automatically.

The agent is instantiated in the orchestrator and called during the alpha discovery cycle to ensure all generated factors meet quality thresholds.

## エラーハンドリング（Error Handling）

- **Strict Validation**: No fallback to Claude API. Qwen-generated DSL is strictly validated.
  - Invalid DSL functions/factors are rejected with clear error messages
  - Only repairs allowed: adding missing "alpha =" prefix, whitespace normalization

- **Auto-Repair**: Simple repairs (missing "alpha =") are attempted automatically.
  - DSL validator includes repair logic for common formatting issues
  - Repaired DSL is logged with original for audit trail

- **Reject-on-Invalid**: Unrepairable DSL throws error and triggers pipeline rejection.
  - No fallback to Claude or other APIs
  - Fail-fast approach ensures data integrity
  - Error contains detailed information about what validation failed

## 使用方法（Usage）

```typescript
import { AlphaQualityOptimizerAgent } from "./alpha_quality_optimizer_agent.ts";
import type { AlphaQualityOptimizerInput } from "../schemas/alpha_quality_optimizer_schema.ts";

const optimizer = new AlphaQualityOptimizerAgent({
  modelId: "qwen:latest",
  metricsWeights: {
    correlation: 0.25,
    constraint: 0.25,
    orthogonal: 0.25,
    backtest: 0.25,
  },
});

const result = await optimizer.run({
  alphaPrompt: "Japanese low-volatility effect...",
  marketData: {
    symbols: ["1301", "1308"],
    returns: [[0.01, -0.02, 0.015, ...]],
    volatilities: [0.15, 0.18],
    sharpeRatio: 2.1,
    informationCoefficient: 0.06,
    maxDrawdown: 0.08,
  },
  playbookPatterns: [],
});

console.log(result.fitness); // [0, 1] score
console.log(result.optimizedDSL); // "alpha = rank(volatility) * -1 + ..."
console.log(result.detailedReport); // Contains all 4 metric scores
```

## テスト（Testing）

Unit tests for each metric: `ts-agent/tests/agents/metrics/`
- `correlation_scorer.test.ts`: Validates correlation score calculation
- `constraint_scorer.test.ts`: Validates constraint compliance scoring
- `orthogonality_scorer.test.ts`: Validates uniqueness scoring
- `backtest_scorer.test.ts`: Validates backtest quality aggregation

Integration test: `ts-agent/tests/agents/alpha_quality_optimizer_agent.test.ts`
- Tests full pipeline with mock data
- Validates DSL generation and metric computation
- Checks fitness aggregation logic

E2E test: `ts-agent/tests/e2e/alpha_quality_optimizer_e2e.test.ts`
- Full integration with market data gateway
- Tests with real historical data
- Validates end-to-end DSL optimization

全テスト実行: `bun test`

## ログと監視（Logging and Monitoring）

The agent emits structured telemetry at each stage:

- **Stage**: `alpha_quality_optimizer.evaluate`
- **Direction**: `IN` (input), `OUT` (output), `INTERNAL` (metrics)
- **Metrics emitted**:
  - `fitness`: Final aggregated fitness score [0, 1]
  - `duration_ms`: Total execution time in milliseconds
  - All 4 individual metric scores for detailed analysis

Example telemetry output:
```json
{
  "ts": "2026-03-04T10:30:45.123Z",
  "level": "METRIC",
  "stage": "alpha_quality_optimizer.evaluate",
  "direction": "INTERNAL",
  "name": "fitness",
  "values": {
    "correlation": 0.72,
    "constraint": 0.85,
    "orthogonal": 0.65,
    "backtest": 0.78,
    "fitness": 0.75
  }
}
```

## パフォーマンス特性（Performance Characteristics）

- **Time Complexity**: O(n) where n = number of factors in DSL
- **Space Complexity**: O(m) where m = size of market data snapshot
- **Typical Execution Time**: 200-500ms per optimization
  - Qwen DSL generation: ~150-300ms
  - Validation and repair: ~20-50ms
  - Metric computation: ~30-150ms

## 成功指標（Success Criteria）

An alpha factor is considered successfully optimized when:

1. **Fitness Score >= 0.5**: Indicates balanced quality across all 4 metrics
2. **DSL Validity**: Passes strict validation with no errors
3. **Correlation**: Positive relationship with returns (correlation > 0)
4. **Constraint Compliance**: Meets at least 2 of 3 constraints (Sharpe, IC, MaxDD)
5. **Orthogonality**: Does not duplicate existing playbook patterns

## トラブルシューティング（Troubleshooting）

**Problem**: DSL validation fails with "invalid function name"
- **Solution**: Check Qwen prompt template in `prompts/qwen_alpha_dsl_prompt.ts`. Ensure only whitelisted functions are used.

**Problem**: Fitness score is always < 0.3
- **Solution**: Review market data snapshot. May indicate insufficient volatility or poor signal quality. Consider adjusting metrics weights.

**Problem**: Agent timeout
- **Solution**: Check Qwen model availability. May need to fall back to local model or increase timeout threshold.

## リファレンス（References）

- Qwen DSL generation: `src/agents/prompts/qwen_alpha_dsl_prompt.ts`
- Metric implementations: `src/agents/metrics/`
- DSL validator: `src/agents/validators/dsl_validator.ts`
- Integration: `src/system/pipeline_orchestrator.ts`
- Schema definitions: `src/schemas/alpha_quality_optimizer_schema.ts`
