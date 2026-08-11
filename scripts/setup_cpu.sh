#!/usr/bin/env bash
set -euo pipefail

cache_root="${TMPDIR:-/tmp}/investor-cache"
uv_cache_dir="$cache_root/uv"
requirements_file="$cache_root/requirements-cpu.txt"
mkdir -p "$cache_root" "$uv_cache_dir"

# CI/reproducible setup must never rewrite committed lockfiles.
(cd ts-agent && bun ci)
(cd ts-agent/src/dashboard && npm ci)

# This repository is a flat workspace, not one installable Python package.
# Compile only the base project dependencies. Optional GPU extras such as
# `ml` and `inference` are intentionally excluded from the standard CPU path.
UV_CACHE_DIR="$uv_cache_dir" XDG_CACHE_HOME="$cache_root" \
  uv pip compile pyproject.toml --output-file "$requirements_file"
UV_CACHE_DIR="$uv_cache_dir" XDG_CACHE_HOME="$cache_root" uv venv
UV_CACHE_DIR="$uv_cache_dir" XDG_CACHE_HOME="$cache_root" \
  uv pip sync "$requirements_file"
