# Investor Project Overview

## Purpose
A Bun + TypeScript autonomous quantitative trading/research system. It ingests market and financial data, runs agent/pipeline logic (LES and related experiments), evaluates outputs, and publishes artifacts/logs for dashboard visualization.

## Tech Stack
- Runtime: Bun
- Language: TypeScript (ESM)
- Type safety: `@tsconfig/strictest` + `strict: true`
- Validation: Zod
- Lint/format: Biome
- Dashboard: Vite app under `ts-agent/src/tools/dashboard`
- Supplemental Python workflows: `uv` in `ts-agent/src/experiments/foundation_models`

## High-Level Structure
- `ts-agent/`: main codebase
- `ts-agent/src/agents`: strategy/agent logic
- `ts-agent/src/core`: orchestration primitives
- `ts-agent/src/gateways`: data/provider gateway integrations
- `ts-agent/src/schemas`: Zod schemas/contracts
- `ts-agent/src/pipeline`: evaluation/mining/validation pipelines
- `ts-agent/src/experiments`: runnable experiment entrypoints
- `ts-agent/src/tools/dashboard`: dashboard app + log manifest tooling
- `logs/`: generated artifacts (`daily`, `unified`, `benchmarks`, `readiness`)
- `docs/`: architecture/reports

## Notes
- Treat `logs/` as generated artifacts.
- API keys and secrets stay in local env files; never commit credentials.