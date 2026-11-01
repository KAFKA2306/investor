# Repository Guidelines (Slim Mode ✨)

## 📍 Key Locations

- **Logic**: `ts-agent/src/domain/` (Business rules)
- **I/O**: `ts-agent/src/io/` (API, File, DB)
- **ADRs**: `docs/adr/` (Architectural decisions)

## ⚙️ Core Operational Commands

- `task setup`: Install all dependencies
- `task check`: Reliability gate (lint + test + type check)
- `task run:newalphasearch`: Alpha discovery pipeline
- `task view`: Start API (:8787) and Dashboard (:5173)

## 🛡️ Governance (CRITICAL)

- **CDD (Crash-Driven Development)**: NO `try-catch`, NO defensive code. Let it crash, fix the root cause.
- **Deterministic Quality**: Biome (TS) and Ruff (Py). Automated via Hooks.
- **Schema-First**: Always use Zod (TS) or Pydantic (Py) at boundaries.
- **Minimal Changes**: Avoid over-engineering. Speed of iteration > Speculation.

## 🎯 Skill Management

- Sync via `agr sync`.
- Canonical source: `.agent/skills/`.
- Edit **only** in `.agent/skills/`.

---

*Refer to `CLAUDE.md` for specific agent instructions.*

## Outcome-first task interpretation (Altitude / Depth / Range / Speed)

- **Altitude:** Interpret a task as a verifiable user outcome, not only the named intermediate step. Infer the smallest justified acceptance criteria from the request and current repository state; do not silently expand scope or override explicit instructions.
- **Depth:** Use primary/current evidence and real domain tools and methods. Verify the actual postcondition independently of agent self-report, preferably on the exact changed revision or target runtime.
- **Range:** Combine code, data, tests, runtime/UI, and domain expertise when that materially improves the outcome, while respecting canonical owners and avoiding duplicate systems.
- **Speed:** Complete authorized read-only and reversible work through implementation, focused checks, and read-back without unnecessary approval loops. Bound retries and stop at the proven outcome.
- These principles never bypass repository-specific security, privacy, permission, publication, spending, destructive-action, or release boundaries. State verified results and any remaining `UNVERIFIED` layers.
