#!/usr/bin/env bash
# self_healing_lint.sh - Formats linter output as instructions for the agent. ✨🤖

set -euo pipefail

echo "### 🤖 Self-Healing Lint Report ✨ ###"
echo "---------------------------------------"

# 1. Biome (TypeScript)
if [ -d "ts-agent" ]; then
    echo "Checking TypeScript (Biome)..."
    (cd ts-agent && bun ./node_modules/@biomejs/biome/bin/biome check src tests 2>&1) || {
        echo ""
        echo "💡 HELP: Biome detected issues! Please check the errors above."
        echo "FIX: Run 'task format' or manually address the suggested changes."
    }
fi

# 2. Ruff (Python)
if command -v uv > /dev/null; then
    echo "Checking Python (Ruff)..."
    uv run ruff check . 2>&1 || {
        echo ""
        echo "💡 HELP: Ruff detected Python lint errors!"
        echo "FIX: Use 'uv run ruff check --fix .' for automatic repairs."
    }
fi

echo "---------------------------------------"
echo "✨ Loop complete! Keep the repo clean, okay? 💖"
