# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Architecture

This is an autonomous quant investment system that runs a full pipeline from alpha discovery through execution and audit. The canonical process is defined in `docs/diagrams/sequence.md` and `docs/diagrams/simpleflowchart.md` — **these diagrams take precedence over all other documentation** when there is a conflict.

The system is built as a multi-agent pipeline with these roles:

| Role | Implementation | Responsibility |
|---|---|---|
| Orchestrator | `src/system/pipeline_orchestrator.ts` | Full pipeline control, gate decisions |
| Elder (Memory) | `src/context/unified_context_services.ts` | Persist/retrieve seeds, verdicts, history |
| Data Engineer | `src/providers/unified_market_data_gateway.ts` + providers | PIT-clean data delivery |
| Quant Researcher | `src/agents/latent_economic_signal_agent.ts`, `chief_quant_officer_agent.ts` | Factor search, backtest, model selection |
| Strategic Reasoner | `src/agents/alpha_r1_reasoner_agent.ts` | LLM-based alpha screening (context-aware ON/OFF) |
| Execution Agent | bridge in `pipeline_orchestrator.ts` | Order generation and fill retrieval |

**Entry point**: `ts-agent/src/index.ts` → `PipelineOrchestrator.run()`

### Key directories under `ts-agent/src/`

- `agents/` — Research and decision agents (`LesAgent`, `CqoAgent`, `MissionAgent`, `StrategicReasonerAgent`)
- `pipeline/evaluate/` — Backtest core and evaluation metrics
- `pipeline/factor_mining/` — Factor evolution and mining core
- `providers/` — Data gateways: EDINET, J-Quants, Yahoo Finance, e-Stat, plus SQLite cache layers
- `experiments/` — Runnable research scenarios (alpha discovery, KB build/backtest, 10K features, verification proofs)
- `dashboard/` — Vite-based monitoring UI (separate `npm` workspace)
- `system/` — Runtime core (`app_runtime_core.ts`), data pipeline runtime, path registry, telemetry logger
- `context/` — Memory center, event store, context playbook
- `schemas/` — Zod schemas: `financial_domain_schemas.ts`, `system_event_schemas.ts`, `alpha_knowledgebase.ts`
- `config/default.yaml` — All pipeline thresholds, provider settings, and data paths

### Data flow

Market data (J-Quants CSV dumps) lives at `/mnt/d/marketdata/`. SQLite caches are under `logs/cache/`. Audit logs write to `logs/unified/alpha_discovery_*.json`. Verification artifacts (JSON + 4-panel PNGs) write to `ts-agent/data/`.

### Acceptance thresholds (from `config/default.yaml`)

- Data gate: quality_score > 0.82, coverage > 0.80, missing < 0.08
- Verification gate: Sharpe > 1.8, IC > 0.04, MaxDrawdown < 0.10

## Commands

All commands run from the repo root via [Task](https://taskfile.dev/).

```bash
task deps                    # Install bun + dashboard dependencies
task check                   # format + lint + typecheck (alias: task qa)
task qa:fast                 # lint + typecheck only
task run                     # Full run: newalphasearch + orchestrate + benchmark
task run:newalphasearch       # Autonomous alpha search loop (default 3 cycles)
task run:quick               # typecheck + proof-layers + verify + discover + benchmark + verification-plot
task view                    # Start API server (:8787) + dashboard (:5173)
```

**Alpha search loop controls** (env vars):
```bash
ALPHA_LOOP_MAX_CYCLES=5 task run:newalphasearch       # run N cycles
ALPHA_LOOP_SLEEP_SEC=10 task run:newalphasearch:loop  # sleep between cycles
UQTL_NL_INPUT="..." task run:newalphasearch:nl        # natural language input
```

**Individual pipeline stages** (from repo root):
```bash
task pipeline:orchestrate    # Full orchestrated pipeline (bun run start)
task pipeline:verify         # API/data provider verification
task pipeline:discover       # Factor discovery (alpha mining experiments)
task pipeline:benchmark      # Backtest core
task pipeline:mine           # Mining core
task pipeline:verification-plot  # Generate verification JSON + 4-panel PNG
task pipeline:edinet-daily   # EDINET daily flow (features → macro → KB → gated backtest)
```

**Direct scripts** (from `ts-agent/` directory):
```bash
bun run format               # Biome format
bun run lint                 # Biome lint
bun run typecheck            # tsc --noEmit
bun run start:api            # API server only
bun run experiments:alpha-discovery
bun run experiments:kb-build
bun run experiments:kb-backtest
bun run pipeline:backtest
bun run pipeline:mine
```

**J-Quants cache warming** (long-running background job):
```bash
task jquants:warm-all:start  # Start background cache warm job
task jquants:warm-all:status
task jquants:warm-all:log
task jquants:warm-all:stop
```

## Coding conventions

- **TypeScript**: Strict mode, `noExplicitAny` is an error. No `any` allowed.
- **Formatter/Linter**: Biome (`ts-agent/biome.json`) — 2-space indent, organize imports on save.
- **Naming**: `snake_case.ts` for files, `PascalCase` for classes/types, `camelCase` for variables/functions.
- **Agents**: Extend `BaseAgent` (from `src/system/app_runtime_core.ts`) and implement `run()`.
- **Data validation**: All external/gateway data must be validated with Zod schemas in `src/schemas/`.
- **Side effects**: Keep pipeline logic deterministic; make all side effects explicit.

## Configuration

- `/.env` — API keys: `JQUANTS_API_KEY`, `ESTAT_APP_ID`, `VERIFY_TARGETS` (single source of truth)
- `ts-agent/src/config/default.yaml` — All runtime configuration; `runtime.envFile` defines `.env` loading path and provider entries keep only env var names (`apiKeyEnv` / `appIdEnv`)

## Commit conventions

Follow Conventional Commits as seen in repo history: `feat:`, `fix:`, `docs:`, `refactor:`, `chore:` with optional scope, e.g. `docs(diagrams): ...`, `refactor(ts-agent): ...`. Keep commits small and single-purpose. When process flow changes, update the diagram docs and related README sections in the same commit/PR.

## Verification evidence

A successful `run:newalphasearch` cycle must produce:
1. A new `logs/unified/alpha_discovery_*.json` with at least one `selected` alpha
2. An updated `ts-agent/data/standard_verification_data.json`
3. A new `ts-agent/data/VERIF_*.png` (4-panel verification plot)

The loop monitors these artifacts to detect cycle success/failure before proceeding to the next cycle.
