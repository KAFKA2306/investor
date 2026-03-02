import { join } from "node:path";
import { paths as pathRegistry } from "../../system/path_registry.ts";
import { logger } from "../../utils/logger.ts";
import { migrateSqliteToCanonical } from "../adapters/sqlite_to_postgres.ts";
import { bootstrapCanonicalDb } from "../bootstrap.ts";

async function run() {
  logger.info("[canonical-migrate] migration started");

  const pg = await bootstrapCanonicalDb();
  if (!pg) {
    logger.error(
      "[canonical-migrate] canonical DB not enabled. Set database.canonicalDb.enabled=true first.",
    );
    process.exit(1);
  }

  const sqlitePaths = {
    knowledgebasePath: join(
      pathRegistry.logsRoot,
      "cache",
      "alpha_knowledgebase.sqlite",
    ),
    memoryPath: join(pathRegistry.logsRoot, "memory.sqlite"),
  };

  logger.info(
    `[canonical-migrate] source sqlite files\nknowledgebase=${sqlitePaths.knowledgebasePath}\nmemory=${sqlitePaths.memoryPath}`,
  );

  try {
    const result = await migrateSqliteToCanonical(pg, sqlitePaths);
    logger.info(
      `[canonical-migrate] completed\nsignals=${result.migratedSignals}\nevents=${result.migratedEvents}`,
    );
  } catch (err) {
    logger.error(`[canonical-migrate] failed: ${String(err)}`);
    process.exit(1);
  } finally {
    await pg.close();
  }
}

run();
