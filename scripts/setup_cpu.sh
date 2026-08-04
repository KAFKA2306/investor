#!/usr/bin/env bash
set -euo pipefail

cache_root="${TMPDIR:-/tmp}/investor-cache"
uv_cache_dir="$cache_root/uv"
mkdir -p "$cache_root" "$uv_cache_dir"

# TypeScript runtime and dashboard dependencies.
task deps

# CI and ordinary CPU development must not install GPU-only optional extras.
UV_CACHE_DIR="$uv_cache_dir" XDG_CACHE_HOME="$cache_root" uv venv
UV_CACHE_DIR="$uv_cache_dir" XDG_CACHE_HOME="$cache_root" uv pip install -e .
