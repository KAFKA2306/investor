import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { EstatProvider } from "../providers/external_market_providers.ts";

/**
 * Macro Indicator Feature Generator
 * Fetches IIP and CPI from e-Stat and saves them for backtesting.
 */
async function main() {
  const estat = new EstatProvider();
  const outPath = join(process.cwd(), "data", "macro_indicators_map.json");

  // e-Stat IDs (Monthly Indices, 2020 Base)
  const IIP_ID = "0003435161"; // Production Indices
  const CPI_ID = "0003427107"; // Consumer Price Index

  interface EstatValue {
    "@time": string;
    $: string;
  }

  interface EstatResponse {
    GET_STATS_DATA?: {
      STATISTICAL_DATA?: {
        DATA_INF?: {
          VALUE?: EstatValue[];
        };
      };
    };
  }

  const macroMap: Record<string, Record<string, number>> = existsSync(outPath)
    ? JSON.parse(readFileSync(outPath, "utf8"))
    : {};

  console.log("🚀 Fetching Macro Data from e-Stat...");

  try {
    const iipData = (await estat.getStats(IIP_ID)) as EstatResponse;
    console.log("✅ Fetched IIP data.");

    const cpiData = (await estat.getStats(CPI_ID)) as EstatResponse;
    console.log("✅ Fetched CPI data.");

    // Parse Logic for e-Stat JSON structure (simplified)
    // Note: Real e-Stat JSON is deeply nested in VALUE array.
    const extractValues = (data: EstatResponse, key: string) => {
      const values =
        data.GET_STATS_DATA?.STATISTICAL_DATA?.DATA_INF?.VALUE || [];
      for (const v of values) {
        // Time code format: 2021000101 (Monthly)
        const timeCode = v["@time"];
        if (typeof timeCode === "string" && timeCode.length >= 6) {
          const year = timeCode.slice(0, 4);
          const month = timeCode.slice(4, 6);
          const date = `${year}-${month}-01`; // Store as 1st of month
          if (!macroMap[date]) macroMap[date] = {};
          macroMap[date][key] = Number(v.$) || 0;
        }
      }
    };

    extractValues(iipData, "MacroIIP");
    extractValues(cpiData, "MacroCPI");

    writeFileSync(outPath, JSON.stringify(macroMap, null, 2));
    console.log(`\n🎉 Macro features saved to ${outPath}`);
  } catch (e) {
    console.error("❌ Failed to fetch macro data:", e);
  }
}

main().catch(console.error);
