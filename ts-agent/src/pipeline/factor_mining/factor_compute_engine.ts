import type { YahooBar } from "../../providers/external_market_providers";

export type FactorAST = {
  type: "variable" | "operator" | "constant";
  name?: string; // For variable or operator
  value?: number; // For constant
  left?: FactorAST;
  right?: FactorAST;
};

/**
 * Evaluates the factor AST for a single bar.
 */
export function evaluateFactor(ast: FactorAST, bar: YahooBar): number {
  if (ast.type === "constant") {
    return ast.value ?? 0;
  }

  if (ast.type === "variable") {
    switch (ast.name?.toLowerCase()) {
      case "close":
        return bar.Close;
      case "open":
        return bar.Open;
      case "high":
        return bar.High;
      case "low":
        return bar.Low;
      case "volume":
        return bar.Volume;
      default:
        return 0;
    }
  }

  if (ast.type === "operator") {
    const leftVal = ast.left ? evaluateFactor(ast.left, bar) : 0;
    const rightVal = ast.right ? evaluateFactor(ast.right, bar) : 0;

    switch (ast.name?.toUpperCase()) {
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

/**
 * Computes factor values for a series of bars.
 */
export function computeFactorSeries(
  ast: FactorAST,
  bars: YahooBar[],
): number[] {
  return bars.map((bar) => evaluateFactor(ast, bar));
}

export const FactorComputeEngine = {
  evaluate: evaluateFactor,
  computeSeries: computeFactorSeries,
};
