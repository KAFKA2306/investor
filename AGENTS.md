# Repository Guidelines

## Project Structure & Module Organization
- Core implementation lives in `ts-agent/src/`.
- Main domains:
  - `src/agents/`: research and decision agents
  - `src/pipeline/`: factor mining, evaluation, backtest flow
  - `src/providers/`: API/data gateway and execution-facing services
  - `src/experiments/`: runnable research scenarios
  - `src/dashboard/`: Vite-based UI for audit/monitoring
- Documentation:
  - `docs/diagrams/sequence.md` and `docs/diagrams/simpleflowchart.md` are canonical process diagrams.
  - `docs/paper/` stores paper notes and idea sources.
- Operational outputs are under `logs/` and `ts-agent/data/`.

## Build, Test, and Development Commands
Use `Taskfile.yml` from repo root:
- `task setup`: install Bun and dashboard dependencies.
- `task check`: run format + lint.
- `task run`: run full discovery/model-analysis/mining pipeline.
- `task run:newalphasearch`: run alpha discovery + mining workflow.
- `task view`: start API (`:8787`) and dashboard (`:5173`).

Direct scripts (inside `ts-agent/`):
- `bun run lint`, `bun run format`
- `bun run pipeline:backtest`, `bun run experiments:alpha-discovery`

## Coding Style & Naming Conventions
- Biome (`ts-agent/biome.json`): 2-space indentation, organize imports, recommended lint rules.
- Naming:
  - files/modules: `snake_case.ts`
  - classes/types: `PascalCase`
  - variables/functions: `camelCase`
- Keep pipeline logic deterministic and side effects explicit.


## Commit & Pull Request Guidelines
- Follow Conventional Commits seen in history: `feat:`, `fix:`, `docs:`, `refactor:`, `chore:` with optional scope (e.g., `docs(diagrams): ...`).
- Keep commits small and single-purpose.
- PRs should include:
  - summary of behavioral changes
  - affected paths (e.g., `src/pipeline/...`)
  - validation evidence (`task check` results, backtest/verification outputs)
  - screenshots when dashboard behavior changes
- If process flow changes, update both diagram docs and related README sections in the same PR.

## Security & Configuration Tips
- Store secrets in the repo-root `.env` (e.g., `JQUANTS_API_KEY`, `ESTAT_APP_ID`); never commit credentials.
- Treat API outputs and generated logs as audit artifacts; do not rewrite history in-place.
