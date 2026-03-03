from vllm import LLM, SamplingParams

llm = LLM(
    model="./models/cyankiwi/Qwen3.5-9B-AWQ-BF16-INT4",
    gpu_memory_utilization=0.9,
    max_model_len=4096,
)

params = SamplingParams(max_tokens=128)

out = llm.generate(["自己紹介してください。"], params)
print(out[0].outputs[0].text)
