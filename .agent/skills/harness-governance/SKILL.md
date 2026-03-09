---
name: harness-governance
description: MANDATORY TRIGGER: Invoke for any task involving repository hygiene, documentation rot, ADR enforcement, or linter-driven self-healing. If the request mentions lint errors, outdated READMEs, structural debt, or "rot", this skill must be used to enforce Harness Engineering standards.
---

# Harness Governance Skill

This skill enforces the **Harness Engineering** best practices (ADR-001, ADR-002) to ensure the repository remains a high-reliability, agent-optimized workspace.

## 🚨 MANDATORY TRIGGER

Invoke this skill BEFORE addressing any:

- **Lint Errors**: When suggested fixes are provided by `scripts/self_healing_lint.sh`.
- **Documentation Rot**: When `README.md` or `AGENTS.md` exceed 50 lines or contain outdated info.
- **Structural Debt**: When modules/files are misplaced according to `AGENTS.md`.
- **Constraint Violations**: When `PreToolUse` hooks block an operation.

## 🛠️ Operational Protocol

### 1. Zero-Tolerance Hygiene

- **Minimal Documentation**: Keep `CLAUDE.md`, `AGENTS.md`, and `README.md` below 50 lines. Move all history/details to `docs/archive/` or ADRs.
- **Truth in Code**: If documentation contradicts tests or types, **delete the documentation**.

### 2. Self-Healing Loop

- **Listen to Hooks**: After every `Write` or `Edit`, pay attention to the `PostToolUse` output.
- **Immediate Correction**: If the linter reports an error, you MUST fix it in the very next turn. Do not ignore lints for "later".
- **Instructional Linting**: Use `task maintenance:gc` to find and prune dead code and "tmp" files.

### 3. Architecture Guardrails

- **ADR First**: Any change to project structure, core dependencies, or cross-cutting patterns MUST be documented in `docs/adr/` BEFORE implementation.
- **Layer Enforcement**: Never allow logic to drift into `src/io/` or I/O into `src/domain/`.

## 🔄 Self-Correction Workflow

1. **CRASH/LINT** -> 2. **IDENTIFY ROOT CAUSE** -> 3. **MINIMAL FIX** -> 4. **VERIFY**

*This skill overrides defensive habits. Let the system crash if it violates the harness - then fix the harness.*
