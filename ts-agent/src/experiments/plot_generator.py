import base64
import json
import os

try:
    import matplotlib.pyplot as plt
    import numpy as np

    HAS_PLOT_DEPS = True
except Exception:
    plt = None
    np = None
    HAS_PLOT_DEPS = False

PLACEHOLDER_PNG_BASE64 = (
    "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8"
    "/x8AAusB9oN2wQAAAABJRU5ErkJggg=="
)


def compute_rolling_ic(individual_data: dict, dates: list, window: int = 30) -> list:
    """Cross-sectional IC per date, then 30-day rolling mean."""
    symbols = list(individual_data.keys())
    n = len(dates)
    daily_ic = []
    for t in range(n - 1):
        factors_t = [individual_data[s]["factors"][t] for s in symbols]
        prices_t = [individual_data[s]["prices"][t] for s in symbols]
        prices_t1 = [individual_data[s]["prices"][t + 1] for s in symbols]
        returns_t1 = [
            (p1 - p0) / p0 if p0 > 0 else 0.0
            for p0, p1 in zip(prices_t, prices_t1)
        ]
        f = np.array(factors_t, dtype=float)
        r = np.array(returns_t1, dtype=float)
        if f.std() < 1e-12 or r.std() < 1e-12:
            daily_ic.append(0.0)
        else:
            daily_ic.append(float(np.corrcoef(f, r)[0, 1]))
    # Append 0 for last date (no forward return)
    daily_ic.append(0.0)

    rolling_ic = []
    for i in range(n):
        start = max(0, i - window + 1)
        rolling_ic.append(float(np.mean(daily_ic[start : i + 1])))
    return rolling_ic


def compute_drawdown(strat_cum: list) -> list:
    """Drawdown series from cumulative return (in %)."""
    dd = []
    peak = strat_cum[0] if strat_cum else 0.0
    for v in strat_cum:
        if v > peak:
            peak = v
        dd.append(v - peak)
    return dd


