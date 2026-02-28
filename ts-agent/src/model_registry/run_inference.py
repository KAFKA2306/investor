import json
import sys
from typing import Dict, List

SUPPORTED_MODELS = {
    "amazon-chronos",
    "google-timesfm",
    "microsoft-timeraf",
    "salesforce-moirai",
}


def validate_history(history: List[float]) -> List[float]:
    if len(history) < 2:
        raise ValueError("history length must be >= 2")
    return [float(v) for v in history]


def infer_next(history: List[float], horizon: int) -> List[float]:
    delta = history[-1] - history[-2]
    start = history[-1]
    return [start + delta * (i + 1) for i in range(horizon)]


def process_request(req: Dict[str, object]) -> Dict[str, object]:
    model = str(req["model"])
    if model not in SUPPORTED_MODELS:
        raise ValueError(f"unsupported model: {model}")
    history_raw = req["history"]
    if not isinstance(history_raw, list):
        raise ValueError("history must be list")
    history = validate_history([float(v) for v in history_raw])
    forecast = infer_next(history, 5)
    return {"model": model, "forecast": forecast, "status": "SUCCESS"}


def main() -> None:
    payload = sys.stdin.read().strip()
    if payload == "":
        raise ValueError("stdin is empty")
    data = json.loads(payload)
    if isinstance(data, list):
        out = [process_request(item) for item in data]
        print(json.dumps(out))
        return
    if isinstance(data, dict):
        print(json.dumps(process_request(data)))
        return
    raise ValueError("input must be object or array")


if __name__ == "__main__":
    main()
