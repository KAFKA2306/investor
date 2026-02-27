# GEMINI.md

## Project Overview
This is an **Autonomous Quantitative Investment System** that leverages Gemini 3.0 Pro and strict TypeScript to automate market data analysis, alpha generation, and investment decision-making.

### Main Technologies
- **Runtime**: [Bun](https://bun.sh/) (Primary JavaScript/TypeScript runtime)
- **Language**: TypeScript (Strict mode enabled via `@tsconfig/strictest`)
- **AI**: Gemini 3.0 Pro (used for reasoning, sentiment analysis, and factor generation)
- **Data Gateways**: J-Quants (Earnings/Statements), Yahoo Finance, E-Stat (Economic data)
- **Foundation Models**: Integration with Chronos (Amazon), TimesFM (Google), and others via a Python sub-environment
- **Frontend**: Vite & Vanilla CSS for the analysis dashboard
- **Tooling**: Biome (Linting/Formatting), `uv` (Python package management), Taskfile (Command orchestration)

### Architecture
The system follows an agent-based architecture:
- **Agents (`ts-agent/src/agents/`)**: Specialized "intelligence" units like `LesAgent` (Factor mining), `PeadAgent` (Post-Earnings Announcement Drift), and `XIntelligenceAgent` (Social sentiment).
- **Core (`ts-agent/src/core/`)**: Orchestration logic and base agent classes.
- **Gateways (`ts-agent/src/gateways/`)**: Standardized interfaces for external data providers.
- **Schemas (`ts-agent/src/schemas/`)**: Strict Zod-based validation for all data structures (Market, Outcome, Log).
- **Experiments (`ts-agent/src/experiments/`)**: Research scripts and primary execution entry points.

---

## Building and Running

### Setup
Ensure you have `bun` and `uv` installed.
```bash
task setup
```

### Development Cycle
| Command | Description |
| :--- | :--- |
| `task check` | Run Biome lint/format and TypeScript typecheck. |
| `task run` | Execute the full LES reproduction and benchmark pipeline. |
| `task view` | Launch the Vite-based dashboard to view results. |

### Direct Execution
Individual experiments can be run directly using Bun:
```bash
cd ts-agent
bun src/experiments/les_reproduction.ts
```

---

## Development Conventions

### Coding Standards
- **Strict Typing**: All new code must adhere to strict TypeScript rules. Avoid `any`.
- **Formatting**: Use `task check` to ensure code matches the Biome configuration.
- **Agent Pattern**: New strategies should extend `BaseAgent` and implement a `run()` method.
- **Data Safety**: Use schemas in `ts-agent/src/schemas/` to validate any incoming data from gateways.

### Testing & Validation
- **Reproduction**: Before applying fixes, use scripts in `ts-agent/src/experiments/` to reproduce issues.
- **Backtesting**: Use `ts-agent/src/backtest/simulator.ts` to verify strategy performance before integration.
- **Logs**: Execution results are stored in `logs/unified/` and `logs/daily/`. Always check these after a run.

### Documentation
- **ArXiv Reports**: The system automatically generates verification reports in `docs/arxiv/` (Markdown format).
- **Diagrams**: Mermaid diagrams in `docs/diagrams/` describe the system flow.
