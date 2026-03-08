# Alpha Search Workflow Memory (MEMORY.md)

This document records institutional knowledge and patterns discovered during the development of the alpha search pipeline.

## 🌟 Key Learnings

1. Audit System Maturity: Consolidating rejection reasons into the 8-point system has improved consistency because agents now have a shared language for failure.
2. Strict Validation Protocols: Adherence to the 3-phase validation ensures signal soundness because it filters out logical and statistical artifacts.
3. Autonomous Scope: Establishing clear boundaries minimizes risk because it clarifies the delegation of tasks to specialized agents.
4. Process Transparency: The execution steps serve as the authoritative reference because they ensure the search loop is reproducible.

## Structural Patterns
Discovery Optimization: Rotating through different personas creates higher diversity because it prevents the model from settling into a local optimum.
Data Integrity: Explicit NaN propagation is mandatory because it prevents false-positive performance gains from bad macro indicators.
