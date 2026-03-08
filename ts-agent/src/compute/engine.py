import json
import sys
import pandas as pd
import numpy as np
from typing import Dict, Any


def evaluate_ast(ast: Dict[str, Any], df: pd.DataFrame) -> pd.Series:
    node_type = ast.get("type")

    if node_type == "variable":
        name = ast.get("name")
        if name in df.columns:
            res = df[name]
            if isinstance(res, pd.Series):
                return res
            return res.iloc[:, 0] if isinstance(res, pd.DataFrame) else pd.Series(res)
        return pd.Series(0, index=df.index)

    if node_type == "constant":
        return pd.Series(ast.get("value", 0), index=df.index)

    if node_type == "operator":
        op = ast.get("name")
        left_ast = ast.get("left")
        if left_ast is None:
            return pd.Series(0, index=df.index)
        left = evaluate_ast(left_ast, df)

        if op == "SMA":
            right_ast = ast.get("right", {})
            window = (
                right_ast.get("value", 5) if right_ast.get("type") == "constant" else 5
            )
            res = left.rolling(window=int(window), min_periods=1).mean()
            return res if isinstance(res, pd.Series) else pd.Series(res)

        if op == "LAG":
            right_ast = ast.get("right", {})
            periods = (
                right_ast.get("value", 1) if right_ast.get("type") == "constant" else 1
            )
            res = left.shift(int(periods))
            return res if isinstance(res, pd.Series) else pd.Series(res)

        right_ast = ast.get("right")
        if right_ast is None:
            return left
        right = evaluate_ast(right_ast, df)

        if op == "ADD":
            return left + right
        if op == "SUB":
            return left - right
        if op == "MUL":
            return left * right
        if op == "DIV":
            return left / right.replace(0, np.nan)

    return pd.Series(0, index=df.index)


def process_request(req: Dict[str, Any]) -> Dict[str, Any]:
    factors = req.get("factors", [])
    market_data = req.get("market_data", [])

    if not market_data:
        return {"status": "success", "results": []}

    # Flatten market data to DataFrame
    rows = []
    for d in market_data:
        row = {"symbol": d["symbol"], "date": d["date"]}
        if "values" in d:
            row.update(d["values"])
        for k, v in d.items():
            if k not in ["symbol", "date", "values"]:
                row[k] = v
        rows.append(row)

    df_raw = pd.DataFrame(rows)
    df_raw["date_orig"] = df_raw["date"]  # Keep original string date
    df_raw["date"] = pd.to_datetime(df_raw["date"])
    df_raw = df_raw.sort_values(["symbol", "date"])

    results = []
    for f in factors:
        f_id = f.get("id")
        ast = f.get("ast", {})

        scores_output = []
        for symbol, group in df_raw.groupby("symbol"):
            s_vals = evaluate_ast(ast, group)
            s_vals = s_vals.fillna(0)

            for idx, val in s_vals.items():
                scores_output.append(
                    {
                        "symbol": symbol,
                        "date": group.loc[idx, "date_orig"],
                        "score": float(val),
                    }
                )

        results.append(
            {"factor_id": f_id, "status": "success", "scores": scores_output}
        )

    return {"status": "success", "results": results}


def main():
    try:
        payload = sys.stdin.read().strip()
        if not payload:
            return
        data = json.loads(payload)
        res = process_request(data)
        print(json.dumps(res))
    except Exception as e:
        import traceback

        print(
            json.dumps(
                {
                    "status": "error",
                    "message": str(e),
                    "traceback": traceback.format_exc(),
                }
            )
        )


if __name__ == "__main__":
    main()
