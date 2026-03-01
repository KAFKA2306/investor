import { resolve } from "node:path";
import { AlphaKnowledgebase } from "../context/alpha_knowledgebase.ts";

const pickArg = (args: readonly string[], key: string): string | undefined => {
  const prefix = `${key}=`;
  const matched = args.find((value) => value.startsWith(prefix));
  return matched ? matched.slice(prefix.length) : undefined;
};

const main = (): void => {
  const args = process.argv.slice(2);
  const signalId = pickArg(args, "--signal-id");
  const dbPath = pickArg(args, "--db-path");

  if (!signalId) {
    console.error(
      "Usage: bun src/experiments/audit_signal_trace.ts --signal-id=<signal_id> [--db-path=<sqlite_path>]",
    );
    process.exit(1);
  }

  const kb = new AlphaKnowledgebase(dbPath ? resolve(dbPath) : undefined);
  try {
    const trace = kb.getSignalAuditTrace(signalId);
    if (trace.signal === null) {
      console.error(`Signal not found: ${signalId}`);
      process.exit(2);
    }
    console.log(JSON.stringify(trace, null, 2));
  } finally {
    kb.close();
  }
};

main();
