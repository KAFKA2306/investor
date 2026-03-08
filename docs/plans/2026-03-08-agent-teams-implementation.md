# Agent Teams Quality Gate Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Enable Claude Code Agent Teams and create a quality-gate agent that evaluates alpha candidates on 3 financial dimensions immediately after generation.

**Architecture:** 3 targeted changes to existing files + 1 new agent file. No code changes to TypeScript pipeline. Agent Teams infrastructure enabled globally, skill injection added to existing agent, quality-gate agent created from scratch.

**Tech Stack:** Claude Code Agent Teams (experimental), `.claude/agents/` YAML frontmatter, `.agent/skills/` (16 existing skills)

---

### Task 1: Enable Agent Teams globally

**Files:**
- Modify: `~/.claude/settings.json`

**Context:** Agent Teams is experimental and disabled by default. It must be enabled via the `env` key in the global settings file. The project-level `settings.local.json` already exists but global settings is the right place for this — teammates are spawned as independent Claude Code processes and need the env var at launch.

**Step 1: Read current settings**

```bash
cat ~/.claude/settings.json
```

**Step 2: Add env block**

Add `"env"` key alongside existing top-level keys in `~/.claude/settings.json`:

```json
{
  "$schema": "https://json.schemastore.org/claude-code-settings.json",
  "env": {
    "CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS": "1"
  },
  "permissions": { ... },
  "enabledPlugins": { ... }
}
```

Keep all existing content. Only add the `"env"` block.

**Step 3: Verify**

```bash
cat ~/.claude/settings.json | grep -A3 '"env"'
```

Expected output:
```
"env": {
  "CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS": "1"
},
```

**Step 4: Commit**

```bash
# ~/.claude/settings.json is not in the project repo — no commit needed
# Proceed to Task 2
```

---

### Task 2: Add skill injection to alpha-search-workflow agent

**Files:**
- Modify: `.claude/agents/alpha-search-workflow.md` (frontmatter only, lines 1-7)

**Context:** The existing agent has no `skills:` field, so none of the 16 project skills are preloaded into its context. According to the official docs, adding a `skills:` array in YAML frontmatter causes those skills to be injected automatically at spawn time. The 3 most relevant skills for alpha search orchestration are listed below.

**Step 1: Read current frontmatter**

```bash
head -8 .claude/agents/alpha-search-workflow.md
```

**Step 2: Add skills field**

Insert `skills:` after `memory: project` in the YAML frontmatter:

```yaml
---
name: alpha-search-workflow
description: "..."
model: sonnet
color: red
memory: project
skills:
  - qlib-investor-integration
  - fail-fast-coding-rules
  - where-to-save
---
```

**Step 3: Verify**

```bash
head -12 .claude/agents/alpha-search-workflow.md
```

Expected: `skills:` block visible with 3 entries.

**Step 4: Commit**

```bash
git add .claude/agents/alpha-search-workflow.md
git commit -m "feat: inject qlib/cdd/path skills into alpha-search-workflow agent"
```

---

### Task 3: Create quality-gate agent

**Files:**
- Create: `.claude/agents/quality-gate.md`

**Context:** This is the core deliverable. The quality-gate agent is spawned by the lead after each alpha candidate is generated. It receives the candidate formula, factor_id, and ic_proxy in its prompt. It evaluates 3 dimensions and returns a JSON verdict. The lead reads the verdict from Mailbox and either advances the candidate to backtest or logs a rejection.

The 3 dimensions:
- **Statistical significance**: IC t-statistic > 2.0. Approximated as `ic_proxy * sqrt(n_observations) / sqrt(1 - ic_proxy^2)`. If ic_proxy or n_obs not provided, flag as "cannot evaluate".
- **Novelty**: Correlation with playbook entries. Playbook lives at `ts-agent/data/playbook.json`. Read it, compare formula structure. If no playbook yet, auto-pass.
- **Economic interpretability**: Does the formula use operators and columns in a way that has a plausible economic mechanism? Check against qlib-investor-integration skill's allowed columns and operators.

**Step 1: Create the file**

