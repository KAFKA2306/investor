# Project Memory: investor

## 🏛️ Current Session Summary (2026-03-05)

### Ralph Loop Iteration 1: newalphasearch
- ✅ Pipeline executed: 3 cycles completed
- ✅ AARTS domain pivot triggered after 2 consecutive failures
- ❌ All alphas rejected (IC < 0.04, Sharpe < 0.3 thresholds)
- **Root Issue**: LES agent generating low-quality factors (e.g., macro_iip - macro_iip = 0)

### EDINET Investigation & Fixes
**Bugs Fixed**:
- ✅ verify_edinet_io_contract.ts: Added missing dateUtils import
- ✅ repair_edinet_event_features.ts: Added missing dateUtils import

**Blockers Identified**:
- ❌ Intelligence map missing: `/mnt/d/.../edinet_10k_intelligence_map.json` (external data)
- ❌ I/O verification requires intelligence map to proceed
- ✅ EDINET provider implementation: solid (schema validation, caching, document downloads)

### EDINET Text Model Status
- Text extraction utility available but **not integrated** into alpha generation
- Features: company overview, financial metrics, products, risks
- Opportunity: Use sentiment/risk signals to improve alpha generation

---

## Key Facts
- Autonomous quant investment system (Japanese equities, J-Quants data)
- Runtime: Bun + TypeScript (strict), Biome linter, Zod schemas
- All commands via `task` (Taskfile.yml) from repo root
- `task check` = format + lint + typecheck
- `task run:newalphasearch` = autonomous alpha discovery loop (default 3 cycles)
- `task view` = API server :8787 + Vite dashboard :5173

## Architecture
- Main code: `ts-agent/src/`
- Agents: `src/agents/` (LesAgent, CqoAgent, MissionAgent, StrategicReasonerAgent)
- Pipeline: `src/pipeline/evaluate/` + `src/pipeline/factor_mining/`
- Providers: `src/providers/` (EDINET, J-Quants, Yahoo, e-Stat)
- System core: `src/system/` (pipeline_orchestrator, app_runtime_core, data_pipeline_runtime)
- Config: `src/config/default.yaml` + `ts-agent/.env`
- Canonical diagrams: `docs/diagrams/sequence.md`, `docs/diagrams/simpleflowchart.md`

## Coding Conventions
- Files: snake_case.ts, Classes: PascalCase, vars: camelCase
- No `any` (enforced as Biome error)
- Agents extend BaseAgent from `src/system/app_runtime_core.ts`
- External data must go through Zod schemas in `src/schemas/`
- Conventional Commits: feat/fix/docs/refactor/chore with optional scope

## Key Paths
- Market data: `/mnt/d/marketdata/` (J-Quants CSV dumps)
- Audit logs: `logs/unified/alpha_discovery_*.json`
- Verification artifacts: `ts-agent/data/standard_verification_data.json`, `ts-agent/data/VERIF_*.png`
- Playbook: `ts-agent/data/playbook.json`
- SQLite caches: `logs/cache/`
- EDINET intelligence map: `/mnt/d/.../edinet_10k_intelligence_map.json` (BLOCKER: missing)

## Quality Gates (config/default.yaml)
- Data: quality_score > 0.82, coverage > 0.80, missing < 0.08
- Verification: Sharpe > 1.8, IC > 0.04, MaxDrawdown < 0.10
- Alpha selection: Sharpe >= 0.3, IC >= 0.04, MaxDD < 0.1

## Environment
- .env created with OPENAI_API_KEY (copied to ts-agent/.env for bun access)
- EDINET_API_KEY configured
- J-Quants API key configured
