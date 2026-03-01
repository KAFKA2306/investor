import { logger } from "../../utils/logger.ts";
import { bootstrapCanonicalDb } from "../bootstrap.ts";

/**
 * 🛡️✨ Postgresくんと仲良くお話しできるかチェックするよっ！
 */
async function testConnection() {
  logger.info("🔍 Postgresくんに「もしもし」してみるねっ！💖");

  try {
    const pg = await bootstrapCanonicalDb();
    if (!pg) {
      logger.error(
        "Postgresくんがお返事してくれないよ… enabled: true になってるかな？💢",
      );
      process.exit(1);
    }

    // 簡単なクエリを投げてみるよっ！🎀
    const res = await pg.query(
      "SELECT current_database(), current_user, version();",
    );
    const info = res.rows[0];

    logger.info(
      `✨ 繋がったよーっ！🎉\n ・DB: ${info.current_database}\n ・User: ${info.current_user}`,
    );
    logger.info(`・Version: ${info.version.split(",")[0]} (強そう！💪✨)`);

    // スキーマの存在もチラッと見てみるねっ👀
    const schemas = await pg.query(
      "SELECT schema_name FROM information_schema.schemata WHERE schema_name IN ('ref', 'ingest', 'research', 'feature', 'signal', 'eval', 'exec', 'obs');",
    );
    logger.info(
      `📦 準備できてるスキーマ: ${schemas.rows.map((r) => r.schema_name).join(", ")} (ばっちり！💖)`,
    );

    await pg.close();
    logger.info("テスト合格！💯 これで完璧だねっ✨");
  } catch (err) {
    logger.error(
      `うわぁ〜っ！Postgresくんとお話しできなかったよぉ💢: ${String(err)}`,
    );
    process.exit(1);
  }
}

testConnection();
