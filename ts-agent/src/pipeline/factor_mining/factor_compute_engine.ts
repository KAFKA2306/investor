import type { YahooBar } from "../../providers/external_market_providers";

export type FactorAST = {
  type: "variable" | "operator" | "constant";
  name?: string;
  value?: number;
  left?: FactorAST;
  right?: FactorAST;
};

export function evaluateFactor(
  ast: FactorAST,
  bars: YahooBar[],
  index: number,
): number {
  if (ast.type === "constant") {
    return ast.value ?? 0;
  }

  const currentBar = bars[index];
  if (!currentBar) return 0;

  if (ast.type === "variable") {
    switch (ast.name?.toLowerCase()) {
      case "close":
        return currentBar.Close;
      case "open":
        return currentBar.Open;
      case "high":
        return currentBar.High;
      case "low":
        return currentBar.Low;
      case "volume":
        return currentBar.Volume;
      case "correction_freq":
        return currentBar.CorrectionCount ?? 0;
      case "activist_bias":
        return currentBar.LargeHolderCount ?? 0;
      case "macro_iip":
        return currentBar.MacroIIP ?? 0;
      case "macro_cpi":
        return currentBar.MacroCPI ?? 0;
      case "segment_sentiment":
        return currentBar.SegmentSentiment ?? 0;
      case "ai_exposure":
        return currentBar.AiExposure ?? 0;
      case "kg_centrality":
        return currentBar.KgCentrality ?? 0;
      default:
        return 0;
    }
  }

  if (ast.type === "operator") {
    const opName = ast.name?.toUpperCase();

    if (opName === "LAG") {
      const lag = ast.right?.type === "constant" ? (ast.right.value ?? 1) : 1;
      const targetIndex = index - lag;
      if (targetIndex < 0 || !ast.left) return 0;
      return evaluateFactor(ast.left, bars, targetIndex);
    }

    if (opName === "SMA") {
      const window =
        ast.right?.type === "constant" ? (ast.right.value ?? 5) : 5;
      if (!ast.left || index < window - 1) return 0;
      let sum = 0;
      for (let i = 0; i < window; i++) {
        sum += evaluateFactor(ast.left, bars, index - i);
      }
      return sum / window;
    }

    const leftVal = ast.left ? evaluateFactor(ast.left, bars, index) : 0;
    const rightVal = ast.right ? evaluateFactor(ast.right, bars, index) : 0;

    switch (opName) {
      case "ADD":
        return leftVal + rightVal;
      case "SUB":
        return leftVal - rightVal;
      case "MUL":
        return leftVal * rightVal;
      case "DIV":
        return rightVal !== 0 ? leftVal / rightVal : 0;
      default:
        return 0;
    }
  }

  return 0;
}

export function computeFactorSeries(
  ast: FactorAST,
  bars: YahooBar[],
): number[] {
  return bars.map((_, i) => evaluateFactor(ast, bars, i));
}

export const FactorComputeEngine = {
  evaluate: evaluateFactor,
  computeSeries: computeFactorSeries,
};
