import {
  type StandardOutcome,
  StandardOutcomeSchema,
} from "../schemas/financial_domain_schemas.ts";
import { writeCanonicalLog } from "../system/app_runtime_core.ts";
import { dateUtils } from "../utils/date_utils.ts";
import { logger } from "../utils/logger.ts";

/**
 * ✨ 標準レポート（StandardOutcome）の管理マネージャー ✨
 */
export class OutcomeManager {
  private agentName: string;

  constructor(agentName: string) {
    this.agentName = agentName;
  }

  /**
   * 標準レポートを可愛くバリデーションして永続化するよっ！📝✨
   */
  public persist(outcome: StandardOutcome): void {
    const validated = StandardOutcomeSchema.parse(outcome);

    writeCanonicalLog({
      schema: "investor.investment-outcome.v1",
      generatedAt: validated.timestamp || dateUtils.nowIso(),
      report: validated,
    });

    logger.info(
      `📝 [${this.agentName}] StandardOutcome persisted: ${validated.strategyId}`,
      { strategyId: validated.strategyId },
    );
  }

  /**
   * 成功時の簡易レポートを生成して保存するよっ！🎉
   */
  public success(
    strategyId: string,
    summary: string,
    extra: Partial<StandardOutcome> = {},
  ): void {
    this.persist({
      strategyId,
      strategyName: strategyId, // デフォルト
      timestamp: dateUtils.nowIso(),
      summary,
      ...extra,
    });
  }
}
