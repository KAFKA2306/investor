import { z } from "zod";

export const Numeric = z
  .union([z.number(), z.string()])
  .transform((v) => Number(v))
  .pipe(z.number().finite())
  .catch(0);

export const SymbolAnalysisSchema = z.object({
  symbol: z.string().length(4),
  ohlc6: z.object({
    open: z.number(),
    high: z.number(),
    low: z.number(),
    close: z.number(),
    volume: z.number(),
    turnoverValue: z.number(),
  }),
  finance: z.object({
    netSales: z.number(),
    operatingProfit: z.number(),
    profitMargin: z.number(),
  }),
  factors: z.object({
    dailyReturn: z.number(),
    intradayRange: z.number(),
    closeStrength: z.number(),
    liquidityPerShare: z.number(),
  }),
  alphaScore: z.number(),
  signal: z.enum(["LONG", "HOLD"]),
});

export type SymbolAnalysis = z.infer<typeof SymbolAnalysisSchema>;

export const getNumberByKeys = (
  row: Record<string, unknown>,
  keys: readonly string[],
): number =>
  Numeric.parse(keys.map((k) => row[k]).find((v) => v !== undefined));

export const average = (xs: number[]): number =>
  xs.reduce((a, b) => a + b, 0) / Math.max(1, xs.length);
export const clamp01 = (v: number): number => Math.max(0, Math.min(1, v));

export const extractEstatValues = (root: unknown): number[] => {
  const walk = (node: unknown): number[] =>
    Array.isArray(node)
      ? node.flatMap((v) => walk(v))
      : typeof node === "object" && node !== null
        ? Object.values(node as Record<string, unknown>).flatMap((v) => walk(v))
        : typeof node === "string" || typeof node === "number"
          ? [Number(node)]
          : [];
  return walk(root).filter((n) => Number.isFinite(n) && Math.abs(n) > 0);
};

export const scoreDailyAlpha = (
  symbol: string,
  bar: Record<string, unknown>,
  fin: Record<string, unknown>,
  macroMomentum: number,
): SymbolAnalysis => {
  const open = getNumberByKeys(bar, ["Open", "open_price", "open", "O"]);
  const high = getNumberByKeys(bar, ["High", "high_price", "high", "H"]);
  const low = getNumberByKeys(bar, ["Low", "low_price", "low", "L"]);
  const close = getNumberByKeys(bar, ["Close", "close_price", "close", "C"]);
  const volume = getNumberByKeys(bar, ["Volume", "volume", "Vo", "AdjVo"]);
  const turnoverValue = getNumberByKeys(bar, [
    "TurnoverValue",
    "turnover_value",
    "turnover",
    "Va",
  ]);
  const netSales = getNumberByKeys(fin, [
    "NetSales",
    "NetSalesForecast",
    "net_sales",
    "NetSales3Months",
    "Sales",
  ]);
  const operatingProfit = getNumberByKeys(fin, [
    "OperatingProfit",
    "OperatingProfitForecast",
    "operating_profit",
    "OperatingProfit3Months",
    "OP",
  ]);

  const eps = 1e-9;
  const dailyReturn = (close - open) / Math.max(Math.abs(open), eps);
  const intradayRange = (high - low) / Math.max(Math.abs(open), eps);
  const closeStrength = (close - low) / Math.max(high - low, eps);
  const liquidityPerShare = turnoverValue / Math.max(volume, eps);
  const profitMargin = operatingProfit / Math.max(Math.abs(netSales), eps);
  const alphaScore =
    0.4 * macroMomentum +
    0.2 * dailyReturn +
    0.15 * intradayRange +
    0.15 * profitMargin +
    0.1 * clamp01(closeStrength);

  return SymbolAnalysisSchema.parse({
    symbol,
    ohlc6: { open, high, low, close, volume, turnoverValue },
    finance: { netSales, operatingProfit, profitMargin },
    factors: { dailyReturn, intradayRange, closeStrength, liquidityPerShare },
    alphaScore,
    signal: alphaScore > 0 ? "LONG" : "HOLD",
  });
};
