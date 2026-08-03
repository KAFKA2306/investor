import test from "node:test";
import assert from "node:assert/strict";
import { classifyDifference, extractSecondaryFacts, inferConcept, mapEdinetCsvRow, normalizeSecurityCode, parseDelimited, parseNumeric } from "../src/normalization.js";

test("normalizes Japanese security codes", () => {
  assert.equal(normalizeSecurityCode("28010"), "2801");
  assert.equal(normalizeSecurityCode("2897"), "2897");
  assert.throws(() => normalizeSecurityCode("E00435"));
});

test("maps common XBRL elements to canonical concepts", () => {
  assert.equal(inferConcept("jpcrp_cor:RevenueIFRSSummaryOfBusinessResults"), "revenue");
  assert.equal(inferConcept("jppfs_cor:NetCashProvidedByUsedInOperatingActivities"), "operating_cash_flow");
  assert.equal(inferConcept("custom:SomethingUnknown"), null);
});

test("parses accounting numbers", () => {
  assert.equal(parseNumeric("1,234.5"), 1234.5);
  assert.equal(parseNumeric("▲432"), -432);
  assert.equal(parseNumeric("(77)"), -77);
  assert.equal(parseNumeric("not disclosed"), null);
});

test("parses EDINET tab-delimited CSV rows", () => {
  const rows = parseDelimited("要素ID\t項目名\tコンテキストID\t期間・時点\t値\r\njpcrp_cor:RevenueIFRSSummaryOfBusinessResults\t売上収益\tCurrentYearDuration\t2025-04-01～2026-03-31\t788131000000\r\n");
  const fact = mapEdinetCsvRow(rows[0]);
  assert.equal(fact.conceptKey, "revenue");
  assert.equal(fact.periodEnd, "2026-03-31");
  assert.equal(fact.valueNumeric, 788131000000);
});

test("extracts mapped metrics from secondary JSON without assuming one schema", () => {
  const facts = extractSecondaryFacts({ periods: [{ fiscalYear: 2026, revenue: 745539000000, operatingProfit: 75940000000 }] });
  assert.equal(facts.some((fact) => fact.conceptKey === "revenue"), true);
  assert.equal(facts.some((fact) => fact.conceptKey === "operating_profit"), true);
});

test("classifies reconciliation differences", () => {
  assert.equal(classifyDifference(100, 100).issueType, "exact_match");
  assert.equal(classifyDifference(100, 100.4).issueType, "rounding_difference");
  assert.equal(classifyDifference(100, 103).issueType, "definition_difference");
  assert.equal(classifyDifference(100, 120).issueType, "material_conflict");
});
