import sys
import json
import ast
import re
import pandas as pd
import numpy as np


def eval_formula(formula: str, df: pd.DataFrame) -> pd.Series:
    # Replace $col → __col (valid Python identifier)
    # Using more robust regex to handle various column names
    normalized = re.sub(r"\$([a-zA-Z0-9_]+)", r"__\1", formula)

    # Build local namespace with numeric column Series and supported ops
    ns: dict = {}
    for col in df.columns:
        if pd.api.types.is_numeric_dtype(df[col]):
            ns[f"__{col}"] = df[col].astype(float)

    def _ref(s, n):  # type: ignore[return]
        return s.shift(int(n))

    def _mean(s, n):  # type: ignore[return]
        return s.rolling(int(n)).mean()

    def _std(s, n):  # type: ignore[return]
        return s.rolling(int(n)).std()

    def _sum(s, n):  # type: ignore[return]
        return s.rolling(int(n)).sum()

    def _max(s, n):  # type: ignore[return]
        return s.rolling(int(n)).max()

    def _min(s, n):  # type: ignore[return]
        return s.rolling(int(n)).min()

    def _corr(s1, s2, n):  # type: ignore[return]
        return s1.rolling(int(n)).corr(s2)

    def _rank(s):  # type: ignore[return]
        return s.rank(pct=True)

    def _abs(s):  # type: ignore[return]
        return s.abs()

    def _log(s):  # type: ignore[return]
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
    epsilon = 1e-9
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
            # Stability: protect against division by zero/inf
            if isinstance(right, pd.Series):
                return left / (right.replace(0, np.nan).fillna(epsilon))
            return left / (right if right != 0 else epsilon)
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
        
        pooled_signals = []
        pooled_returns = []
        scores_by_symbol = []

        for symbol, group in df.groupby("symbol"):
            group = group.set_index("date")
            try:
                signal = eval_formula(formula, group)
                # Next-day return calculation
                forward_ret = group["close"].pct_change().shift(-1)
                
                # Align signal with forward return
                aligned = pd.concat([signal, forward_ret], axis=1).dropna()
                aligned.columns = ["signal", "ret"]
                
                for date, row in aligned.iterrows():
                    val = float(row["signal"])
                    if not np.isfinite(val):
                        continue
                        
                    pooled_signals.append(val)
                    pooled_returns.append(float(row["ret"]))
                    scores_by_symbol.append({
                        "symbol": symbol,
                        "date": str(date.date() if hasattr(date, "date") else date), # type: ignore
                        "score": val,
                    })
            except Exception as e:
                # Log or handle formula errors per factor
                print(f"Error evaluating factor {fid} for {symbol}: {e}", file=sys.stderr)

        ic = 0.0
        if len(pooled_signals) > 1:
            ic = float(np.corrcoef(pooled_signals, pooled_returns)[0, 1])
            if np.isnan(ic):
                ic = 0.0

        results.append({
            "factor_id": fid,
            "status": "success",
            "scores": scores_by_symbol,
            "ic_proxy": round(ic, 4),
        })

    return {"status": "success", "results": results}


if __name__ == "__main__":
    try:
        request = json.load(sys.stdin)
        result = evaluate_factors(request)
        print(json.dumps(result))
    except Exception as e:
        print(json.dumps({"status": "error", "message": str(e)}))
