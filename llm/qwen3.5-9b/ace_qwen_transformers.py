"""
🎀 Qwen 3.5 9B を transformers で実行するよっ！✨
ACE（Autonomous Capital Exploration）の理想的なテーマ生成を検証
"""

import json
import logging
from pathlib import Path
from typing import Any

import torch
from transformers import AutoModelForCausalLM, AutoTokenizer

from path_utils import ensure_model_exists, get_qwen_model_path

# ロギング設定
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s - %(name)s - %(levelname)s - %(message)s"
)
logger = logging.getLogger(__name__)


def run_ace_qwen_transformers() -> bool:
    """
    Qwen 3.5 9B を transformers で実行

    Returns:
        bool: 成功時 True、失敗時 False
    """
    # 📌 Path Registry から model_path を解決
    model_path = get_qwen_model_path()

    if not ensure_model_exists(model_path):
        logger.error(f"❌ [Qwen-ACE] モデルが見つかりません: {model_path}")
        return False

    try:
        logger.info("🚀 [Qwen-ACE] Loading Model & Tokenizer (Transformers)...")
        tokenizer = AutoTokenizer.from_pretrained(model_path, trust_remote_code=True)

        # RTX 3060 12GB なら INT4 なら余裕なはずっ！💖
        model = AutoModelForCausalLM.from_pretrained(
            model_path,
            device_map="auto",
            trust_remote_code=True,
            torch_dtype=torch.bfloat16
        )
    except Exception as e:
        logger.error(f"❌ [Qwen-ACE] モデルロード失敗: {e}")
        return False

    system_prompt = (
        "You are an autonomous quant idea generator. "
        "Return only valid JSON matching the requested schema."
    )

    # 📌 スキーマ定義（Zod に相当）
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

    messages = [
        {"role": "system", "content": system_prompt},
        {"role": "user", "content": user_prompt}
    ]

    try:
        text = tokenizer.apply_chat_template(
            messages,
            tokenize=False,
            add_generation_prompt=True
        )

        model_inputs = tokenizer([text], return_tensors="pt").to(model.device)

        logger.info("🚀 [Qwen-ACE] Generating response...")
        generated_ids = model.generate(
            **model_inputs,
            max_new_tokens=1024,
            do_sample=True,
            temperature=0.7
        )

        generated_ids = [
            output_ids[len(input_ids):]
            for input_ids, output_ids in zip(model_inputs.input_ids, generated_ids)
        ]

        response = tokenizer.batch_decode(generated_ids, skip_special_tokens=True)[0]

        logger.info("\n--- RAW QWEN RESPONSE START ---")
        logger.info(response)
        logger.info("--- RAW QWEN RESPONSE END ---")

        # 📌 JSON 抽出とバリデーション
        if _parse_and_validate_json(response, schema):
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

    📌 フォールバック付きで、複数の抽出戦略を試行
    """
    # 戦略1: JSON ブロック抽出（中括弧を検索）
    try:
        start = response.find("{")
        end = response.rfind("}") + 1

        if start != -1 and end > start:
            json_str = response[start:end]
            parsed = json.loads(json_str)

            # 📌 スキーマバリデーション（簡易版）
            required = schema.get("required", [])
            if all(key in parsed for key in required):
                logger.info(json.dumps(parsed, indent=2, ensure_ascii=False))
                return True
    except json.JSONDecodeError:
        pass

    # 戦略2: Markdown コードブロック抽出（フォールバック）
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
    success = run_ace_qwen_transformers()
    exit(0 if success else 1)
