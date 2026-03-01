import argparse
import json
import math
import os
import sqlite3
from collections import defaultdict
from datetime import datetime
from urllib.parse import parse_qs, urlparse

import matplotlib.pyplot as plt
import numpy as np


def parse_args():
    parser = argparse.ArgumentParser(
        description="Plot EDINET Risk-Delta x PEAD hybrid backtest with coverage/quality panels"
    )
    parser.add_argument(
        "--db-path",
        default="/home/kafka/finance/investor/logs/cache/alpha_knowledgebase.sqlite",
        help="Path to alpha_knowledgebase.sqlite",
    )
    parser.add_argument(
        "--top-k",
        type=int,
        default=1,
        help="Top-K for long and short legs",
    )
    parser.add_argument(
        "--min-signals-per-day",
        type=int,
        default=2,
        help="Minimum signals needed to trade a day",
    )
    parser.add_argument(
        "--trade-lag-days",
        type=int,
        default=2,
        help="Entry lag in trading days after signal date (e.g., 2 = trade from T+2 to T+3)",
    )
    parser.add_argument("--from-date", default=None, help="YYYY-MM-DD")
    parser.add_argument("--to-date", default=None, help="YYYY-MM-DD")
    parser.add_argument(
        "--cost-rate",
        type=float,
        default=0.00015,
        help="Total daily cost rate (fee + slippage)",
    )
    parser.add_argument(
        "--out-path",
        default="/home/kafka/finance/investor/ts-agent/data/KB_BACKTEST_EDINET_RISK_DELTA_PEAD_HYBRID.png",
        help="Output PNG path",
    )
    parser.add_argument(
        "--edinet-cache-db",
        default="/home/kafka/finance/investor/logs/cache/edinet_cache.sqlite",
        help="Path to edinet_cache.sqlite",
    )
    parser.add_argument(
        "--edinet-search-db",
        default="/home/kafka/finance/investor/logs/cache/edinet_search.sqlite",
        help="Path to edinet_search.sqlite",
    )
    parser.add_argument(
        "--edinet-docs-dir",
        default="/home/kafka/finance/investor/logs/cache/edinet_docs",
        help="Directory containing cached EDINET zip files",
    )
    return parser.parse_args()


def fetch_events(conn, from_date=None, to_date=None, trade_lag_days=2):
    lag = max(1, int(trade_lag_days))
    entry_offset = lag - 1
    exit_offset = lag
    query = """
      SELECT
        s.signal_id,
        s.symbol,
        s.date,
        s.combined_alpha,
        (
          (
            SELECT m_exit.close
            FROM market_daily m_exit
            WHERE m_exit.symbol = s.symbol AND m_exit.date > s.date
            ORDER BY m_exit.date ASC
            LIMIT 1 OFFSET ?
          ) / (
            SELECT m_entry.close
            FROM market_daily m_entry
            WHERE m_entry.symbol = s.symbol AND m_entry.date > s.date
            ORDER BY m_entry.date ASC
            LIMIT 1 OFFSET ?
          ) - 1
        ) AS next_return
      FROM signals s
      WHERE (? IS NULL OR s.date >= ?)
        AND (? IS NULL OR s.date <= ?)
      ORDER BY s.date ASC, s.symbol ASC
    """
    cur = conn.cursor()
    cur.execute(
        query, (exit_offset, entry_offset, from_date, from_date, to_date, to_date)
    )
    rows = cur.fetchall()
    events = []
    for signal_id, symbol, date, combined_alpha, next_return in rows:
        if combined_alpha is None or next_return is None:
            continue
        if not math.isfinite(combined_alpha) or not math.isfinite(next_return):
            continue
        events.append(
            {
                "signal_id": signal_id,
                "symbol": symbol,
                "date": date,
                "combined_alpha": float(combined_alpha),
                "next_return": float(next_return),
            }
        )
    return events


def build_daily_baskets(events, top_k, min_signals_per_day, cost_rate):
    grouped = defaultdict(list)
    for e in events:
        grouped[e["date"]].append(e)

    daily = []
    for date in sorted(grouped.keys()):
        rows = sorted(grouped[date], key=lambda x: x["combined_alpha"], reverse=True)
        if len(rows) < min_signals_per_day:
            continue
        long_leg = rows[: min(top_k, len(rows))]
        short_leg = list(reversed(rows))[: min(top_k, len(rows))]

        long_ret = float(np.mean([r["next_return"] for r in long_leg]))
        short_ret = float(np.mean([r["next_return"] for r in short_leg]))
        gross = long_ret - short_ret
        net = gross - cost_rate
        bench = float(np.mean([r["next_return"] for r in rows]))

        daily.append(
            {
                "date": date,
                "count": len(rows),
                "long_count": len(long_leg),
                "short_count": len(short_leg),
                "gross_return": gross,
                "net_return": net,
                "benchmark_return": bench,
            }
        )
    return daily


