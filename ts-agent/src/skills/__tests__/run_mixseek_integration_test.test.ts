import { describe, it, expect, beforeAll } from "bun:test";
import { runMixseekIntegrationTest } from "../run_mixseek_integration_test.ts";

describe("MixSeek 4-Skill Pipeline Integration Test", () => {
  let result: Awaited<ReturnType<typeof runMixseekIntegrationTest>>;

  beforeAll(async () => {
    result = await runMixseekIntegrationTest();
  });

  describe("Skill 1: Data Pipeline", () => {
    it("should output valid train dataset metadata", () => {
      expect(
        result.pipeline_execution.skill_1_data_pipeline.train_dataset,
      ).toBeDefined();
      expect(
        result.pipeline_execution.skill_1_data_pipeline.train_dataset.period,
      ).toMatch(/\d{4}-\d{2}-\d{2}/);
      expect(
        result.pipeline_execution.skill_1_data_pipeline.train_dataset.shape
          .length,
      ).toBe(3);
    });

    it("should output valid eval dataset metadata", () => {
      expect(
        result.pipeline_execution.skill_1_data_pipeline.eval_dataset,
      ).toBeDefined();
      expect(
        result.pipeline_execution.skill_1_data_pipeline.eval_dataset.period,
      ).toMatch(/\d{4}-\d{2}-\d{2}/);
      expect(
        result.pipeline_execution.skill_1_data_pipeline.eval_dataset.shape
          .length,
      ).toBe(3);
    });

    it("should pass quality checks", () => {
      const qr = result.pipeline_execution.skill_1_data_pipeline.quality_report;
      expect(qr.missing_rate).toBeLessThan(0.08);
      expect(qr.coverage).toBeGreaterThan(0.95);
      expect(qr.price_continuity).toBe("pass");
      expect(qr.volume_consistency).toBe("pass");
    });
  });

  describe("Skill 2: Backtest Engine", () => {
    it("should evaluate all 3 candidate formulas", () => {
      expect(result.pipeline_execution.skill_2_backtest_engine.length).toBe(3);
    });

    it("should output Sharpe, IC, and MaxDD for each formula", () => {
      result.pipeline_execution.skill_2_backtest_engine.forEach((b) => {
        expect(b.factor_id).toBeDefined();
        expect(b.formula).toBeDefined();
        expect(b.performance.sharpe).toBeGreaterThan(0);
        expect(b.performance.ic).toBeGreaterThan(0);
        expect(b.performance.max_drawdown).toBeGreaterThan(0);
        expect(b.performance.max_drawdown).toBeLessThan(1);
      });
    });

    it("should have REV-VOL with highest Sharpe", () => {
      const revVol = result.pipeline_execution.skill_2_backtest_engine.find(
        (b) => b.factor_id === "REV-VOL",
      );
      const allSharpes = result.pipeline_execution.skill_2_backtest_engine.map(
        (b) => b.performance.sharpe,
      );
      expect(revVol?.performance.sharpe).toBe(Math.max(...allSharpes));
    });
  });

  describe("Skill 3: Ranking & Scoring", () => {
    it("should rank all candidates by Sharpe descending", () => {
      const rankings =
        result.pipeline_execution.skill_3_ranking_scoring.rankings;
      expect(rankings.length).toBe(3);

      for (let i = 0; i < rankings.length - 1; i++) {
        expect(rankings[i].sharpe).toBeGreaterThanOrEqual(
          rankings[i + 1].sharpe,
        );
      }
    });

    it("should identify REV-VOL as winner", () => {
      expect(
        result.pipeline_execution.skill_3_ranking_scoring.winner.factor_id,
      ).toBe("REV-VOL");
    });

    it("should compute deltas from winner correctly", () => {
      const rankings =
        result.pipeline_execution.skill_3_ranking_scoring.rankings;
      const winnerSharpe = rankings[0].sharpe;

      rankings.forEach((r, idx) => {
        const expectedDelta = winnerSharpe - r.sharpe;
        expect(Math.abs(r.delta_from_winner - expectedDelta)).toBeLessThan(
          0.0001,
        );
      });
    });
  });

  describe("Skill 4: Competitive Framework", () => {
    it("should select REV-VOL as competitive winner", () => {
      expect(
        result.pipeline_execution.skill_4_competitive_framework.winner
          .factor_id,
      ).toBe("REV-VOL");
    });

    it("should output all rankings", () => {
      const rankings =
        result.pipeline_execution.skill_4_competitive_framework.rankings;
      expect(rankings.length).toBe(3);
      expect(rankings[0].rank).toBe(1);
      expect(rankings[1].rank).toBe(2);
      expect(rankings[2].rank).toBe(3);
    });

    it("should have metadata with correct total_candidates", () => {
      const meta =
        result.pipeline_execution.skill_4_competitive_framework
          .competition_metadata;
      expect(meta.total_candidates).toBe(3);
      expect(meta.ranking_metric).toBe("sharpe_ratio");
      expect(meta.evaluation_date_range).toBeDefined();
    });
  });

  describe("Validation & Quality Gates", () => {
    it("should pass all schema validations", () => {
      expect(result.validation.all_schemas_valid).toBe(true);
    });

    it("should identify winner with highest Sharpe", () => {
      expect(result.validation.winner_has_highest_sharpe).toBe(true);
    });

    it("should confirm rankings sorted descending", () => {
      expect(result.validation.rankings_sorted_descending).toBe(true);
    });

    it("should pass quality gates: Sharpe > 1.8", () => {
      expect(result.winner.performance.sharpe).toBeGreaterThan(1.8);
    });

    it("should pass quality gates: IC > 0.04", () => {
      expect(result.winner.performance.ic).toBeGreaterThan(0.04);
    });

    it("should pass quality gates: MaxDD < 15%", () => {
      expect(result.winner.performance.max_drawdown).toBeLessThan(0.15);
    });

    it("should have all_quality_gates_pass = true", () => {
      expect(result.validation.all_quality_gates_pass).toBe(true);
    });
  });

  describe("Pipeline Consistency", () => {
    it("should have consistent winner across all 4 skills", () => {
      const skill1Winner = result.pipeline_execution.skill_1_data_pipeline;
      const skill2Winner =
        result.pipeline_execution.skill_2_backtest_engine.find(
          (b) => b.factor_id === "REV-VOL",
        );
      const skill3Winner =
        result.pipeline_execution.skill_3_ranking_scoring.winner;
      const skill4Winner =
        result.pipeline_execution.skill_4_competitive_framework.winner;

      expect(skill2Winner).toBeDefined();
      expect(skill3Winner.factor_id).toBe("REV-VOL");
      expect(skill4Winner.factor_id).toBe("REV-VOL");

      expect(skill3Winner.performance.sharpe).toBe(
        skill2Winner!.performance.sharpe,
      );
    });

    it("should have REV-VOL Sharpe=2.15, IC=0.0424", () => {
      const revVol = result.winner;
      expect(revVol.performance.sharpe).toBeCloseTo(2.15, 2);
      expect(revVol.performance.ic).toBeCloseTo(0.0424, 4);
    });

    it("should have REV-VOL MaxDD=12.8%", () => {
      const revVol = result.winner;
      expect(revVol.performance.max_drawdown).toBeCloseTo(0.128, 3);
    });

    it("should have proper final result status", () => {
      expect(result.status).toBe("success");
    });
  });

  describe("Output Artifacts", () => {
    it("should generate complete final result object", () => {
      expect(result.winner).toBeDefined();
      expect(result.rankings).toBeDefined();
      expect(result.pipeline_execution).toBeDefined();
      expect(result.validation).toBeDefined();
    });

    it("should have all skill execution results", () => {
      expect(result.pipeline_execution.skill_1_data_pipeline).toBeDefined();
      expect(result.pipeline_execution.skill_2_backtest_engine).toBeDefined();
      expect(result.pipeline_execution.skill_3_ranking_scoring).toBeDefined();
      expect(
        result.pipeline_execution.skill_4_competitive_framework,
      ).toBeDefined();
    });
  });
});
