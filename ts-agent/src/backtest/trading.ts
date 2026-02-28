export type PaperExecutionInput = {
  decision: {
    action: "LONG_BASKET" | "NO_TRADE";
  };
  results: {
    selectedSymbols: readonly string[];
  };
  analysis: readonly {
    symbol: string;
    ohlc6: {
      close: number;
    };
  }[];
};

export type BacktestInputRow = {
  targetReturn?: number | null | undefined;
};
