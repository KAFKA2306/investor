# Agentic Context Engineering (ACE)

## Overview
ACE (Agentic Context Engineering) is a framework presented in ArXiv 2510.04618 that treats LLM contexts as dynamic "playbooks". It replaces static prompting with an evolving collection of strategies, rules, and insights that improve through experience.

## Key Concepts
- **Context Playbook**: A structured collection of "bullets" (strategies, hard rules, insights) organized into sections.
- **Specialized Agents**:
  - **Generator**: Executes tasks using the current playbook.
  - **Reflector**: Analyzes performance (successes/failures) and extracts insights.
  - **Curator**: Manages the playbook by adding, updating, or removing bullets based on Reflector insights.
- **Adaptive Adaptation**:
  - **Offline**: Learning from batch training data.
  - **Online**: Real-time context updates during inference.
- **Semantic Deduplication**: Uses embeddings to prevent redundant information from bloating the context.

## Performance Benefits
- **+10.6%** on generic agent tasks.
- **+8.6%** on finance benchmarks.
- **Significant efficiency**: -86.9% adaptation latency, -83.6% token costs.

## Relevance to Investor Agent
Our current architecture (Media/Research/Trade agents) can be enhanced by:
1. Implementing a persistent Playbook in `ts-agent/src/core/playbook.ts`.
2. Adding a Reflector agent to analyze daily alpha performance and market research accuracy.
3. Using a Curator to refine the strategies used by the Research and Trade agents.

## Implementation Details (GitHub)
- Repository: [JRay-Lin/ace-agents](https://github.com/JRay-Lin/ace-agents)
- Core components: `Generator`, `Reflector`, `Curator`.
- Integration: Can be implemented via direct HTTP requests and local JSON storage for playbooks.

---
*Created: 2026-02-24*
*Source: [ArXiv 2510.04618](https://arxiv.org/abs/2510.04618)*