def calc_metrics(returns):
    if len(returns) == 0:
        return {
            "cumulative_return": 0.0,
            "sharpe": 0.0,
            "max_drawdown": 0.0,
            "win_rate": 0.0,
        }
    arr = np.array(returns, dtype=float)
    cum_curve = np.cumprod(1.0 + arr)
    cumulative_return = float(cum_curve[-1] - 1.0)
    vol = float(np.std(arr))
    sharpe = 0.0 if vol == 0 else float((np.mean(arr) / vol) * np.sqrt(252.0))
    running_peak = np.maximum.accumulate(cum_curve)
    drawdowns = cum_curve / running_peak - 1.0
    max_drawdown = float(np.min(drawdowns))
    win_rate = float(np.mean(arr > 0))
    return {
        "cumulative_return": cumulative_return,
        "sharpe": sharpe,
        "max_drawdown": max_drawdown,
        "win_rate": win_rate,
    }


def extract_symbol4(sec_code):
    sec = str(sec_code or "")
    if len(sec) < 4:
        return ""
    return sec[:4] if sec[:4].isdigit() else ""


def load_latest_doc_map_from_cache(edinet_cache_db):
    mapping = {}
    if not os.path.exists(edinet_cache_db):
        return mapping
    conn = sqlite3.connect(edinet_cache_db)
    cur = conn.cursor()
    cur.execute(
        """
        SELECT key, value
        FROM http_cache
        WHERE key LIKE '%documents.json%'
        """
    )
    for key_raw, value_raw in cur.fetchall():
        key_obj = json.loads(key_raw)
        url = key_obj.get("url", "")
        if "documents.json" not in url:
            continue
        query = parse_qs(urlparse(url).query)
        if query.get("type", [""])[0] != "2":
            continue
        payload = json.loads(value_raw)
        docs = payload.get("results", [])

        for doc in docs:
            symbol = extract_symbol4(doc.get("secCode"))
            submit_dt = str(doc.get("submitDateTime") or "")
            submit_date = submit_dt[:10]
            doc_id = str(doc.get("docID") or "")
            if not symbol or len(submit_date) != 10 or not doc_id:
                continue
            key = (symbol, submit_date)
            previous = mapping.get(key)
            if not previous or previous["submit_dt"] < submit_dt:
                mapping[key] = {"doc_id": doc_id, "submit_dt": submit_dt}
    conn.close()
    return {k: v["doc_id"] for k, v in mapping.items()}


def load_indexed_doc_ids(edinet_search_db):
    doc_ids = set()
    if not os.path.exists(edinet_search_db):
        return doc_ids
    conn = sqlite3.connect(edinet_search_db)
    cur = conn.cursor()
    cur.execute("SELECT docID FROM indexed_docs")
    for row in cur.fetchall():
        if row and row[0]:
            doc_ids.add(str(row[0]))
    conn.close()
    return doc_ids


def classify_events(events, args):
    doc_map = load_latest_doc_map_from_cache(args.edinet_cache_db)
    indexed_doc_ids = load_indexed_doc_ids(args.edinet_search_db)
    classified = []
    source_counts = defaultdict(int)

    for e in events:
        doc_id = doc_map.get((e["symbol"], e["date"]))
        if doc_id and doc_id in indexed_doc_ids:
            source = "indexed"
        elif doc_id and os.path.exists(
            os.path.join(args.edinet_docs_dir, f"{doc_id}_type1.zip")
        ):
            source = "xbrl"
        else:
            source = "metadata"
        source_counts[source] += 1
        copied = dict(e)
        copied["source_tier"] = source
        copied["doc_id"] = doc_id
        classified.append(copied)
    return classified, dict(source_counts)


def rolling_sharpe(returns, window=20):
    arr = np.array(returns, dtype=float)
    out = np.full(len(arr), np.nan, dtype=float)
    if len(arr) < window:
        return out
    for i in range(window - 1, len(arr)):
        w = arr[i - window + 1 : i + 1]
        vol = float(np.std(w))
        out[i] = 0.0 if vol == 0 else float((np.mean(w) / vol) * np.sqrt(252.0))
    return out


