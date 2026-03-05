# CLAUDE.md (Slim Mode 🥗)

Project guidance for Claude Code. Operational details are in [OPERATIONS.md](file:///home/kafka/finance/investor/docs/OPERATIONS.md).

## 🏛️ Architecture SSOT

Refer to `docs/diagrams/` for precedence.
This is a multi-agent quant system: `src/system/pipeline_orchestrator.ts` is the entry point.

| Role | Responsibility |
|---|---|
| Orchestrator | Full pipeline control |
| Elder | Unified memory/persistence |
| Data | PIT-clean data delivery |
| Quant | Factor mining & backtest |

## 📍 Data Path Rules (CRITICAL)

**Unified Source of Truth**: `/mnt/d/investor_all_cached_data/`
**Rule**: NEVER hardcode filesystem paths. Use `PathRegistry` from `src/system/path_registry.ts`.
See `DATA_STRUCTURE.md` for the unified architecture mappings.

## 🛠️ Coding Conventions

- **Formatter/Linter**: Biome (`ts-agent/biome.json`)
- **Naming**: `snake_case.ts` (files), `PascalCase` (classes), `camelCase` (vars).
- **Agents**: Extend `BaseAgent` and implement `run()`.
- **Validation**: Use Zod schemas in `src/schemas/`.
- **CDD (Crash-Driven Development)**:
    - **No `try-catch`**: prohibited in business logic; let errors cascade.
    - **No Defensive Returns**: never return `null`/`false` to hide failures.
    - **Infrastructure Resilience**: retries/timeouts belong in `Makefile`/Docker/K8s only.
    - **Stack Traces**: treat as the inviolable ground truth; never suppress.
- **Commits**: Follow Conventional Commits (`feat:`, `fix:`, etc.).

---
*For task-specific commands and setup, see [OPERATIONS.md](file:///home/kafka/finance/investor/docs/OPERATIONS.md).*
