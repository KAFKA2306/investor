# Task Completion Checklist

When finishing a coding task in this repo:

1. Run quality gates:
- `task check`

2. Run targeted verification for changed behavior:
- Relevant `bun test` suites and/or targeted scripts in `ts-agent/src/tests/` or experiments.

3. If pipeline/dashboard behavior changed, run appropriate flow:
- `task run` and/or `task view` as needed.

4. Validate generated artifacts/logs:
- Inspect `logs/` outputs for expected content and no sensitive data.

5. Prepare commit/PR metadata:
- Conventional Commit message.
- Summary of problem/solution.
- Affected paths.
- Verification commands and key results.
- Dashboard/report screenshot if UI/docs changed.