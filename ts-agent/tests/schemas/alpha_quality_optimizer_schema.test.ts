import { describe, it, expect } from "bun:test";
import {
  MarketSnapshotSchema,
  PlaybookPatternSchema,
  AlphaQualityOptimizerInputSchema,
  DetailedReportSchema,
  AlphaQualityOptimizerOutputSchema,
  type MarketSnapshot,
  type PlaybookPattern,
  type AlphaQualityOptimizerInput,
  type DetailedReport,
  type AlphaQualityOptimizerOutput,
} from "../../src/schemas/alpha_quality_optimizer_schema";
import { z } from "zod";

describe("MarketSnapshotSchema", () => {
  it("should validate a valid market snapshot", () => {
    const validSnapshot = {
      asOfDate: "2026-03-03",
      symbols: ["1234", "5678", "9012"],
      returns: [
        [0.01, 0.02, -0.01],
        [0.015, 0.025, -0.015],
      ],
      volatilities: [0.08, 0.12, 0.10],
      sharpeRatio: 2.1,
      informationCoefficient: 0.05,
      maxDrawdown: 0.07,
    };
    const result = MarketSnapshotSchema.safeParse(validSnapshot);
    expect(result.success).toBe(true);
  });

  it("should reject invalid volatilities (negative)", () => {
    const invalidSnapshot = {
      asOfDate: "2026-03-03",
      symbols: ["1234", "5678"],
      returns: [[0.01, 0.02]],
      volatilities: [-0.08, 0.12],
      sharpeRatio: 1.5,
      informationCoefficient: 0.03,
      maxDrawdown: 0.08,
    };
    const result = MarketSnapshotSchema.safeParse(invalidSnapshot);
    expect(result.success).toBe(false);
  });

  it("should reject invalid date format", () => {
    const invalidSnapshot = {
      asOfDate: "03-03-2026",
      symbols: ["1234"],
      returns: [[0.01]],
      volatilities: [0.08],
      sharpeRatio: 1.5,
      informationCoefficient: 0.03,
      maxDrawdown: 0.08,
    };
    const result = MarketSnapshotSchema.safeParse(invalidSnapshot);
    expect(result.success).toBe(false);
  });

  it("should reject IC outside [-1, 1] range", () => {
    const invalidSnapshot = {
      asOfDate: "2026-03-03",
      symbols: ["1234"],
      returns: [[0.01]],
      volatilities: [0.08],
      sharpeRatio: 1.5,
      informationCoefficient: 1.5,
      maxDrawdown: 0.08,
    };
    const result = MarketSnapshotSchema.safeParse(invalidSnapshot);
    expect(result.success).toBe(false);
  });

  it("should reject maxDrawdown outside [0, 1] range", () => {
    const invalidSnapshot = {
      asOfDate: "2026-03-03",
      symbols: ["1234"],
      returns: [[0.01]],
      volatilities: [0.08],
      sharpeRatio: 1.5,
      informationCoefficient: 0.03,
      maxDrawdown: 1.5,
    };
    const result = MarketSnapshotSchema.safeParse(invalidSnapshot);
    expect(result.success).toBe(false);
  });
});

describe("PlaybookPatternSchema", () => {
  it("should validate a valid playbook pattern with default fitness", () => {
    const validPattern = {
      factorSet: ["momentum", "mean_reversion"],
    };
    const result = PlaybookPatternSchema.safeParse(validPattern);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.fitnessScore).toBe(0);
    }
  });

  it("should validate a playbook pattern with explicit fitness score", () => {
    const validPattern = {
      factorSet: ["momentum", "mean_reversion", "volatility"],
      fitnessScore: 0.75,
    };
    const result = PlaybookPatternSchema.safeParse(validPattern);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.fitnessScore).toBe(0.75);
    }
  });

  it("should reject fitness score outside [0, 1]", () => {
    const invalidPattern = {
      factorSet: ["momentum"],
      fitnessScore: 1.5,
    };
    const result = PlaybookPatternSchema.safeParse(invalidPattern);
    expect(result.success).toBe(false);
  });

  it("should reject empty factorSet", () => {
    const invalidPattern = {
      factorSet: [],
    };
    const result = PlaybookPatternSchema.safeParse(invalidPattern);
    expect(result.success).toBe(false);
  });

  it("should reject non-string factors", () => {
    const invalidPattern = {
      factorSet: ["momentum", 123],
    };
    const result = PlaybookPatternSchema.safeParse(invalidPattern);
    expect(result.success).toBe(false);
  });
});

