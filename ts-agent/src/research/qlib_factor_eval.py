import sys
import json
import pandas as pd
import numpy as np
import re

# Qlib expression style evaluation logic using pandas
SUPPORTED_OPS = {
    "Ref": lambda s, n: s.shift(int(n)),
    "Mean": lambda s, n: s.rolling(int(n)).mean(),
    "Std": lambda s, n: s.rolling(int(n)).std(),
    "Sum": lambda s, n: s.rolling(int(n)).sum(),
    "Max": lambda s, n: s.rolling(int(n)).max(),
    "Min": lambda s, n: s.rolling(int(n)).min(),
    "Abs": lambda s: s.abs(),
    "Log": lambda s: np.log(s.clip(lower=1e-9)),
    "Rank": lambda s: s.rank(pct=True),
    "Corr": lambda s1, s2, n: s1.rolling(int(n)).corr(s2),
    "CS_ZScore": lambda s: (s - s.mean()) / s.std(), # Cross-sectional Z-Score (simplified for per-symbol)
}

def split_args(s: str) -> list[str]:
    depth, start, parts = 0, 0, []
    for i, c in enumerate(s):
        if c == "(": depth += 1
        elif c == ")": depth -= 1
        elif c == "," and depth == 0:
            parts.append(s[start:i].strip())
            start = i + 1
    parts.append(s[start:].strip())
    return parts

def eval_formula(formula: str, df: pd.DataFrame) -> pd.Series:
    def resolve(expr: str) -> pd.Series:
        expr = expr.strip()
        # column reference: $close, $open, etc.
        m = re.fullmatch(r"\$(\w+)", expr)
        if m:
            col = m.group(1)
            if col not in df.columns:
                raise ValueError(f"Unknown column: {col}")
            return df[col].astype(float)
        
        # function call: Op(arg1, arg2, ...)
        m = re.fullmatch(r"([A-Z][a-zA-Z_]*)\((.*)\)", expr)
        if m:
            op, args_str = m.group(1), m.group(2)
            args = split_args(args_str)
            if op not in SUPPORTED_OPS:
                raise ValueError(f"Unknown operator: {op}")
            
            # Recursively resolve arguments if they look like nested calls or columns
            resolved_args = []
            for a in args:
                if "$" in a or "(" in a:
                    resolved_args.append(resolve(a))
                else:
                    resolved_args.append(a) # literal values like '5'
            
            return SUPPORTED_OPS[op](*resolved_args)

        # Basic arithmetic using pandas eval (supporting +, -, *, /)
        # Note: replace $col with col for pandas.eval
        sanitized_expr = re.sub(r"\$(\w+)", r"\1", expr)
        try:
            return df.eval(sanitized_expr)
        except Exception as e:
            raise ValueError(f"Failed to eval arithmetic expression '{expr}': {e}")

    return resolve(formula)

def evaluate_factors(request: dict) -> dict:
    market_data = request.get("market_data", [])
    factors = request.get("factors", [])

    if not market_data:
        return {"status": "error", "message": "No market data provided"}

    # Convert to DataFrame: expect records with 'symbol', 'date', 'close', etc.
    df = pd.DataFrame(market_data)
    df["date"] = pd.to_datetime(df["date"])
    df.sort_values(["symbol", "date"], inplace=True)

    results = []
    for factor in factors:
        fid = factor["id"]
        formula = factor["formula"]
        try:
            scores_by_symbol = []
            # Calculate signal per symbol to avoid look-ahead or cross-contamination
            for symbol, group in df.groupby("symbol"):
                group = group.set_index("date")
                signal = eval_formula(formula, group).dropna()
                
                # Basic ic_proxy calculation: correlation with next day's return
                # return = close(t+1) / close(t) - 1
                forward_ret = group["close"].pct_change().shift(-1)
                
                for date, val in signal.items():
                    scores_by_symbol.append({
                        "symbol": symbol,
                        "date": str(date.date()),
                        "score": float(val)
                    })

            results.append({
                "id": fid,
                "status": "success",
                "scores": scores_by_symbol
            })
        except Exception as e:
            results.append({
                "id": fid,
                "status": "error",
                "message": str(e)
            })

    return {"status": "success", "results": results}

if __name__ == "__main__":
    try:
        raw_input = sys.stdin.read()
        if not raw_input:
            sys.exit(0)
        request_data = json.loads(raw_input)
        response = evaluate_factors(request_data)
        print(json.dumps(response))
    except Exception as e:
        print(json.dumps({"status": "error", "message": str(e)}))
