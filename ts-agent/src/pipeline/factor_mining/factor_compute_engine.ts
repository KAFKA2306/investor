import type { YahooBar } from "../../providers/external_market_providers";

export type FactorAST = {
    type: "variable" | "operator" | "constant";
    name?: string; // For variable or operator
    value?: number; // For constant
    left?: FactorAST;
    right?: FactorAST;
};

export class FactorComputeEngine {
    /**
     * Evaluates the factor AST for a single bar.
     */
    public static evaluate(ast: FactorAST, bar: YahooBar): number {
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
            const leftVal = ast.left ? this.evaluate(ast.left, bar) : 0;
            const rightVal = ast.right ? this.evaluate(ast.right, bar) : 0;

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
    public static computeSeries(ast: any, bars: YahooBar[]): number[] {
        // Cast to FactorAST for internal use
        const typedAST = ast as FactorAST;
        return bars.map((bar) => this.evaluate(typedAST, bar));
    }
}
