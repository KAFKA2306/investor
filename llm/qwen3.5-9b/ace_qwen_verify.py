"""
🎀 Qwen 3.5 9B を vLLM で実行するよっ！✨
ACE（Autonomous Capital Exploration）テーマ生成の本格検証
"""

import json
import logging
from typing import Any

from path_utils import ensure_model_exists, get_qwen_model_path

try:
    from vllm import LLM, SamplingParams
    HAS_VLLM = True
except ImportError:
    HAS_VLLM = False

# ロギング設定
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s - %(name)s - %(levelname)s - %(message)s"
)
logger = logging.getLogger(__name__)


def run_ace_qwen() -> bool:
    """
    Qwen 3.5 9B を vLLM で実行

    Returns:
        bool: 成功時 True、失敗時 False
    """
    if not HAS_VLLM:
        logger.error("❌ vLLM がインストールされていません。`pip install vllm` してね")
        return False

    # 📌 Path Registry から model_path を解決
    model_path = get_qwen_model_path()

    if not ensure_model_exists(model_path):
        logger.error(f"❌ [Qwen-ACE] モデルが見つかりません: {model_path}")
        return False

    try:
        logger.info(f"🚀 [Qwen-ACE] Loading vLLM with model: {model_path}")
        llm = LLM(
            model=model_path,
            gpu_memory_utilization=0.8,
            max_model_len=4096,
            trust_remote_code=True
        )
    except Exception as e:
        logger.error(f"❌ [Qwen-ACE] vLLM初期化失敗: {e}")
        return False

    # ACE 形式のプロンプトを合成
    system_prompt = (
        "You are an autonomous quant idea generator. "
        "Return only valid JSON matching the requested schema."
    )

    schema = {
        "type": "object",
        "required": ["theme", "hypothesis", "featureSignature", "noveltyRationale", "ideaHashHint"],
        "properties": {
            "theme": {"type": "string"},
            "hypothesis": {"type": "string"},
            "featureSignature": {"type": "array", "items": {"type": "string"}},
            "noveltyRationale": {"type": "string"},
            "ideaHashHint": {"type": "string"}
        }
    }

    user_prompt = f"""Generate exactly one novel alpha exploration theme for Japanese equities.
Mission: Verify Qwen 3.5 9B ACE capability.
Market Context: Japanese equities, local inference test, retail-driven price action.
Existing Themes: none
Forbidden Themes: none
Recent Successes: none
Recent Failures: none
User Intent: Test ACE logic on local model.

Return exactly one JSON object following this schema:
{json.dumps(schema, indent=2)}
"""

    # Qwen chat template
    prompt = f"<|im_start|>system\n{system_prompt}<|im_end|>\n<|im_start|>user\n{user_prompt}<|im_end|>\n<|im_start|>assistant\n"

    sampling_params = SamplingParams(
        temperature=0.7,
        max_tokens=1024,
        stop=["<|im_end|>"]
    )

    try:
        logger.info("🚀 [Qwen-ACE] Generating alpha theme...")
        outputs = llm.generate([prompt], sampling_params)

        raw_text = outputs[0].outputs[0].text
        logger.info("\n--- RAW QWEN RESPONSE START ---")
        logger.info(raw_text)
        logger.info("--- RAW QWEN RESPONSE END ---")

        # 📌 JSON パース + バリデーション
        if _parse_and_validate_json(raw_text, schema):
            logger.info("✅ [SUCCESS] Qwen produced valid JSON!")
            return True
        else:
            logger.warning("❌ [FAILURE] JSON parsing or validation failed.")
            return False

    except Exception as e:
        logger.error(f"❌ [Qwen-ACE] 推論失敗: {e}")
        return False


def _parse_and_validate_json(response: str, schema: dict[str, Any]) -> bool:
    """
    JSON 抽出とスキーマバリデーション

    📌 複数の抽出戦略とフォールバック
    """
    # 戦略1: JSON ブロック抽出
    try:
        start = response.find("{")
        end = response.rfind("}") + 1

        if start != -1 and end > start:
            json_str = response[start:end]
            parsed = json.loads(json_str)

            # スキーマバリデーション
            required = schema.get("required", [])
            if all(key in parsed for key in required):
                logger.info(json.dumps(parsed, indent=2, ensure_ascii=False))
                return True
    except json.JSONDecodeError:
        pass

    # 戦略2: Markdown コードブロック抽出
    try:
        if "```json" in response:
            parts = response.split("```json")
            if len(parts) > 1:
                json_part = parts[1].split("```")[0].strip()
                parsed = json.loads(json_part)
                required = schema.get("required", [])
                if all(key in parsed for key in required):
                    logger.info(json.dumps(parsed, indent=2, ensure_ascii=False))
                    return True
    except (json.JSONDecodeError, IndexError):
        pass

    return False


if __name__ == "__main__":
    success = run_ace_qwen()
    exit(0 if success else 1)
