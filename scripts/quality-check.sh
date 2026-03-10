#!/bin/bash

# Quality Check Integration Script
# Runs full pipeline: format → lint → architecture check

set -e

echo "🔧 Quality Pipeline Integration"
echo "================================"
echo ""

# Get changed files
CHANGED=$(git diff --name-only HEAD 2>/dev/null | grep -E '\.(ts|js)$' | head -5)

if [ -z "$CHANGED" ]; then
  echo "No TypeScript files changed."
  exit 0
fi

echo "Files to check:"
for f in $CHANGED; do
  echo "  • $f"
done
echo ""

# Phase 1: Format
echo "📋 Phase 1: Biome format..."
for f in $CHANGED; do
  if [ -f "$f" ]; then
    biome format --write "$f" 2>/dev/null || true
  fi
done
echo "✓ Formatted"
echo ""

# Phase 2: Lint
echo "🔍 Phase 2: Biome lint..."
biome lint $CHANGED 2>/dev/null || echo "⚠️  Lint issues found (see above)"
echo ""

# Phase 3: Architecture (if ast-grep available)
if command -v ast-grep &> /dev/null; then
  echo "🏛️  Phase 3: Architecture rules..."
  ast-grep --rule .ast-grep-rule.yaml $CHANGED || echo "⚠️  Architecture issues found"
  echo ""
else
  echo "⚠️  ast-grep not installed (skipping architecture check)"
  echo "   Install: npm install -g @ast-grep/cli"
  echo ""
fi

echo "✅ Pipeline complete"
