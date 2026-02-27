import * as fs from "node:fs";
import { CqoAgent } from "../agents/cqo.ts";
import type { UnifiedLog } from "../schemas/log.ts";

async function criticizeMetagame() {
  console.log("🕵️ CQO: Starting Critical Review of Metagame Anomaly Audit...");

  const logPath = "/home/kafka/finance/investor/logs/unified/2026-02-27.json";

  if (!fs.existsSync(logPath)) {
    console.error("❌ Log file not found.");
    return;
  }

  const logContent = JSON.parse(
    fs.readFileSync(logPath, "utf-8"),
  ) as UnifiedLog;
  const outcome = logContent.report as Extract<
    UnifiedLog["report"],
    { strategyId: string }
  >;

  const cqo = new CqoAgent();
  const auditReport = cqo.auditStrategy(outcome);

  const markdown = cqo.generateAuditMarkdown(auditReport);

  console.log("\n--- CQO CRITICAL AUDIT REPORT ---");
  console.log(markdown);

  // Save the report
  const reportPath =
    "/home/kafka/finance/investor/docs/reports/metagame_cqo_audit_2026-02-27.md";
  fs.writeFileSync(reportPath, markdown);
  console.log(`\n📄 Report saved to: ${reportPath}`);
}

criticizeMetagame().catch(console.error);
