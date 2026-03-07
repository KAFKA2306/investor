from src.io.reader import LogReader
from src.domain.allocation import Allocator


def main():
    reader = LogReader("config/default.yaml")
    allocator = Allocator()

    request = reader.read_latest_ideas()
    results = allocator.allocate(request)

    print("\n" + "=" * 50)
    print("💎 PYTHON PORTFOLIO ALLOCATION 💎")
    print("=" * 50)
    for r in results:
        print(f"{r.ticker:15} | Weight: {r.weight:6.2%} | Amount: ${r.amount:10,.2f}")
    print("=" * 50 + "\n")


if __name__ == "__main__":
    main()
