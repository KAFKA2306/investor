# Persistent Agent Memory: AAARTS Alpha Search Workflow

## Project Identity
- Autonomous quant system for Japanese equities (J-Quants data)
- Runtime: Bun + TypeScript strict, Biome linter, Zod schemas
- All commands via `task` (Taskfile.yml) from repo root `/home/kafka/finance/investor`

## AAARTS Implementation Status (verified 2026-03-03)

### Implemented and Confirmed
- 4-layer loop: Meta (ACE) -> Data -> Research -> Execution Audit -> Feedback
  - `pipeline_orchestrator.ts`: `PipelineOrchestrator.run()` drives the loop
  - `ElderBridge` handles ACE memory/feedback
- 8-point Audit: fully implemented in `CqoAgent.auditStrategy()`
  - Outputs `EvaluationViewpoint` struct with all 8 fields
  - GO/HOLD/PIVOT verdict with Sharpe-weighted vote
- Ralph Loop: implemented in `PipelineOrchestrator.run()` at `consecutiveFailures >= 2`
  - Calls `MissionAgent.pivotDomain()` on trigger
- Loop controls via env vars: ALPHA_LOOP_MAX_CYCLES, ALPHA_LOOP_SLEEP_SEC, ALPHA_LOOP_MAX_FAILURES
  - Implemented in `Taskfile.yml` `run:newalphasearch:loop` task
- Required outputs: all three types confirmed present
  - `logs/unified/log_*.json` (not `alpha_discovery_*.json` naming - loop script checks `log_*.json`)
  - `ts-agent/data/VERIF_*.png` (confirmed active)
  - `ts-agent/data/playbook.yaml` (note: file is .yaml not .json)

### Key Implementation Gaps
1. `docs/specs/automonous.md` does NOT EXIST - referenced in sequence.md but missing
2. `alphaLoop.maxCycles` in `config/default.yaml` is set to 1, but workflow spec says 3
   - Env var `ALPHA_LOOP_MAX_CYCLES=3` overrides at runtime (Taskfile default)
3. Unified log naming: loop script checks `logs/unified/log_*.json`
   - `alpha_discovery_*.json` files are in `logs/unified/` (different naming format)
   - Both formats exist; loop checks `log_*.json` count for success detection
4. `playbook.json` spec says `.json` but actual file is `playbook.yaml`
5. Ralph Loop trigger is at consecutiveFailures >= 2 inside PipelineOrchestrator.run()
   - This is INNER loop (per discovery attempt), separate from OUTER Taskfile loop

### Cycle Execution Order (run:newalphasearch:cycle)
1. pipeline:proof-layers (universe + manifest validation)
2. pipeline:verify (API verification)
3. pipeline:orchestrate (main pipeline: verification-json + start)
4. pipeline:discover (alpha-discovery experiment)
5. pipeline:analyze (model A/B analysis)
6. pipeline:verification-plot (Python backtest visualization)
7. pipeline:mine (factor mining)

## Key Paths
- Main orchestrator: `ts-agent/src/system/pipeline_orchestrator.ts`
- 8-point auditor: `ts-agent/src/agents/chief_quant_officer_agent.ts`
- Ralph Loop pivot: `ts-agent/src/agents/mission_agent.ts` `pivotDomain()`
- Loop controls config: `ts-agent/src/config/default.yaml` under `pipelineBlueprint.alphaLoop`
- Taskfile loop runner: `Taskfile.yml` task `run:newalphasearch:loop`
- Verification plots: `ts-agent/data/VERIF_*.png`
- Unified logs: `logs/unified/log_*.json`

## Quality Gates (from config/default.yaml)
- Data: minQualityScore=0.82, minCoverageRate=0.8, maxMissingRate=0.08
- Verification: minSharpe=1.8, minIC=0.04, maxDrawdown=0.1
- Execution: minFillRate=0.95, maxSlippageBps=2.0

## Known Issues / Watch Points
- `automonous.md` spec file missing - cannot verify autonomous operation boundaries
- Config `alphaLoop.maxCycles=1` diverges from workflow spec default of 3
- Inner Ralph Loop (consecutiveFailures threshold=2) is hardcoded, not configurable
- `TODO(human)` comment in pipeline_orchestrator.ts line ~905 indicates Ralph Loop
  threshold and domain selection policy are explicitly left to human decision

## Confirmed Bugs Fixed (2026-03-03)
- **Taskfile.yml `find` symlink bug**: `find logs/unified` used `-type f` without `-L` flag.
  `logs/unified` is a symlink to `/mnt/d/investor_all_cached_data/logs/unified/`.
  Without `-L`, `find -type f` returns 0 results through a symlink directory.
  Fix: changed to `find -L logs/unified` in both before_count and after_count lines.
- **Python env missing**: `pandas` not installed. Fix: `task python:uv:sync` before loop.
  Always run `task python:uv:sync` before first loop execution in a new environment.

## Alpha Selection Pattern (confirmed 2026-03-03)
- Candidates SELECTED when fitness >= ~0.5 (plausibility + riskAdjusted contribute)
- Candidates REJECTED when fitness ~= 0.181 (LLM generates low-quality DSL)
- Fitness is LLM-driven via Qwen/local model reasoning quality
- No_selected_alpha failure = LLM not generating viable alpha DSL, not infrastructure issue
- Historical successful runs (2026-03-01 15:46) had fitness=0.525 for selected alphas
