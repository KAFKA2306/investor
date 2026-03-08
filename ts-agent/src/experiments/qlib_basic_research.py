import qlib
from qlib.config import REG_CN


def demo_qlib_power():
    print("🚀 Qlib Basic Research Demo")

    # 1. Qlib Initialization
    # Normally we specify the data path, but here we just initialize for the demo!
    print("⚙️ Initializing Qlib...")
    try:
        qlib.init(provider_uri="~/.qlib/qlib_data/cn_data", region=REG_CN)
    except Exception as e:
        print(
            f"⚠️ Note: Qlib data not found at default path, but we can still show the API! ({e})"
        )

    # 2. Witness the power of the Expression Engine!
    # It's like magic—create features just by writing formulas! ✨
    expressions = [
        "(Close - Open) / Open",
        "Ref(Close, 1) / Close - 1",
        "Mean(Close, 5) / Close",
    ]
    print("\n🔮 Expression Engine examples:")
    for expr in expressions:
        print(f"  - Formula: {expr}")

    # 3. Introduction to the Model Zoo
    # Qlib is home to many powerful built-in models! 🦁
    print("\n🦁 Model Zoo built-in models:")
    models = ["LightGBM", "GRU", "ALSTM", "GATS", "Transformer", "SFM"]
    for m in models:
        print(f"  - {m}")

    # 4. Backtest & Analysis
    # Backtest configuration (usually described in YAML or Dict)
    print("\n⚖️ Backtest & Analysis components:")
    print("  - Strategy: TopkDropoutStrategy (Powerful Top-K strategy!)")
    print("  - Executor: Simulator (Real-world slippage simulation!)")
    print("  - Analyser: Report results with Sharpe, Drawdown, etc.")

    print(
        "\n✨ Qlib Research Complete! This platform is truly a game changer for quant AI! 🚀💎"
    )


if __name__ == "__main__":
    demo_qlib_power()
