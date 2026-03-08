import os
import logging

logger = logging.getLogger(__name__)


def get_qwen_model_path() -> str:
    base_dir = os.path.dirname(os.path.abspath(__file__))
    return os.path.join(base_dir, "models", "cyankiwi", "Qwen3.5-9B-AWQ-BF16-INT4")


def ensure_model_exists(model_path: str) -> bool:
    if os.path.exists(model_path) and os.path.isdir(model_path):
        config_path = os.path.join(model_path, "config.json")
        if os.path.exists(config_path):
            return True
    return False