def generate_schema_driven_plot():
    verification_dir = os.environ.get("VERIFICATION_DIR", "data")
    json_path = os.path.join(verification_dir, "standard_verification_data.json")
    if not os.path.exists(json_path):
        raise FileNotFoundError(f"Verification data not found: {json_path}")

    with open(json_path, "r") as f:
        data = json.load(f)

    if not HAS_PLOT_DEPS:
        out_path = os.path.join(verification_dir, data["fileName"])
        with open(out_path, "wb") as fp:
            fp.write(base64.b64decode(PLACEHOLDER_PNG_BASE64))
        print(
            "⚠️ matplotlib/numpy が未インストールのため、"
            f"プレースホルダ画像を出力しました: {out_path}"
        )
        return

    dates = data["dates"]
    strat_name = data["strategyName"]
    strat_id = data["strategyId"]
    strat_desc = data["description"]
    gen_at = data["generatedAt"]

    strat_cum = data["strategyCum"]
    bench_cum = data["benchmarkCum"]
    indiv_data = data["individualData"]
    m = data["metrics"]
    ly = data["layout"]

    rolling_ic = compute_rolling_ic(indiv_data, dates, window=30)
    drawdown = compute_drawdown(strat_cum)

    fig = plt.figure(figsize=(16, 16))
    gs = fig.add_gridspec(4, 1, height_ratios=[2, 1, 1, 2], hspace=0.35)

    # Panel 1: Universe Spaghetti Plot
    ax0 = fig.add_subplot(gs[0])
    for symbol, s_data in indiv_data.items():
        ax0.plot(dates, s_data["prices"], label=symbol, alpha=0.7, linewidth=1.5)
    ax0.set_title(f"Panel 1: {ly['panel1Title']}", fontsize=14, fontweight="bold")
    ax0.set_ylabel("Price Index")
    ax0.grid(True, alpha=0.3)
    ax0.legend(loc="upper left", ncol=len(indiv_data))

    # Panel 2: Rolling IC (30-day window)
    ax1 = fig.add_subplot(gs[1], sharex=ax0)
    ic_arr = np.array(rolling_ic)
    ax1.plot(dates, ic_arr, color="purple", linewidth=1.5, label="Rolling IC (30d)")
    ax1.axhline(0, color="gray", linewidth=0.8, linestyle="--")
    ax1.fill_between(
        dates, ic_arr, 0,
        where=(ic_arr >= 0), color="purple", alpha=0.15,
    )
    ax1.fill_between(
        dates, ic_arr, 0,
        where=(ic_arr < 0), color="red", alpha=0.15,
    )
    ax1.set_title(f"Panel 2: {ly['panel2Title']}", fontsize=12)
    ax1.set_ylabel("IC")
    ax1.grid(True, alpha=0.2)
    ax1.legend(loc="upper right", fontsize=9)

    # Panel 3: Drawdown Chart
    ax2 = fig.add_subplot(gs[2], sharex=ax0)
    dd_arr = np.array(drawdown)
    ax2.fill_between(dates, dd_arr, 0, color="red", alpha=0.4, label="Drawdown")
    ax2.plot(dates, dd_arr, color="darkred", linewidth=1.0)
    ax2.set_title(f"Panel 3: {ly['panel3Title']}", fontsize=12)
    ax2.set_ylabel("Drawdown (%)")
    ax2.grid(True, alpha=0.2)
    ax2.legend(loc="lower left", fontsize=9)

    # Panel 4: Performance Proof vs Benchmark
    ax3 = fig.add_subplot(gs[3], sharex=ax0)
    ax3.plot(
        dates, strat_cum, color="green", linewidth=3, label=ly["legendStrategy"]
    )
    ax3.plot(
        dates, bench_cum,
        color="black", linestyle="--", alpha=0.6, label=ly["legendBenchmark"],
    )
    ax3.fill_between(
        dates, strat_cum, bench_cum,
        where=(np.array(strat_cum) >= np.array(bench_cum)),
        color="green", alpha=0.1,
    )
    ax3.set_title(f"Panel 4: {ly['panel4Title']}", fontsize=14, fontweight="bold")
    ax3.set_ylabel(ly["yAxisReturn"])
    ax3.grid(True, alpha=0.3)
    ax3.legend(loc="upper left")

    # Metrics Passport Box
    win_rate = m.get("winRate")
    volatility = m.get("volatility")
    cagr = m.get("cagr")
    passport_lines = [
        "ALPHA PASSPORT",
        "----------------",
        f"ID: {strat_id}",
        f"IC: {m['ic']:.4f}",
        f"Sharpe: {m['sharpe']}",
        f"MaxDD: {m['maxDD']}%",
        f"Return: {m['totalReturn']}%",
    ]
    if win_rate is not None:
        passport_lines.append(f"WinRate: {win_rate:.1%}")
    if volatility is not None:
        passport_lines.append(f"Vol: {volatility:.2%}")
    if cagr is not None:
        passport_lines.append(f"CAGR: {cagr:.2%}")
    passport_lines.append(f"Stocks: {len(indiv_data)}")
    textstr = "\n".join(passport_lines)
    props = dict(boxstyle="round", facecolor="wheat", alpha=0.5)
    ax3.text(
        0.02, 0.98, textstr,
        transform=ax3.transAxes, fontsize=10,
        verticalalignment="top", bbox=props, family="monospace",
    )

    # Footer Metadata
    audit = data["audit"]
    fig.text(0.1, 0.04, f"Description: {strat_desc}", fontsize=9, style="italic", wrap=True)
    fig.text(
        0.1, 0.02,
        f"Audit Trace: Commit {audit['commitHash'][:7]} | Env: {audit['environment']} | Schema: {data['schemaVersion']}",
        fontsize=8, family="monospace", color="gray",
    )
    fig.text(0.8, 0.02, f"Generated: {gen_at}", fontsize=8, family="monospace")

    # X-Axis Formatting
    n = len(dates)
    step = n // 10 if n > 10 else 1
    plt.xticks(dates[::step], rotation=45)
    plt.xlabel("Verification Period")

    plt.suptitle(ly["mainTitle"], fontsize=20, y=0.98, fontweight="bold")
    plt.figtext(0.5, 0.94, ly["subTitle"], ha="center", fontsize=12, color="gray")

    out_path = os.path.join(verification_dir, data["fileName"])
    plt.savefig(out_path, bbox_inches="tight", dpi=120)
    print(f"✅ Schema-driven standard verification plot saved to: {out_path}")


if __name__ == "__main__":
    generate_schema_driven_plot()
