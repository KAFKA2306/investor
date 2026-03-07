---
name: qlib-investor-integration
description: >
  MANDATORY TRIGGER: Invoke only when a request is about using qlib with this
  investor repo or its Japanese equities research workflow. Use this skill when
  the request mentions qlib together with this repo, investor, Japanese
  equities workflow, alpha research integration, benchmark or backtest
  comparison, or dataset, handler, or workflow migration inside this codebase.
  Do not use this skill for generic qlib questions that are not tied to this
  repo.
---

# Qlib Investor Integration

Use this skill to decide whether qlib belongs in the current task, where it fits in this repo, and how to introduce it with minimal disruption.

## When to use
- The user asks whether qlib is useful in this repo.
- The user wants to compare qlib with the current TS or Bun pipeline.
- The user wants to add qlib datasets, handlers, workflows, or backtests for this codebase.
- The user wants to benchmark custom signals or alpha outputs against qlib baselines.

## Current repo touchpoints
- The primary market and macro ingestion path is TS-side in `ts-agent/src/providers/unified_market_data_gateway.ts`. Keep it as the source of truth for J-Quants, EDINET, and e-Stat access.
- The factor expression layer is a lightweight AST evaluator in `ts-agent/src/pipeline/factor_mining/factor_compute_engine.ts`. Treat it as a custom research surface, not something qlib should replace directly.
- The current backtest and signal evaluation flow is repo-specific and intentionally simple. Do not replace it wholesale just because qlib has a richer stack.
- The EDINET and knowledgebase flow is differentiated project logic. Treat EDINET-derived features as custom inputs to qlib, not as something to force into stock examples.

## Recommended use of qlib
- Use qlib as Python-side research infrastructure.
- Build a custom DataHandler or dataset around repo-owned daily features.
- Use qlib workflows to benchmark ML-based alphas against current heuristic or LLM-generated signals.
- Use rolling or walk-forward evaluation as a secondary validation layer.
- Keep qlib optional until it beats the current path on evidence.

## Do not use qlib for
- Replacing J-Quants, EDINET, or e-Stat ingestion.
- Replacing the TS orchestration and knowledgebase pipeline end-to-end.
- Copying China-market assumptions or stock example configs without adapting them.
- Starting with RL, portfolio optimization, or execution-heavy subsystems before the dataset and benchmark path works.

## Minimum integration path
1. Expose repo-owned daily features in a Python-readable dataset.
2. Define a custom qlib handler using market, macro, and EDINET-derived columns already produced by this repo.
3. Run one benchmark model or workflow.
4. Compare the result against the existing `kb-backtest` or pipeline benchmark path.
5. Keep qlib as a secondary research harness unless it clearly wins on repeatable metrics.

## Decision rules
- Prefer qlib when the task is dataset standardization, model benchmarking, or rolling evaluation.
- Prefer existing TS code when the task is ingestion, orchestration, knowledgebase construction, or production-facing audit flow.
- Compare before replacing.
- Make minimal changes and avoid wholesale migration.
- When proposing execution steps, prefer Taskfile-based entrypoints over ad hoc commands.

## How to answer with this skill
- Start by classifying the request as one of: fit assessment, benchmark design, minimal integration, or migration risk.
- State whether qlib should be used, partially used, or avoided for the specific task.
- Anchor recommendations to the repo touchpoints above.
- If proposing integration, default to a secondary Python benchmark path rather than replacing the current TS pipeline.

