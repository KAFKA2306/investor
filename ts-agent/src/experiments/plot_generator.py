import json
import matplotlib.pyplot as plt
import numpy as np
import os

def generate_schema_driven_plot():
    json_path = 'data/standard_verification_data.json'
    if not os.path.exists(json_path):
        print(f"Error: {json_path} not found")
        return

    with open(json_path, 'r') as f:
        data = json.load(f)

    dates = data['dates']
    strat_name = data['strategyName']
    strat_id = data['strategyId']
    strat_desc = data['description']
    gen_at = data['generatedAt']
    
    strat_cum = data['strategyCum']
    bench_cum = data['benchmarkCum']
    indiv_data = data['individualData']
    m = data['metrics']
    ly = data['layout']

    fig = plt.figure(figsize=(16, 16))
    gs = fig.add_gridspec(4, 1, height_ratios=[2, 1, 1, 2], hspace=0.35)
    
    # Panel 1: Universe Spaghetti Plot
    ax0 = fig.add_subplot(gs[0])
    for symbol, s_data in indiv_data.items():
        ax0.plot(dates, s_data['prices'], label=symbol, alpha=0.7, linewidth=1.5)
    ax0.set_title(f"Panel 1: {ly['panel1Title']}", fontsize=14, fontweight='bold')
    ax0.set_ylabel('Price Index')
    ax0.grid(True, alpha=0.3)
    ax0.legend(loc='upper left', ncol=len(indiv_data))

    # Panel 2: Alpha Signal Intensity (Average)
    ax1 = fig.add_subplot(gs[1], sharex=ax0)
    all_factors = [s_data['factors'] for s_data in indiv_data.values()]
    avg_factors = np.mean(all_factors, axis=0)
    ax1.bar(dates, avg_factors, color='purple', alpha=0.5, label=f"Avg {strat_id}")
    ax1.set_title(f"Panel 2: {ly['panel2Title']}", fontsize=12)
    ax1.set_ylabel(ly['yAxisSignal'])
    ax1.grid(True, alpha=0.2)

    # Panel 3: Position Heatmap
    ax2 = fig.add_subplot(gs[2], sharex=ax0)
    all_positions = [s_data['positions'] for s_data in indiv_data.values()]
    pos_matrix = np.array(all_positions)
    im = ax2.imshow(pos_matrix, aspect='auto', cmap='RdYlGn', alpha=0.8)
    ax2.set_yticks(range(len(indiv_data)))
    ax2.set_yticklabels(list(indiv_data.keys()))
    ax2.set_title(f"Panel 3: {ly['panel3Title']}", fontsize=12)
    
    # Panel 4: Performance Proof vs Benchmark
    ax3 = fig.add_subplot(gs[3], sharex=ax0)
    ax3.plot(dates, strat_cum, color='green', linewidth=3, label=ly['legendStrategy'])
    ax3.plot(dates, bench_cum, color='black', linestyle='--', alpha=0.6, label=ly['legendBenchmark'])
    ax3.fill_between(dates, strat_cum, bench_cum, where=(np.array(strat_cum) >= np.array(bench_cum)), color='green', alpha=0.1)
    ax3.set_title(f"Panel 4: {ly['panel4Title']}", fontsize=14, fontweight='bold')
    ax3.set_ylabel(ly['yAxisReturn'])
    ax3.grid(True, alpha=0.3)
    ax3.legend(loc='upper left')

    # Metrics Passport Box
    textstr = '\n'.join((
        f"ALPHA PASSPORT",
        f"----------------",
        f"ID: {strat_id}",
        f"IC: {m['ic']:.4f}",
        f"Sharpe: {m['sharpe']}",
        f"MaxDD: {m['maxDD']}%",
        f"Return: {m['totalReturn']}%",
        f"Stocks: {len(indiv_data)}"
    ))
    props = dict(boxstyle='round', facecolor='wheat', alpha=0.5)
    ax3.text(0.02, 0.55, textstr, transform=ax3.transAxes, fontsize=11,
            verticalalignment='top', bbox=props, family='monospace')

    # Footer Metadata
    audit = data['audit']
    fig.text(0.1, 0.04, f"Description: {strat_desc}", fontsize=9, style='italic', wrap=True)
    fig.text(0.1, 0.02, f"Audit Trace: Commit {audit['commitHash'][:7]} | Env: {audit['environment']} | Schema: {data['schemaVersion']}", 
             fontsize=8, family='monospace', color='gray')
    fig.text(0.8, 0.02, f"Generated: {gen_at}", fontsize=8, family='monospace')

    # X-Axis Formatting
    n = len(dates)
    step = n // 10 if n > 10 else 1
    plt.xticks(dates[::step], rotation=45)
    plt.xlabel('Verification Period')

    plt.suptitle(ly['mainTitle'], fontsize=20, y=0.98, fontweight='bold')
    plt.figtext(0.5, 0.94, ly['subTitle'], ha='center', fontsize=12, color='gray')

    out_path = os.path.join('data', data['fileName'])
    plt.savefig(out_path, bbox_inches='tight', dpi=120)
    print(f"✅ Schema-driven standard verification plot saved to: {out_path}")

if __name__ == '__main__':
    generate_schema_driven_plot()
