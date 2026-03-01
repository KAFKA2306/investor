import { mkdirSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { AlphaKnowledgebase } from "../context/alpha_knowledgebase.ts";
import {
  getNumberArg,
  getStringArg,
  parseCliArgs,
} from "../providers/cli_args.ts";
import { toSymbol4 } from "../providers/value_normalizers.ts";
import { paths } from "../system/path_registry.ts";

type CliArgs = {
  missionId: string;
  generations: number;
  populationSize: number;
  dbPath?: string;
  symbols: string[];
};

const parseArgs = (): CliArgs => {
  const args = parseCliArgs(process.argv.slice(2));
  const missionId =
    getStringArg(args, "--mission-id") ?? `mining-${Date.now()}`;
  const generations = Math.max(1, getNumberArg(args, "--generations", 5));
  const populationSize = Math.max(
    1,
    getNumberArg(args, "--population-size", 20),
  );
  const rawSymbols = getStringArg(args, "--symbols");
  const symbols = rawSymbols
    ? rawSymbols
        .split(",")
        .map((s) => toSymbol4(s))
        .filter((s) => /^\d{4}$/.test(s))
    : [];
  const dbPathArg = getStringArg(args, "--db-path");
  return {
    missionId,
    generations,
    populationSize,
    symbols,
    ...(dbPathArg ? { dbPath: resolve(dbPathArg) } : {}),
  };
};

async function run(): Promise<void> {
  const args = parseArgs();
  console.log(
    `🧬 Alpha Mining Experiment: mission=${args.missionId}, gens=${args.generations}, pop=${args.populationSize}`,
  );

  const kb = new AlphaKnowledgebase(args.dbPath);
  const counts = kb.getCounts();
  kb.close();

  const report = {
    experiment: {
      missionId: args.missionId,
      status: "STUB",
      setup: {
        generations: args.generations,
        populationSize: args.populationSize,
        targetSymbols: args.symbols.length > 0 ? args.symbols.length : "AUTO",
      },
      knowledgebase: {
        dbPath: args.dbPath ?? "logs/cache/alpha_knowledgebase.sqlite",
        counts,
      },
      message:
        "This is a refactored stub for alpha mining experiments using the common providers.",
    },
  };

  const outputDir = join(paths.logsRoot, "experiments", args.missionId);
  mkdirSync(outputDir, { recursive: true });
  writeFileSync(
    join(outputDir, "report.json"),
    JSON.stringify(report, null, 2),
  );

  console.log(JSON.stringify(report, null, 2));
}

if (import.meta.main) {
  run().catch((e) => {
    console.error(e);
    process.exit(1);
  });
}