describe("DetailedReportSchema", () => {
  it("should validate a valid detailed report", () => {
    const validReport = {
      correlationScore: 0.45,
      constraintScore: 0.62,
      orthogonalityScore: 0.78,
      backtestScore: 0.55,
      reasoning:
        "Alpha shows moderate correlation with market, meets constraints, orthogonal to existing factors.",
    };
    const result = DetailedReportSchema.safeParse(validReport);
    expect(result.success).toBe(true);
  });

  it("should reject correlation score outside [0, 1]", () => {
    const invalidReport = {
      correlationScore: -0.1,
      constraintScore: 0.62,
      orthogonalityScore: 0.78,
      backtestScore: 0.55,
      reasoning: "test",
    };
    const result = DetailedReportSchema.safeParse(invalidReport);
    expect(result.success).toBe(false);
  });

  it("should reject constraint score outside [0, 1]", () => {
    const invalidReport = {
      correlationScore: 0.45,
      constraintScore: 1.1,
      orthogonalityScore: 0.78,
      backtestScore: 0.55,
      reasoning: "test",
    };
    const result = DetailedReportSchema.safeParse(invalidReport);
    expect(result.success).toBe(false);
  });

  it("should require non-empty reasoning string", () => {
    const invalidReport = {
      correlationScore: 0.45,
      constraintScore: 0.62,
      orthogonalityScore: 0.78,
      backtestScore: 0.55,
      reasoning: "",
    };
    const result = DetailedReportSchema.safeParse(invalidReport);
    expect(result.success).toBe(false);
  });
});

describe("AlphaQualityOptimizerInputSchema", () => {
  it("should validate a valid input with required fields only", () => {
    const validInput = {
      alphaPrompt:
        "Generate a momentum-based alpha factor for Japanese equities",
      marketData: {
        asOfDate: "2026-03-03",
        symbols: ["1234", "5678"],
        returns: [[0.01, 0.02]],
        volatilities: [0.08, 0.12],
        sharpeRatio: 1.5,
        informationCoefficient: 0.04,
        maxDrawdown: 0.08,
      },
    };
    const result = AlphaQualityOptimizerInputSchema.safeParse(validInput);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.playbookPatterns).toEqual([]);
    }
  });

  it("should validate input with playbook patterns", () => {
    const validInput = {
      alphaPrompt: "Generate a mean reversion alpha",
      marketData: {
        asOfDate: "2026-03-03",
        symbols: ["1234"],
        returns: [[0.01]],
        volatilities: [0.08],
        sharpeRatio: 1.5,
        informationCoefficient: 0.03,
        maxDrawdown: 0.08,
      },
      playbookPatterns: [
        {
          factorSet: ["momentum"],
          fitnessScore: 0.65,
        },
        {
          factorSet: ["volatility", "mean_reversion"],
          fitnessScore: 0.72,
        },
      ],
    };
    const result = AlphaQualityOptimizerInputSchema.safeParse(validInput);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.playbookPatterns.length).toBe(2);
    }
  });

  it("should reject empty alphaPrompt", () => {
    const invalidInput = {
      alphaPrompt: "",
      marketData: {
        asOfDate: "2026-03-03",
        symbols: ["1234"],
        returns: [[0.01]],
        volatilities: [0.08],
        sharpeRatio: 1.5,
        informationCoefficient: 0.03,
        maxDrawdown: 0.08,
      },
    };
    const result = AlphaQualityOptimizerInputSchema.safeParse(invalidInput);
    expect(result.success).toBe(false);
  });

  it("should reject missing marketData", () => {
    const invalidInput = {
      alphaPrompt: "Generate alpha",
    };
    const result = AlphaQualityOptimizerInputSchema.safeParse(invalidInput);
    expect(result.success).toBe(false);
  });
});

