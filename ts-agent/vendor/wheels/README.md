# Verification Plot Wheelhouse

This directory stores Python wheel artifacts used by `task pipeline:verification-plot`.

## Refresh

From repo root, run:

```bash
task python:refresh-verification-wheelhouse
```

That task updates:
- `ts-agent/uv.lock`
- wheels in this directory

`pipeline:verification-plot` is configured to run `uv` in offline mode (`UV_NO_INDEX=1`) and load packages only from this directory.