```markdown
---
name: quality-gate
description: "Evaluates alpha candidates on 3 financial dimensions: statistical significance, novelty vs existing playbook, and economic interpretability. Invoke immediately after alpha candidate generation with the candidate details. Returns a JSON verdict with pass/fail per dimension and an overall decision."
tools: Read, Grep, Glob, Bash
model: sonnet
skills:
  - qlib-investor-integration
  - fail-fast-coding-rules
---

You are a quantitative finance quality gate evaluating alpha candidates for the investor project at /home/kafka/finance/investor.

## Input format expected in your prompt

```
factor_id: <string>
formula: <qlib expression>
ic_proxy: <float, optional>
n_observations: <int, optional>
```

## Your job

Evaluate the candidate on exactly 3 dimensions. Return a single JSON block as your final output.

## Dimension 1: Statistical Significance

If ic_proxy and n_observations are provided:
- Compute t-stat = ic_proxy * sqrt(n_observations) / sqrt(1 - ic_proxy^2)
- Pass if abs(t-stat) > 2.0

If not provided:
- status: "cannot_evaluate", reason: "ic_proxy or n_observations missing"

## Dimension 2: Novelty

Read the playbook at `ts-agent/data/playbook.json` using the Read tool.
If file does not exist or is empty: status: "pass", reason: "no existing playbook"
If playbook exists: check if any existing formula shares >50% of the same operators+columns combination.
Pass if correlation is low (no near-duplicate found).

## Dimension 3: Economic Interpretability

Assess whether the formula has a plausible economic mechanism:
- Uses columns from the allowed set ($close $open $high $low $volume $vwap $macro_iip $macro_cpi $macro_leverage_trend $segment_sentiment $ai_exposure $kg_centrality)
- No look-ahead bias (Ref with positive shift is fine; using future data is not)
- The combination of operators and columns maps to a real market phenomenon (momentum, mean-reversion, volatility, macro correlation, etc.)
- State the mechanism in one sentence

## Output format

Return exactly this JSON as your final message:

```json
{
  "factor_id": "<string>",
  "formula": "<string>",
  "dimensions": {
    "statistical_significance": {
      "status": "pass|fail|cannot_evaluate",
      "t_stat": <float|null>,
      "reason": "<string>"
    },
    "novelty": {
      "status": "pass|fail",
      "reason": "<string>"
    },
    "economic_interpretability": {
      "status": "pass|fail",
      "mechanism": "<one sentence>",
      "reason": "<string>"
    }
  },
  "verdict": "ADVANCE|REJECT",
  "reject_reason": "<string if REJECT, else null>"
}
```

verdict is ADVANCE only if all 3 dimensions are "pass". Any fail or cannot_evaluate → REJECT.
```

**Step 2: Verify file exists and frontmatter is valid**

```bash
head -10 .claude/agents/quality-gate.md
```

Expected: YAML frontmatter with name, description, tools, model, skills visible.

**Step 3: Commit**

```bash
git add .claude/agents/quality-gate.md
git commit -m "feat: add quality-gate agent for alpha candidate evaluation"
```

---

### Task 4: Smoke test

**Context:** No automated test framework for agent files. Validate manually by invoking the quality-gate agent with a sample candidate and checking the output format.

**Step 1: In Claude Code, run this prompt:**

```
Use the quality-gate agent to evaluate this alpha candidate:
factor_id: test_momentum_001
formula: Mean($close, 20) / Ref($close, 20)
ic_proxy: 0.06
n_observations: 500
```

**Step 2: Verify the response**

Expected: JSON block with all 3 dimensions evaluated, a `verdict` of ADVANCE or REJECT, and a `reject_reason` if rejected.

Check:
- `dimensions.statistical_significance.t_stat` is a number (≈ 1.34 for ic=0.06, n=500 → expect REJECT on this dimension)
- `dimensions.novelty.status` is "pass" (empty playbook)
- `dimensions.economic_interpretability.mechanism` describes momentum
- `verdict` is "REJECT" (t-stat < 2.0)

**Step 3: If output format is wrong**

Edit `.claude/agents/quality-gate.md` system prompt to clarify the problematic section. Re-test.

**Step 4: Final commit if any edits made**

```bash
git add .claude/agents/quality-gate.md
git commit -m "fix: quality-gate output format correction"
```