def month_key(date_str):
    return date_str[:7]


def make_plot(events, daily, args):
    plt.style.use("seaborn-v0_8-whitegrid")

    dates = [d["date"] for d in daily]
    x = np.arange(len(dates))
    net = np.array([d["net_return"] for d in daily], dtype=float)
    bench = np.array([d["benchmark_return"] for d in daily], dtype=float)
    strategy_curve = np.cumprod(1.0 + net) - 1.0
    strategy_equity = np.cumprod(1.0 + net)
    bench_curve = np.cumprod(1.0 + bench) - 1.0
    sharpe20 = rolling_sharpe(net, window=20)
    metrics = calc_metrics(net.tolist())
    running_peak = np.maximum.accumulate(strategy_equity)
    drawdown = (strategy_equity / running_peak - 1.0) * 100.0

    monthly_sources = defaultdict(lambda: {"metadata": 0, "indexed": 0, "xbrl": 0})
    signal_days_by_month = defaultdict(set)
    for e in events:
        m = month_key(e["date"])
        monthly_sources[m][e["source_tier"]] += 1
        signal_days_by_month[m].add(e["date"])

    tradable_days_by_month = defaultdict(int)
    for d in daily:
        tradable_days_by_month[month_key(d["date"])] += 1

    months = sorted(set(monthly_sources.keys()) | set(tradable_days_by_month.keys()))
    month_x = np.arange(len(months))
    metadata_counts = np.array([monthly_sources[m]["metadata"] for m in months], dtype=float)
    indexed_counts = np.array([monthly_sources[m]["indexed"] for m in months], dtype=float)
    xbrl_counts = np.array([monthly_sources[m]["xbrl"] for m in months], dtype=float)
    tradable_days = np.array([tradable_days_by_month.get(m, 0) for m in months], dtype=float)
    signal_days = np.array([len(signal_days_by_month.get(m, set())) for m in months], dtype=float)
    with np.errstate(divide="ignore", invalid="ignore"):
        tradable_ratio = np.where(signal_days > 0, tradable_days / signal_days * 100.0, 0.0)

    fig = plt.figure(figsize=(16, 10))
    gs = fig.add_gridspec(2, 2, hspace=0.33, wspace=0.20)

    ax1 = fig.add_subplot(gs[0, 0])
    ax1.bar(month_x, metadata_counts, label="Metadata", color="#7f8c8d", alpha=0.9)
    ax1.bar(
        month_x,
        indexed_counts,
        bottom=metadata_counts,
        label="Indexed",
        color="#2e86c1",
        alpha=0.9,
    )
    ax1.bar(
        month_x,
        xbrl_counts,
        bottom=metadata_counts + indexed_counts,
        label="XBRL",
        color="#27ae60",
        alpha=0.9,
    )
    ax1.set_title("Monthly Signal Count by Source Tier")
    ax1.set_ylabel("Signals")
    ax1.legend(loc="upper left")
    if len(months) > 0:
        step = max(1, len(months) // 10)
        ticks = month_x[::step]
        ax1.set_xticks(ticks)
        ax1.set_xticklabels([months[i] for i in ticks], rotation=45, ha="right")

    ax2 = fig.add_subplot(gs[0, 1])
    ax2.plot(month_x, tradable_ratio, color="#c0392b", linewidth=2.2, marker="o", label="Tradable ratio (%)")
    ax2.set_ylabel("Tradable Day Ratio (%)")
    ax2.set_ylim(0, max(100, float(np.nanmax(tradable_ratio) + 5)) if len(tradable_ratio) else 100)
    ax2.set_title("Monthly Tradable-Day Ratio")
    ax2b = ax2.twinx()
    ax2b.bar(month_x, tradable_days, color="#95a5a6", alpha=0.35, label="Tradable days")
    ax2b.set_ylabel("Tradable Days")
    h1, l1 = ax2.get_legend_handles_labels()
    h2, l2 = ax2b.get_legend_handles_labels()
    ax2.legend(h1 + h2, l1 + l2, loc="upper left")
    if len(months) > 0:
        step = max(1, len(months) // 10)
        ticks = month_x[::step]
        ax2.set_xticks(ticks)
        ax2.set_xticklabels([months[i] for i in ticks], rotation=45, ha="right")

    ax3 = fig.add_subplot(gs[1, 0])
    ax3.plot(x, strategy_curve * 100, linewidth=2.3, color="#1b9e77", label="Cumulative return (%)")
    ax3.plot(x, bench_curve * 100, linewidth=1.3, linestyle="--", color="#4d4d4d", alpha=0.8, label="Cross-section mean (%)")
    ax3.set_ylabel("Cumulative Return (%)")
    ax3.set_title("Performance: CumRet + 20d Rolling Sharpe")
    ax3b = ax3.twinx()
    ax3b.plot(x, sharpe20, linewidth=1.8, color="#8e44ad", alpha=0.85, label="Rolling Sharpe (20d)")
    ax3b.axhline(0, color="#8e44ad", linewidth=1, alpha=0.3)
    ax3b.set_ylabel("Sharpe (20d)")
    h1, l1 = ax3.get_legend_handles_labels()
    h2, l2 = ax3b.get_legend_handles_labels()
    ax3.legend(h1 + h2, l1 + l2, loc="upper left")
    if len(dates) > 0:
        step = max(1, len(dates) // 10)
        ticks = x[::step]
        ax3.set_xticks(ticks)
        ax3.set_xticklabels([dates[i] for i in ticks], rotation=45, ha="right")

    ax4 = fig.add_subplot(gs[1, 1])
    ax4.plot(x, drawdown, color="#c0392b", linewidth=2.0, label="Drawdown (%)")
    ax4.fill_between(x, drawdown, 0, where=drawdown <= 0, color="#e74c3c", alpha=0.25)
    ax4.axhline(0, color="#666", linewidth=1)
    ax4.set_title("Underwater Curve (Drawdown)")
    ax4.set_xlabel("Date")
    ax4.set_ylabel("Drawdown (%)")
    textbox = "\n".join(
        [
            f"Days: {len(daily)}",
            f"Sharpe: {metrics['sharpe']:.3f}",
            f"CumRet: {metrics['cumulative_return']*100:.2f}%",
            f"WinRate: {metrics['win_rate']*100:.1f}%",
            f"MaxDD: {metrics['max_drawdown']*100:.2f}%",
            f"TopK={args.top_k} MinSig/day={args.min_signals_per_day}",
            f"TradeLag={args.trade_lag_days}d",
        ]
    )
    ax4.text(
        0.03,
        0.97,
        textbox,
        transform=ax4.transAxes,
        va="top",
        ha="left",
        fontsize=9,
        family="monospace",
        bbox={"boxstyle": "round", "facecolor": "#f8f8f8", "alpha": 0.85},
    )
    if len(dates) > 0:
        step = max(1, len(dates) // 10)
        ticks = x[::step]
        ax4.set_xticks(ticks)
        ax4.set_xticklabels([dates[i] for i in ticks], rotation=45, ha="right")
    ax4.legend(loc="lower left")

    from_s = args.from_date if args.from_date else "start"
    to_s = args.to_date if args.to_date else "end"
    fig.suptitle(
        f"EDINET Risk-Delta x PEAD Hybrid | Backtest window: {from_s} to {to_s}",
        y=0.995,
        fontsize=11,
        color="#2f2f2f",
    )

    out_dir = os.path.dirname(args.out_path)
    if out_dir:
        os.makedirs(out_dir, exist_ok=True)
    plt.savefig(args.out_path, dpi=140, bbox_inches="tight")
    print(f"✅ Plot saved: {args.out_path}")


def main():
    args = parse_args()
    conn = sqlite3.connect(args.db_path)
    events = fetch_events(
        conn, args.from_date, args.to_date, args.trade_lag_days
    )
    conn.close()

    if len(events) == 0:
        raise SystemExit("No valid events found for plotting.")

    events, source_counts = classify_events(events, args)
    daily = build_daily_baskets(
        events,
        top_k=args.top_k,
        min_signals_per_day=args.min_signals_per_day,
        cost_rate=args.cost_rate,
    )
    if len(daily) == 0:
        raise SystemExit("No tradable daily baskets found for plotting.")

    make_plot(events, daily, args)
    print(
        f"ℹ️ Generated at {datetime.utcnow().isoformat(timespec='seconds')}Z "
        f"(events={len(events)}, tradable_days={len(daily)}, "
        f"metadata={source_counts.get('metadata', 0)}, "
        f"indexed={source_counts.get('indexed', 0)}, "
        f"xbrl={source_counts.get('xbrl', 0)}, "
        f"trade_lag_days={max(1, int(args.trade_lag_days))})"
    )


if __name__ == "__main__":
    main()
