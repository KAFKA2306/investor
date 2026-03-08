import sys
import json
import ast
import re
import pandas as pd
import numpy as np


def eval_formula(formula: str, df: pd.DataFrame) -> pd.Series:
    # Replace $col → __col (valid Python identifier)
    normalized = re.sub(r"\$(\w+)", r"__\1", formula)

    # Build local namespace with numeric column Series and supported ops
    ns: dict = {}
    for col in df.columns:
        if pd.api.types.is_numeric_dtype(df[col]):
            ns[f"__{col}"] = df[col].astype(float)

    def _ref(s: pd.Series, n) -> pd.Series:
        return s.shift(int(n))

    def _mean(s: pd.Series, n) -> pd.Series:
        return s.rolling(int(n)).mean()

    def _std(s: pd.Series, n) -> pd.Series:
        return s.rolling(int(n)).std()

    def _sum(s: pd.Series, n) -> pd.Series:
        return s.rolling(int(n)).sum()

    def _max(s: pd.Series, n) -> pd.Series:
        return s.rolling(int(n)).max()

    def _min(s: pd.Series, n) -> pd.Series:
        return s.rolling(int(n)).min()

    def _corr(s1: pd.Series, s2: pd.Series, n) -> pd.Series:
        return s1.rolling(int(n)).corr(s2)

    def _rank(s: pd.Series) -> pd.Series:
        return s.rank(pct=True)

    def _abs(s: pd.Series) -> pd.Series:
        return s.abs()

    def _log(s: pd.Series) -> pd.Series:
        return np.log(s.clip(lower=1e-9))

    ns.update({
        "Ref": _ref, "Mean": _mean, "Std": _std, "Sum": _sum,
        "Max": _max, "Min": _min, "Corr": _corr, "Rank": _rank,
        "Abs": _abs, "Log": _log,
    })

    tree = ast.parse(normalized, mode="eval")
    result = _eval_node(tree.body, ns)
    if not isinstance(result, pd.Series):
        raise ValueError(f"Formula did not produce a Series: {formula!r}")
    return result


def _eval_node(node: ast.expr, ns: dict):
    if isinstance(node, ast.Constant):
        return node.value
    if isinstance(node, ast.Name):
        if node.id not in ns:
            raise ValueError(f"Unknown name: {node.id}")
        return ns[node.id]
    if isinstance(node, ast.BinOp):
        left = _eval_node(node.left, ns)
        right = _eval_node(node.right, ns)
        op = node.op
        if isinstance(op, ast.Add):
            return left + right
        if isinstance(op, ast.Sub):
            return left - right
        if isinstance(op, ast.Mult):
            return left * right
        if isinstance(op, ast.Div):
            return left / right
        raise ValueError(f"Unsupported binary op: {type(op).__name__}")
    if isinstance(node, ast.UnaryOp):
        operand = _eval_node(node.operand, ns)
        if isinstance(node.op, ast.USub):
            return -operand
        raise ValueError(f"Unsupported unary op: {type(node.op).__name__}")
    if isinstance(node, ast.Call):
        func_name = node.func.id if isinstance(node.func, ast.Name) else None
        if func_name not in ns:
            raise ValueError(f"Unknown function: {func_name}")
        args = [_eval_node(a, ns) for a in node.args]
        return ns[func_name](*args)
    raise ValueError(f"Unsupported AST node: {type(node).__name__}")


def evaluate_factors(request: dict) -> dict:
    market_data = request["market_data"]
    factors = request["factors"]

    df = pd.DataFrame(market_data)
    df["date"] = pd.to_datetime(df["date"])
    df.sort_values(["symbol", "date"], inplace=True)

    results = []
    for factor in factors:
        fid = factor["id"]
        formula = factor["formula"]
        scores_by_symbol = []
        for symbol, group in df.groupby("symbol"):
            group = group.set_index("date")
            signal = eval_formula(formula, group).dropna()
            forward = group["close"].pct_change().shift(-1)
            aligned = pd.concat([signal, forward], axis=1).dropna()
            aligned.columns = ["signal", "ret"]
            for date, row in aligned.iterrows():
                scores_by_symbol.append({
                    "symbol": symbol,
                    "date": str(date.date()),
                    "score": float(row["signal"]),
                })

        ic = 0.0
        if len(scores_by_symbol) > 0:
            scores_series = pd.Series([s["score"] for s in scores_by_symbol])
            rets = pd.Series([
                float(group["close"].pct_change().shift(-1).dropna().iloc[-1])
                for _, group in df.groupby("symbol")
                if len(group) > 1
            ])
            if len(rets) == len(scores_series):
                ic = float(scores_series.corr(rets))
                if pd.isna(ic):
                    ic = 0.0

        results.append({
            "factor_id": fid,
            "status": "success",
            "scores": scores_by_symbol,
            "ic_proxy": round(ic, 4),
        })

    return {"status": "success", "results": results}


if __name__ == "__main__":
    request = json.load(sys.stdin)
    result = evaluate_factors(request)
    print(json.dumps(result))
