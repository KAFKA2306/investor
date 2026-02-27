# Suggested Commands

## System/Utility (Linux)
- `ls`, `cd`, `pwd`
- `rg <pattern>` and `rg --files` for fast search
- `find <path> -name '<glob>'`
- `git status`, `git diff`, `git add -p`, `git commit`

## Project Root Task Runner
- `task setup`: install Bun deps + Python deps for foundation models
- `task check`: format + lint + typecheck
- `task verify`: verify APIs/models environment
- `task daily`: run practical daily workflow
- `task run`: main pipeline (reproduction + benchmark + dashboard manifest updates)
- `task view`: start dashboard dev server
- `task score`: run LLM readiness scoring

## Direct Bun Commands (inside `ts-agent/`)
- `bun run format`
- `bun run lint`
- `bun run typecheck`
- `bun run verify:api`
- `bun run pipeline:llm-readiness`
- `bun run pipeline:ab`
- `bun run pipeline:mine`
- `bun run pipeline:full-validation`
- `bun src/experiments/01_vegetable.ts`
- `bun src/experiments/les_reproduction.ts`
- `bun src/experiments/04_foundation_benchmark.ts`

## Testing
- Preferred test runner: `bun test`
- Targeted verification scripts exist under `ts-agent/src/tests/` and `ts-agent/src/experiments/*test*.ts`
- Example targeted run: `cd ts-agent && bun src/experiments/test_audit_loop.ts`