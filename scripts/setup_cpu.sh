#!/usr/bin/env bash
set -euo pipefail

cache_root="${TMPDIR:-/tmp}/investor-cache"
uv_cache_dir="$cache_root/uv"
requirements_file="$cache_root/requirements-cpu.txt"
python_version="3.12" # pyqlib 0.9.7 ships cp312 wheels, but not cp313/cp314.
mkdir -p "$cache_root" "$uv_cache_dir"

# CI/reproducible setup must never rewrite committed lockfiles.
(cd ts-agent && bun ci)
(cd ts-agent/src/dashboard && npm ci)

# This repository is a flat workspace, not one installable Python package.
# Resolve and create the CPU environment for the same supported interpreter;
# the hosted runner default may be Python 3.14, which pyqlib cannot use.
# Optional GPU extras such as `ml` and `inference` are intentionally excluded.
UV_CACHE_DIR="$uv_cache_dir" XDG_CACHE_HOME="$cache_root" \
  uv python install "$python_version"
UV_CACHE_DIR="$uv_cache_dir" XDG_CACHE_HOME="$cache_root" \
  uv pip compile pyproject.toml --python-version "$python_version" --output-file "$requirements_file"
UV_CACHE_DIR="$uv_cache_dir" XDG_CACHE_HOME="$cache_root" \
  uv venv --python "$python_version"
UV_CACHE_DIR="$uv_cache_dir" XDG_CACHE_HOME="$cache_root" \
  uv pip sync "$requirements_file"
