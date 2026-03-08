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
- **Data Exporter**: `ts-agent/src/io/qlib_exporter.ts` handles the bridge from TS computes to Qlib-ready CSV/Parquet.
- **Custom Handler**: `ts-agent/src/research/qlib_handler.py` (`RepoDataHandler`) reads repo-specific exports into Qlib.
- **Benchmark Script**: `ts-agent/src/research/qlib_benchmark.py` serves as the primary entry point for Python-side ML experiments.
- **Model Registry**: `ts-agent/src/model_registry/models.json` registers `microsoft-qlib` as a recognized machine-learning-research platform.
- **Task Runner**: `Taskfile.yml` includes `research:qlib:benchmark` for standardized execution.

## Recommended use of qlib
- Use qlib as Python-side research infrastructure because it provides industry-standard ML models and time-series cross-validation that are complex to reinvent in TS.
- Build a custom DataHandler around repo-owned daily features because maintaining a single source of truth for market data prevents signal-vs-backtest discrepancies.
- Use qlib workflows to benchmark ML-based alphas because comparing new ideas against established baselines (e.g., LightGBM) is the only way to prove functional value.
- Use rolling or walk-forward evaluation as a secondary validation layer because fixed-window backtests are prone to overfitting and market-regime bias.
- Keep qlib as a secondary research harness because the primary "Alpha Factory" remains centered on the autonomous TS loop.

## Do not use qlib for
- Replacing J-Quants, EDINET, or e-Stat ingestion because the existing TS gateway is already optimized for Japanese regulatory APIs and rate limits.
- Replacing the TS orchestration end-to-end because the "Knowledgebase" logic is highly specialized for LLM-driven alpha mining.
- Copying stock example configs without adaptation because market assumptions (e.g., fee structures, tick sizes) vary significantly between China and Japan.

## Minimal integration path (Reference)
1. Expose repo-owned daily features via `qlib_exporter.ts`.
2. Configure `RepoDataHandler` in `qlib_handler.py` to map column names.
3. Define qlib task config (LightGBM/XGBoost) in `qlib_benchmark.py`.
4. Execute via `task research:qlib:benchmark`.
5. Audit results using Qlib's `R.save_objects` and persistence layer.

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
