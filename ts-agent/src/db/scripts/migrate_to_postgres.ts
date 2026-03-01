import { join } from "node:path";
import { core } from "../../system/app_runtime_core.ts";
import { logger } from "../../utils/logger.ts";
import { migrateSqliteToCanonical } from "../adapters/sqlite_to_postgres.ts";
import { bootstrapCanonicalDb } from "../bootstrap.ts";

/**
 * 🚚✨ SQLiteからPostgresへのお引っ越し大作戦！
 */
async function run() {
  logger.info("🚚 お引っ越し大作戦、はじめるよっ！💖");

  const pg = await bootstrapCanonicalDb();
  if (!pg) {
    logger.error(
      "Postgresくんに繋がらないよ…設定（default.yaml）を確認してみてねっ💢",
    );
    process.exit(1);
  }

  // 設定からSQLiteのパスを持ってくるよっ！🎀
  const paths = {
    knowledgebasePath:
      core.config.paths.cacheMarketdataSqlite ||
      join(process.cwd(), "..", "..", "logs", "cache", "marketdata.sqlite"),
    memoryPath:
      core.config.paths.cacheUqtlSqlite ||
      join(process.cwd(), "..", "..", "logs", "cache", "uqtl.sqlite"),
  };

  logger.info(
    `🔍 SQLiteを探してるよ：\n KB: ${paths.knowledgebasePath}\n Memory: ${paths.memoryPath}`,
  );

  try {
    const result = await migrateSqliteToCanonical(pg, paths);
    logger.info(
      `✨ お引っ越し完了！ 🎉\n ・シグナル: ${result.migratedSignals}件\n ・イベント: ${result.migratedEvents}件`,
    );
    logger.info("これでPostgresくんもハッピーだねっ！💎💖");
  } catch (err) {
    logger.error(
      `えぇ〜っ！お引っ越し中にトラブル発生だよっ💢: ${String(err)}`,
    );
    process.exit(1);
  } finally {
    await pg.close();
  }
}

run();
