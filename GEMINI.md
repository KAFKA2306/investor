# Strategic Mandate: Autonomous Alpha Generation

This document defines the operational mandate for the **Autonomous Quantitative Investment System**. The system leverages **Gemini 3.0 Pro** for high-reasoning factor discovery and **Strict TypeScript** for high-integrity execution, creating a self-evolving alpha generation pipeline.

## Strategic Objectives
1. **Alpha Extraction**: Autonomous discovery of non-obvious, orthogonal market signals.
2. **Risk Mitigation**: Continuous auditing of strategies to ensure statistical significance and regime robustness.
3. **Execution Reliability**: Zero-fat infrastructure designed for high-fidelity backtesting and live monitoring.

## Core Technology Stack (Infrastructure for Alpha)
- **Runtime**: [Bun](https://bun.sh/) - High-performance engine for data-intensive quantitative workflows.
- **Intelligence**: Gemini 3.0 Pro - Specialized for sentiment synthesis, factor hypothesis, and cross-asset reasoning.
- **Validation**: Strict TypeScript + Zod - Ensures "Immutable Evidence" and prevents "Dirty Data" from contaminating the Alpha Factory.
- **Gateways**: Standardized access to J-Quants (Institutional Disclosure), Yahoo Finance, and e-Stat (Economic Fundamentals).
- **Forecasting**: Integration with state-of-the-art time-series foundation models (Chronos, TimesFM).

## Operational Architecture
The system operates as a network of specialized **Autonomous Analysts**:
- **Alpha Factory (`ts-agent/src/agents/`)**: Specialized units like `LesAgent` (Factor mining), `PeadAgent` (Event-driven drift), and `XIntelligenceAgent` (Sentiment extraction).
- **Audit Engine (`ts-agent/src/core/`)**: Continuous validation and UQTL maintenance.
- **Data Fabric (`ts-agent/src/gateways/`)**: High-fidelity, PIT (Point-in-Time) data ingestion.
- **Experimental Sandbox (`ts-agent/src/experiments/`)**: Rapid prototyping and reproduction of quantitative breakthroughs.


---

## Building and Running

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


### Documentation
- **Diagrams**: Mermaid diagrams in `docs/diagrams/` describe the system flow.
