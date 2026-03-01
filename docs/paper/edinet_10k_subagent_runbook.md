# EDINET 10-K Subagent Runbook (Coverage First, Quality Second)

## Goal
Increase `signals/day` for the EDINET Risk-Delta x PEAD hybrid by:
1. expanding event coverage fast (`metadata-only`)
2. upgrading data quality on major symbols (prefer indexed/XBRL text)

## Scope
- Target map: `ts-agent/data/edinet_10k_intelligence_map.json`
- Feature generator: `ts-agent/src/experiments/generate_10k_features.ts`
- Knowledgebase build: `ts-agent/src/experiments/build_alpha_knowledgebase.ts`
- Backtest: `ts-agent/src/experiments/run_kb_signal_backtest.ts`
- Plot: `ts-agent/src/experiments/plot_kb_signal_backtest.py`

## Current Baseline (2026-03-01)
- symbols: `646`
- events: `2440`
- date range: `2021-05-20` to `2025-12-24`
- by year:
  - 2021: 247
  - 2022: 622
  - 2023: 179
  - 2024: 707
  - 2025: 685

## Step 1: Fast Coverage Expansion
Run metadata-only first (all symbols, wide period):

```bash
cd ts-agent
bun run experiments:10k-features -- \
  --from=2023-01-01 \
  --to=2025-12-31 \
  --all-symbols \
  --metadata-only \
  --sleep-ms=0 \
  --flush-every=300
```

Notes:
- This maximizes event count quickly.
- It is robust when XBRL download is unstable.

## Step 2: Major Symbol Quality Upgrade
Run non-metadata extraction on major symbols with overwrite.
Use `--indexed-only` to avoid wasting time on unavailable downloads and prefer already indexed section text.

```bash
cd ts-agent
bun run experiments:10k-features -- \
  --from=2023-01-01 \
  --to=2025-12-31 \
  --symbols=6723,3656,6762,6857,3774,4056,4478,4765,6232,6282,6619,7733,7988,8002,9416,9434,1860,2767,2914,3036,3156,3686,3697,3903,3964,4401,4425,4461,4579,4582,4592,4599,4901,4912,5741,5902,5949,6136,6238,6381,6455,6460,6471,6521,6523,6588,6632,6702,6845,6988,7038,7270,7480,8008,8056,8601,8609,9268,9468,9755 \
  --overwrite-existing \
  --indexed-only \
  --sleep-ms=0 \
  --flush-every=100
```

Interpretation:
- `insertedFromIndexed` > 0 means quality upgrade from section-level text happened.
- `insertedFromMetadata` should be minimized in this step.

## Rebuild and Validate

```bash
cd ts-agent
bun run experiments:kb-build -- --limit=3000
bun run experiments:kb-backtest -- --top-k=5 --min-signals-per-day=4
python3 src/experiments/plot_kb_signal_backtest.py --top-k=5 --min-signals-per-day=4
```

## Acceptance Criteria
- Coverage:
  - `events` strictly increases after Step 1
  - date `max` reaches target period
- Quality:
  - Step 2 reports non-zero `insertedFromIndexed` or successful non-metadata inserts
- Backtest:
  - `tradableDays` and `totalSignalEvents` increase vs previous checkpoint
  - risk metrics remain within deployment guardrails

## Operational Guardrails
- Do not overwrite unrelated workspace changes.
- If EDINET network is unstable:
  - keep Step 1 metadata-only
  - keep Step 2 indexed-only first, then retry full download during stable window
- Persist outputs after each run:
  - `edinet_10k_intelligence_map.json`
  - KB backtest metrics JSON
  - plot PNG
