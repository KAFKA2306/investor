import json
import logging
from typing import Any
from vllm import LLM, SamplingParams
from path_utils import ensure_model_exists, get_qwen_model_path

logging.basicConfig(level=logging.INFO, format="%(asctime)s - %(name)s - %(levelname)s - %(message)s")
logger = logging.getLogger(__name__)

def run_ace_qwen() -> dict:
    model_path = get_qwen_model_path()

    if not ensure_model_exists(model_path):
        raise FileNotFoundError(f"Model not found: {model_path}")

    llm = LLM(
        model=model_path,
        gpu_memory_utilization=0.9,
        max_model_len=4096,
        enforce_eager=True,
        limit_mm_per_prompt={"image": 0, "video": 0},
        enable_chunked_prefill=False,
        max_num_seqs=1,
    )

    system_prompt = "You are an autonomous quant idea generator. Return only valid JSON matching the requested schema."

    schema = {
        "type": "object",
        "required": ["theme", "hypothesis", "featureSignature", "noveltyRationale", "ideaHashHint"],
        "properties": {
            "theme": {"type": "string"},
            "hypothesis": {"type": "string"},
            "featureSignature": {"type": "array", "items": {"type": "string"}},
            "noveltyRationale": {"type": "string"},
            "ideaHashHint": {"type": "string"},
        },
    }

    user_prompt = f"""Generate exactly one novel alpha exploration theme for Japanese equities.
Return exactly one JSON object following this schema:
{json.dumps(schema, indent=2)}
"""

    prompt = f"<|im_start|>system\n{system_prompt}<|im_end|>\n<|im_start|>user\n{user_prompt}<|im_end|>\n<|im_start|>assistant\n<think>\n</think>\n"
    sampling_params = SamplingParams(temperature=0.7, max_tokens=1024, stop=["<|im_end|>"])

    outputs = llm.generate([prompt], sampling_params)
    raw_text = outputs[0].outputs[0].text

    return _parse_and_validate_json(raw_text, schema)

def _parse_and_validate_json(response: str, schema: dict[str, Any]) -> dict:
    start = response.find("{")
    end = response.rfind("}") + 1
    json_str = response[start:end]
    parsed = json.loads(json_str)
    missing = [k for k in schema.get("required", []) if k not in parsed]
    if missing:
        raise ValueError(f"Missing required keys: {missing}\nRaw: {response}")
    return parsed

if __name__ == "__main__":
    import pprint
    pprint.pprint(run_ace_qwen())
