---
name: qwen-local-inference
description: >
  Run local LLM inference using the Qwen 3.5 9B model via vLLM or Transformers
  on the local CUDA GPU, producing strictly validated JSON output for the quant
  pipeline. Invoke this skill whenever the task involves: generating quant alpha
  ideas or investment themes using a local model, running LLM inference without
  an external API call, leveraging the local GPU for batch idea generation,
  requiring validated JSON-schema output from an LLM, or integrating Qwen output
  into the ts-agent pipeline. If the user mentions "local model", "Qwen",
  "vLLM", "GPU inference", "run inference locally", or wants to avoid OpenAI API
  costs — this skill must be invoked. Also invoke it when setting up or
  troubleshooting the vLLM server at llm/qwen3.5-9b/.
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
