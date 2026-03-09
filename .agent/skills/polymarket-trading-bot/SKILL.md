---
name: polymarket-trading-bot
description: |
  Autonomous prediction market trading bot using 6-agent swarm.
  Scans Polymarket, predicts outcomes with XGBoost+LLM, validates
  risk (Kelly/VaR), and generates backtest signals. Use when: running
  rolling 90-day backtests on 300+ markets with edge detection and
  learned failure patterns.
---

# Polymarket Trading Bot Skill

## Overview

[Full implementation details to be filled in after agent scaffold]

## Usage

```bash
task run:polymarket-backtest --window 90d --markets 300
```
