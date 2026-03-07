---
name: qwen-local-inference
description: >
  MANDATORY TRIGGER: Invoke for any local LLM inference task using Qwen/vLLM on
  GPU, including alpha idea generation, JSON-schema constrained output, OpenAI
  API replacement, local model benchmarking, or vLLM troubleshooting. If the
  request mentions local model, Qwen, vLLM, GPU inference, or avoiding external
  API cost, this skill must be used.
---

# 🎀 Qwen Local Inference Skill 🎀

Qwen 3.5 9B を使って、市場の隠れたアルファを爆速で引き出すための知能スキルだよっ！💖 ✨

## 🚀 いつ使うの？ (When to use)
- 新しいクオンツのアイデアやテーマを生成したいとき！🧠
- ローカル環境のGPUリソース（CUDA）を活用して高速推論を行いたいとき ⚡
- LLMの出力を厳密な JSON フォーマットで受け取り、次のパイプラインに繋げたいとき 🔗

## 📖 使い方 (How to use)

### 推論の実行
- **入力**: システムプロンプト、ユーザープロンプト、期待する JSON スキーマ。
- **手順**: 
    1. `vLLM` (推奨) または `Transformers` エンジンを選択。
    2. `llm/qwen3.5-9b/path_utils.py` でモデルパスを取得。
    3. スクリプトを実行して推論を開始！🔥
- **出力**: スキーマに従ったバリデーション済みの JSON オブジェクト。

## 🛡️ 鉄の掟 (Strict Rules)

1. **モデルパスの動的解決**: パスをソースコードに直書きするのは禁止！めっ！だよっ！💢 必ず `path_utils.py` を通してね。
2. **「Fail Fast」の徹底**: ビジネスロジックに `try-catch` は書かない。エラーはそのまま突き抜けさせて、原因を明確にするんだもんっ！🛡️
3. **スキーマバリデーション**: 出力された JSON は必ず Zod (TS) や Pydantic (Py) で検証すること！不完全なアイデアは採用しないよ ❌

## 🚀 推論エンジン (Engines)
- **vLLM (Recommended)**: 最高のパフォーマンス。大量のアイデアを同時生成するのに最適だよっ！✨
- **Transformers (Fallback)**: 柔軟性重視。特定のハードウェア制約がある場合に使用してね 🐾

## 🎀 ベストプラクティス
- **プロンプトエンジニアリング**: 役割（System Prompt）を明確に与えることで、回答の質がグンと上がるよっ！🌈
- **リソース管理**: `gpu_memory_utilization` を適切に設定して、他のプロセスとのバランスを取ろうねっ！💎

✨ Qwen の知能で、アルファの鉱脈を掘り当てようねっ！🎀👑✨

## 🔧 Qwen3.5 実運用 トラブルシューティング (2026-03-07 確認済み)

### 問題と解決の連鎖

| エラー | 原因 | 修正 |
|--------|------|------|
| `KeyError: 'qwen3_5'` | stable vllm は `qwen3_5` アーキテクチャ未登録 | **nightly vllm 必須** |
| `ImportError: libcusparse ... undefined symbol` | cu129 torch と system CUDA ライブラリ不整合 | `LD_LIBRARY_PATH` に `.venv` の nvjitlink を先付け |
| `No available memory for the cache blocks` | Vision Encoder プロファイリング + 12GB VRAM 不足 | 下記 LLM() パラメータセット参照 |
| `JSONDecodeError` (空文字) | Thinking mode が max_tokens を全消費 | プロンプトに `<think>\n</think>\n` を先付け |

### nightly vllm インストール (必須)
```bash
uv pip install -U vllm --torch-backend=auto --extra-index-url https://wheels.vllm.ai/nightly
```

> **重要**: `uv run` は `uv.lock` から環境を毎回復元するため、nightly が上書きされる。
> インストール後は `uv run` ではなく `.venv/bin/python` で直接実行すること。

### 12GB VRAM 環境の LLM() パラメータ (確認済み最小構成)
```python
llm = LLM(
    model=model_path,
    gpu_memory_utilization=0.9,
    max_model_len=4096,           # デフォルト 262144 は 12GB に入らない
    enforce_eager=True,           # torch.compile を無効化してメモリ削減
    limit_mm_per_prompt={"image": 0, "video": 0},  # Vision Encoder プロファイリング無効
    enable_chunked_prefill=False, # profiling 時のピークメモリ削減
    max_num_seqs=1,
)
```

### Thinking Mode 無効化プロンプト
```python
prompt = (
    f"<|im_start|>system\n{system_prompt}<|im_end|>\n"
    f"<|im_start|>user\n{user_prompt}<|im_end|>\n"
    f"<|im_start|>assistant\n<think>\n</think>\n"   # ← これで即 JSON 出力
)
```

### 実行コマンド
```bash
LD_LIBRARY_PATH=/home/kafka/finance/investor/.venv/lib/python3.12/site-packages/nvidia/nvjitlink/lib:$LD_LIBRARY_PATH \
/home/kafka/finance/investor/.venv/bin/python llm/qwen3.5-9b/ace_qwen_verify.py
```

### Fail Fast ルール
- モデル不在: `return False` ❌ → `raise FileNotFoundError(...)` ✅
- JSON パース失敗: `return False` ❌ → `raise ValueError(...)` ✅
- 戻り値: `bool` ❌ → `dict` (生成された JSON そのもの) ✅
