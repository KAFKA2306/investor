# Repository Guidelines

## Project Structure & Module Organization
- `ts-agent/` is the core TypeScript/Bun codebase.
- `ts-agent/src/agents/`, `core/`, `gateways/`, and `schemas/` contain strategy logic, orchestration, provider interfaces, and Zod contracts.
- `ts-agent/src/experiments/` contains runnable research and pipeline entrypoints (for example `01_vegetable.ts`, `les_reproduction.ts`).
- `ts-agent/src/tools/dashboard/` is a Vite dashboard for local and Pages deployment.
- `logs/` stores generated run artifacts (`daily/`, `unified/`, `benchmarks/`, `readiness/`).
- `docs/` contains architecture diagrams and reports.

## Build, Test, and Development Commands
- `task check`: format, lint, and typecheck the TypeScript code.
- `task run`: run reproduction + benchmark pipeline and regenerate dashboard manifests.
- `task view`: start the dashboard dev server.
- `cd ts-agent && bun run <script>`: run package scripts directly (example: `bun run pipeline:llm-readiness`).

## Coding Style & Naming Conventions
- Language/runtime: TypeScript on Bun, ESM modules.
- Formatting/linting: Biome (`indentWidth: 2`, spaces, organized imports). Run `task check` before committing.
- Typing: strict TypeScript (`@tsconfig/strictest`); avoid `any` (`noExplicitAny` is error).
- Naming: use descriptive file names aligned to existing patterns (`snake_case` for experiment scripts, domain-oriented module names elsewhere).

## Testing Guidelines
- Preferred test runner is Bun (`bun test`) when adding automated tests.
- Existing verification scripts are in `ts-agent/src/tests/` and `ts-agent/src/experiments/*test*.ts`; keep new checks deterministic and data-light.
- Validate behavior changes with:
  - `task check`
  - targeted script run (example: `cd ts-agent && bun src/experiments/test_audit_loop.ts`)

## Commit & Pull Request Guidelines
- Follow Conventional Commit style used in history: `feat: ...`, `fix: ...`, `docs: ...`, `refactor(scope): ...`, `chore: ...`.
- Keep commits focused; separate refactors from behavior changes.
- PRs should include:
  - concise problem/solution summary
  - affected paths (example: `ts-agent/src/gateways/...`)
  - verification evidence (commands run + key output)
  - dashboard/report screenshot when UI or published docs are changed.

## Security & Configuration Tips
- Never commit secrets. Keep API keys in local env files (Bun auto-loads `.env`).
- Treat `logs/` outputs as generated artifacts; review before publishing if they may include sensitive data.
