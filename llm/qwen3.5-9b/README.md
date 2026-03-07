# Qwen 3.5 Local Verify Runbook

## Purpose
Run `ace_qwen_verify.py` and get one schema-valid JSON object on local GPU.

## Verified Settings
- Use a Qwen3.5-compatible `vllm` build.
- Keep `LD_LIBRARY_PATH` prefixed with `.venv` `nvjitlink` path when CUDA symbol mismatch appears.
- Use low-VRAM-safe engine settings in `ace_qwen_verify.py`:
  - `enforce_eager=True`
  - `limit_mm_per_prompt={"image":0,"video":0}`
  - `enable_chunked_prefill=False`
  - `max_num_seqs=1`
- Prefix assistant prompt with `<think>\n</think>\n` to reach JSON output quickly.

## Command
```bash
LD_LIBRARY_PATH=/home/kafka/finance/investor/.venv/lib/python3.12/site-packages/nvidia/nvjitlink/lib:$LD_LIBRARY_PATH \
/home/kafka/finance/investor/.venv/bin/python llm/qwen3.5-9b/ace_qwen_verify.py
```

## Expected Result
A single parsed Python `dict` with keys:
- `theme`
- `hypothesis`
- `featureSignature`
- `noveltyRationale`
- `ideaHashHint`
