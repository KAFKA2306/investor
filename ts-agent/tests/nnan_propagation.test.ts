import { describe, it, expect } from "bun:test";
import { evaluateFactor } from "../src/pipeline/factor_mining/factor_compute_engine";

// Mock YahooBar type with required fields
interface MockBar {
  Close: number;
  Open: number;
  High: number;
  Low: number;
  Volume: number;
  MacroCPI?: number;
  MacroIIP?: number;
  CorrectionCount?: number;
  LargeHolderCount?: number;
  SegmentSentiment?: number;
  AiExposure?: number;
  KgCentrality?: number;
}

describe("NaN Propagation for Macro Indicators - Phase 2", () => {
  describe("macro_cpi", () => {
    it("should return NaN when MacroCPI is undefined", () => {
      const mockBar: MockBar = {
        Close: 100,
        Open: 99,
        High: 101,
        Low: 98,
        Volume: 1000000,
        MacroCPI: undefined,
      };

      const ast = {
        type: "variable" as const,
        name: "macro_cpi",
      };

      const result = evaluateFactor(ast, [mockBar], 0);
      expect(Number.isNaN(result)).toBe(true);
    });

    it("should return NaN when MacroCPI is null", () => {
      const mockBar: MockBar = {
        Close: 100,
        Open: 99,
        High: 101,
        Low: 98,
        Volume: 1000000,
        MacroCPI: null as any,
      };

      const ast = {
        type: "variable" as const,
        name: "macro_cpi",
      };

      const result = evaluateFactor(ast, [mockBar], 0);
      expect(Number.isNaN(result)).toBe(true);
    });

    it("should return the value when MacroCPI is defined", () => {
      const mockBar: MockBar = {
        Close: 100,
        Open: 99,
        High: 101,
        Low: 98,
        Volume: 1000000,
        MacroCPI: 105.5,
      };

      const ast = {
        type: "variable" as const,
        name: "macro_cpi",
      };

      const result = evaluateFactor(ast, [mockBar], 0);
      expect(result).toBe(105.5);
    });
  });

  describe("macro_iip", () => {
    it("should return NaN when MacroIIP is undefined", () => {
      const mockBar: MockBar = {
        Close: 100,
        Open: 99,
        High: 101,
        Low: 98,
        Volume: 1000000,
        MacroIIP: undefined,
      };

      const ast = {
        type: "variable" as const,
        name: "macro_iip",
      };

      const result = evaluateFactor(ast, [mockBar], 0);
      expect(Number.isNaN(result)).toBe(true);
    });

    it("should return NaN when MacroIIP is null", () => {
      const mockBar: MockBar = {
        Close: 100,
        Open: 99,
        High: 101,
        Low: 98,
        Volume: 1000000,
        MacroIIP: null as any,
      };

      const ast = {
        type: "variable" as const,
        name: "macro_iip",
      };

      const result = evaluateFactor(ast, [mockBar], 0);
      expect(Number.isNaN(result)).toBe(true);
    });

    it("should return the value when MacroIIP is defined", () => {
      const mockBar: MockBar = {
        Close: 100,
        Open: 99,
        High: 101,
        Low: 98,
        Volume: 1000000,
        MacroIIP: 110.2,
      };

      const ast = {
        type: "variable" as const,
        name: "macro_iip",
      };

      const result = evaluateFactor(ast, [mockBar], 0);
      expect(result).toBe(110.2);
    });
  });

  describe("NaN Propagation Through Arithmetic Operations", () => {
    it("should propagate NaN through addition when MacroCPI is missing", () => {
      const mockBar: MockBar = {
        Close: 100,
        Open: 99,
        High: 101,
        Low: 98,
        Volume: 1000000,
        MacroCPI: undefined,
      };

      // macro_cpi + close (NaN + 100)
      const ast = {
        type: "operator" as const,
        name: "ADD",
        left: {
          type: "variable" as const,
          name: "macro_cpi",
        },
        right: {
          type: "variable" as const,
          name: "close",
        },
      };

      const result = evaluateFactor(ast, [mockBar], 0);
      expect(Number.isNaN(result)).toBe(true);
    });

    it("should propagate NaN through multiplication when MacroIIP is missing", () => {
      const mockBar: MockBar = {
        Close: 100,
        Open: 99,
        High: 101,
        Low: 98,
        Volume: 1000000,
        MacroIIP: undefined,
      };

      // macro_iip * close (NaN * 100)
      const ast = {
        type: "operator" as const,
        name: "MUL",
        left: {
          type: "variable" as const,
          name: "macro_iip",
        },
        right: {
          type: "variable" as const,
          name: "close",
        },
      };

      const result = evaluateFactor(ast, [mockBar], 0);
      expect(Number.isNaN(result)).toBe(true);
    });

    it("should propagate NaN through subtraction when MacroCPI is missing", () => {
      const mockBar: MockBar = {
        Close: 100,
        Open: 99,
        High: 101,
        Low: 98,
        Volume: 1000000,
        MacroCPI: undefined,
      };

      // close - macro_cpi (100 - NaN)
      const ast = {
        type: "operator" as const,
        name: "SUB",
        left: {
          type: "variable" as const,
          name: "close",
        },
        right: {
          type: "variable" as const,
          name: "macro_cpi",
        },
      };

      const result = evaluateFactor(ast, [mockBar], 0);
      expect(Number.isNaN(result)).toBe(true);
    });
  });

  describe("Fail Fast Philosophy - Missing Macro Data Detection", () => {
    it("should detect that a factor with missing macro_cpi data is invalid", () => {
      const mockBars: MockBar[] = [
        {
          Close: 100,
          Open: 99,
          High: 101,
          Low: 98,
          Volume: 1000000,
          MacroCPI: 105.5,
        },
        {
          Close: 101,
          Open: 100,
          High: 102,
          Low: 99,
          Volume: 1000000,
          MacroCPI: undefined, // Missing data - should return NaN
        },
        {
          Close: 99,
          Open: 100,
          High: 101,
          Low: 98,
          Volume: 1000000,
          MacroCPI: 106.0,
        },
      ];

      const ast = {
        type: "variable" as const,
        name: "macro_cpi",
      };

      // Second bar should have NaN (fail fast detection)
      const result1 = evaluateFactor(ast, mockBars, 0);
      const result2 = evaluateFactor(ast, mockBars, 1);
      const result3 = evaluateFactor(ast, mockBars, 2);

      expect(result1).toBe(105.5);
      expect(Number.isNaN(result2)).toBe(true); // Fail Fast: NaN indicates missing data
      expect(result3).toBe(106.0);
    });

    it("should detect that a factor with missing macro_iip data is invalid", () => {
      const mockBars: MockBar[] = [
        {
          Close: 100,
          Open: 99,
          High: 101,
          Low: 98,
          Volume: 1000000,
          MacroIIP: 110.2,
        },
        {
          Close: 101,
          Open: 100,
          High: 102,
          Low: 99,
          Volume: 1000000,
          MacroIIP: null as any, // Missing data - should return NaN
        },
      ];

      const ast = {
        type: "variable" as const,
        name: "macro_iip",
      };

      const result1 = evaluateFactor(ast, mockBars, 0);
      const result2 = evaluateFactor(ast, mockBars, 1);

      expect(result1).toBe(110.2);
      expect(Number.isNaN(result2)).toBe(true); // Fail Fast: NaN indicates data quality issue
    });
  });

  describe("Case Insensitivity", () => {
    it("should handle macro_cpi with different cases", () => {
      const mockBar: MockBar = {
        Close: 100,
        Open: 99,
        High: 101,
        Low: 98,
        Volume: 1000000,
        MacroCPI: undefined,
      };

      // Test different case variations
      const ast1 = { type: "variable" as const, name: "MACRO_CPI" };
      const ast2 = { type: "variable" as const, name: "Macro_CPI" };
      const ast3 = { type: "variable" as const, name: "macro_cpi" };

      expect(Number.isNaN(evaluateFactor(ast1, [mockBar], 0))).toBe(true);
      expect(Number.isNaN(evaluateFactor(ast2, [mockBar], 0))).toBe(true);
      expect(Number.isNaN(evaluateFactor(ast3, [mockBar], 0))).toBe(true);
    });

    it("should handle macro_iip with different cases", () => {
      const mockBar: MockBar = {
        Close: 100,
        Open: 99,
        High: 101,
        Low: 98,
        Volume: 1000000,
        MacroIIP: null as any,
      };

      const ast1 = { type: "variable" as const, name: "MACRO_IIP" };
      const ast2 = { type: "variable" as const, name: "Macro_IIP" };
      const ast3 = { type: "variable" as const, name: "macro_iip" };

      expect(Number.isNaN(evaluateFactor(ast1, [mockBar], 0))).toBe(true);
      expect(Number.isNaN(evaluateFactor(ast2, [mockBar], 0))).toBe(true);
      expect(Number.isNaN(evaluateFactor(ast3, [mockBar], 0))).toBe(true);
    });
  });
});