describe("AlphaQualityOptimizerOutputSchema", () => {
  it("should validate a valid output", () => {
    const validOutput = {
      optimizedDSL: "close * momentum(20) / volatility(10)",
      fitness: 0.68,
      detailedReport: {
        correlationScore: 0.45,
        constraintScore: 0.62,
        orthogonalityScore: 0.78,
        backtestScore: 0.55,
        reasoning:
          "The factor demonstrates good orthogonality but moderate correlation with market.",
      },
    };
    const result = AlphaQualityOptimizerOutputSchema.safeParse(validOutput);
    expect(result.success).toBe(true);
  });

  it("should reject non-string optimizedDSL", () => {
    const invalidOutput = {
      optimizedDSL: 123,
      fitness: 0.68,
      detailedReport: {
        correlationScore: 0.45,
        constraintScore: 0.62,
        orthogonalityScore: 0.78,
        backtestScore: 0.55,
        reasoning: "test",
      },
    };
    const result = AlphaQualityOptimizerOutputSchema.safeParse(invalidOutput);
    expect(result.success).toBe(false);
  });

  it("should reject fitness outside [0, 1]", () => {
    const invalidOutput = {
      optimizedDSL: "close * momentum(20)",
      fitness: 1.5,
      detailedReport: {
        correlationScore: 0.45,
        constraintScore: 0.62,
        orthogonalityScore: 0.78,
        backtestScore: 0.55,
        reasoning: "test",
      },
    };
    const result = AlphaQualityOptimizerOutputSchema.safeParse(invalidOutput);
    expect(result.success).toBe(false);
  });

  it("should reject empty optimizedDSL", () => {
    const invalidOutput = {
      optimizedDSL: "",
      fitness: 0.68,
      detailedReport: {
        correlationScore: 0.45,
        constraintScore: 0.62,
        orthogonalityScore: 0.78,
        backtestScore: 0.55,
        reasoning: "test",
      },
    };
    const result = AlphaQualityOptimizerOutputSchema.safeParse(invalidOutput);
    expect(result.success).toBe(false);
  });

  it("should reject missing detailedReport", () => {
    const invalidOutput = {
      optimizedDSL: "close * momentum(20)",
      fitness: 0.68,
    };
    const result = AlphaQualityOptimizerOutputSchema.safeParse(invalidOutput);
    expect(result.success).toBe(false);
  });
});

describe("Type exports", () => {
  it("should have proper TypeScript types exported", () => {
    // This test verifies that all types are exported and can be used
    const snapshot: MarketSnapshot = {
      asOfDate: "2026-03-03",
      symbols: ["1234"],
      returns: [[0.01]],
      volatilities: [0.08],
      sharpeRatio: 1.5,
      informationCoefficient: 0.03,
      maxDrawdown: 0.08,
    };
    expect(snapshot.asOfDate).toBe("2026-03-03");

    const pattern: PlaybookPattern = {
      factorSet: ["momentum"],
      fitnessScore: 0.5,
    };
    expect(pattern.fitnessScore).toBe(0.5);

    const report: DetailedReport = {
      correlationScore: 0.45,
      constraintScore: 0.62,
      orthogonalityScore: 0.78,
      backtestScore: 0.55,
      reasoning: "Test",
    };
    expect(report.correlationScore).toBe(0.45);

    const input: AlphaQualityOptimizerInput = {
      alphaPrompt: "Test",
      marketData: snapshot,
      playbookPatterns: [],
    };
    expect(input.playbookPatterns.length).toBe(0);

    const output: AlphaQualityOptimizerOutput = {
      optimizedDSL: "close * momentum(20)",
      fitness: 0.68,
      detailedReport: report,
    };
    expect(output.fitness).toBe(0.68);
  });
});
