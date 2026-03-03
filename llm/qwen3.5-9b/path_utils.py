"""
🎀 Qwen 3.5 9B パス管理ユーティリティ
PathRegistry に準拠した Python パス解決
"""

import os
from pathlib import Path


def get_qwen_model_path() -> str:
    """
    Qwen モデルのパスを取得
    優先順: 環境変数 > 相対パス > デフォルト
    """
    # 1. 環境変数から取得
    if env_path := os.environ.get("UQTL_QWEN_MODEL_PATH"):
        model_path = Path(env_path)
        if model_path.exists():
            return str(model_path)

    # 2. 相対パス（リポジトリ内）
    repo_relative = Path(__file__).parent / "models" / "cyankiwi" / "Qwen3.5-9B-AWQ-BF16-INT4"
    if repo_relative.exists():
        return str(repo_relative.resolve())

    # 3. デフォルト（エラーハンドリング時）
    default = "./models/cyankiwi/Qwen3.5-9B-AWQ-BF16-INT4"
    return default


def get_qwen_cache_dir() -> str:
    """Qwen キャッシュディレクトリを取得"""
    if cache_dir := os.environ.get("UQTL_QWEN_CACHE_DIR"):
        return cache_dir
    return "./qwen_cache"


def ensure_model_exists(model_path: str) -> bool:
    """モデルが存在するか確認"""
    return Path(model_path).exists()
