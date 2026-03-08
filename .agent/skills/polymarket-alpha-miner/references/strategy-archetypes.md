# Polymarket Alpha Strategy Archetypes

This document defines the core patterns observed among top-tier Polymarket traders as of 2026.

## 1. Information Arbitrage (News-Driven)
- **Signal**: Breaking news or real-time event updates (e.g., goals, political announcements).
- **Edge**: Executing before the market reflects the new probability.
- **Trader Example**: `majorexploiter`, `HorizonSplendidView`.
- **Requirements**: High-speed news feeds, low-latency API execution.

## 2. Jim Simons Style (Diversified Edge)
- **Signal**: Small statistical advantages across hundreds of markets.
- **Edge**: High diversification and law of large numbers.
- **Trader Example**: `0x2a2C...`, `4326...`.
- **Requirements**: Automated portfolio management, precise risk scaling, high Sharpe Ratio focus.

## 3. Whale Tracking (Signal Extraction)
- **Signal**: Large-volume trades from known high-performance wallets.
- **Edge**: Leveraging the research and "intent" of market leaders.
- **Trader Example**: `beachboy4` (partially).
- **Requirements**: On-chain monitoring (PolygonScan), real-time alerts on specific wallet movements.

## 4. Carry Trade (Probability Grinding)
- **Signal**: Overpriced "Black Swan" events or underpriced "Nothing Happens" outcomes.
- **Edge**: Time-decay and the statistical rarity of extremes.
- **Trader Example**: `WoofMaster`.
- **Requirements**: Deep understanding of base-rate probabilities, patience, high win rate (95%+).

## 5. AI Automation (Systematic Market Making)
- **Signal**: Price discrepancies between related markets or order-book imbalances.
- **Edge**: Providing liquidity and capturing the bid-ask spread or cross-market correlation.
- **Trader Example**: `bcda`, `MinorKey4`, `gmanas`.
- **Requirements**: Predictive AI models, automated market-making algorithms, high-frequency execution.

---

### 🚀 Implementation Guide for majorexploiter (Type 1)
- **Core Loop**: `Watch Live Event Feed` -> `Calculate Implied Odds` -> `Compare with Polymarket Price` -> `Execute if Difference > Threshold`.
- **Risk**: Concentrated exposure. Requires strict stop-losses or hedging.
