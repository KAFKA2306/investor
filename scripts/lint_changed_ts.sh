#!/usr/bin/env bash
set -euo pipefail

base="${CHECK_BASE:-}"
if [[ -z "$base" || "$base" =~ ^0+$ ]] || ! git cat-file -e "${base}^{commit}" 2>/dev/null; then
  base="HEAD~1"
fi

mapfile -t files < <(
  git diff --name-only --diff-filter=ACMR "$base" HEAD -- \
    'ts-agent/src/**' 'ts-agent/tests/**' 'ts-agent/scripts/**' \
    'ts-agent/tsconfig.json' \
  | grep -E '^ts-agent/.*\.(ts|tsx|js|jsx|mjs|cjs|json)$' || true
)

if (( ${#files[@]} == 0 )); then
  echo "No changed TypeScript/JavaScript/JSON files require Biome validation."
  exit 0
fi

relative=()
for file in "${files[@]}"; do
  relative+=("${file#ts-agent/}")
done

printf 'Biome validating changed files:\n- %s\n' "${relative[@]}"
cd ts-agent
bun ./node_modules/@biomejs/biome/bin/biome check "${relative[@]}"
