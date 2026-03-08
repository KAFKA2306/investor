# Agent Teams for Alpha Discovery — Design

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:writing-plans to implement this plan task-by-task.

**Goal:** Enable Claude Code Agent Teams to make the newalphasearch pipeline trustworthy enough to eventually run in parallel, starting with a quality gate for alpha candidates.

**Architecture:** Team lead (existing session) + QualityGate teammate. Existing `alpha-search-workflow` agent gains skill injection. Agent Teams infrastructure enabled via settings.

**Tech Stack:** Claude Code Agent Teams (experimental), `.claude/agents/` YAML frontmatter, `.agent/skills/`, `settings.local.json`

---

## Context & Constraints

- Ultimate goal: run `task run:newalphasearch` as an Agent Team to generate profit
- Current blocker: system too complex/unvalidated to parallelize alpha discovery
- Immediate focus: establish quality gate so alpha candidates are statistically sound
- YAGNI: no parallelization yet, only quality gate infrastructure

## Quality Gate — 3 Evaluation Dimensions

Each alpha candidate evaluated immediately after generation:

| Dimension | Criterion |
|---|---|
| Statistical significance | IC t-statistic > 2.0, p-value < 0.05 |
| Novelty | Pearson correlation with existing playbook alphas < 0.3 |
| Economic interpretability | Formula has documented economic rationale (no look-ahead, no circular reference) |

Pass: all 3 dimensions met → candidate advances to backtest
Fail: Mailbox warning to lead → candidate rejected with reason

## What to Build

### 1. Enable Agent Teams
Add to `~/.claude/settings.json` (global, not project-level):
```json
{
  "env": {
    "CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS": "1"
  }
}
```

### 2. Update alpha-search-workflow agent
Add `skills:` to `.claude/agents/alpha-search-workflow.md` frontmatter:
```yaml
skills:
  - qlib-investor-integration
  - fail-fast-coding-rules
  - where-to-save
```

### 3. Create quality-gate agent
New file: `.claude/agents/quality-gate.md`
- Tools: Read, Grep, Glob, Bash (read playbook, compute stats)
- Model: sonnet
- Skills: qlib-investor-integration, fail-fast-coding-rules
- Responsibility: receive alpha candidate via prompt, evaluate 3 dimensions, return structured JSON verdict

## Data Flow

```
Lead (newalphasearch loop)
  → generate alpha candidate
  → spawn quality-gate teammate with candidate details
  → quality-gate evaluates: t-stat / novelty / interpretability
  → quality-gate returns verdict JSON via Mailbox
  → Lead: Pass → advance to backtest | Fail → log rejection + next cycle
```

## What NOT to Build

- Do not parallelize DataAgent/ResearchAgent/EvalAgent yet (Phase 2)
- Do not touch `pipeline_orchestrator.ts`
- Do not add hooks (SubagentStart hook is Phase 2)
- Do not add more than 3 quality dimensions
