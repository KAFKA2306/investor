const CONCEPT_PATTERNS = [
  ["revenue", /(?:^|:)(?:NetSales|Revenue|OperatingRevenue)|売上(?:高|収益)/i],
  ["operating_profit", /(?:OperatingIncome|OperatingProfit(?:Loss)?)|営業利益/i],
  ["profit_attributable_to_owners", /(?:ProfitLossAttributableToOwnersOfParent|NetIncomeLossAttributableToOwnersOfParent)|親会社.*(?:利益|純利益)/i],
  ["total_assets", /(?:^|:)(?:Assets|TotalAssets)$|資産合計/i],
  ["inventory", /Inventor|棚卸資産|商品及び製品|原材料及び貯蔵品/i],
  ["property_plant_equipment", /PropertyPlantAndEquipment|有形固定資産/i],
  ["goodwill", /Goodwill|のれん/i],
  ["equity_attributable_to_owners", /EquityAttributableToOwnersOfParent|ShareholdersEquity|自己資本/i],
  ["equity", /(?:^|:)(?:Equity|TotalEquity)$|純資産合計|資本合計/i],
  ["cash_and_cash_equivalents", /CashAndCashEquivalents|CashAndDeposits|現金及び現金同等物|現金及び預金/i],
  ["interest_bearing_debt", /InterestBearingDebt|BondsAndBorrowings|有利子負債/i],
  ["operating_cash_flow", /NetCashProvidedByUsedInOperatingActivities|CashFlowsFromUsedInOperatingActivities|営業活動によるキャッシュ/i],
  ["investing_cash_flow", /NetCashProvidedByUsedInInvestingActivities|CashFlowsFromUsedInInvestingActivities|投資活動によるキャッシュ/i],
  ["financing_cash_flow", /NetCashProvidedByUsedInFinancingActivities|CashFlowsFromUsedInFinancingActivities|財務活動によるキャッシュ/i],
  ["employees", /NumberOfEmployees|従業員数/i]
];

export function normalizeSecurityCode(value) {
  const digits = String(value ?? "").replace(/\D/g, "");
  if (digits.length === 5 && digits.endsWith("0")) return digits.slice(0, 4);
  if (digits.length === 4) return digits;
  throw new Error(`invalid security code: ${value}`);
}

export function inferConcept(elementId = "", label = "") {
  const haystack = `${elementId} ${label}`;
  return CONCEPT_PATTERNS.find(([, pattern]) => pattern.test(haystack))?.[0] ?? null;
}

export function parseNumeric(value) {
  if (value === null || value === undefined || value === "") return null;
  if (typeof value === "number") return Number.isFinite(value) ? value : null;
  const normalized = String(value)
    .trim()
    .replace(/[，,\s]/g, "")
    .replace(/^▲/, "-")
    .replace(/^△/, "-")
    .replace(/^\((.+)\)$/, "-$1");
  if (!/^[-+]?\d+(?:\.\d+)?$/.test(normalized)) return null;
  const number = Number(normalized);
  return Number.isFinite(number) ? number : null;
}

export function sha256Hex(input) {
  return crypto.subtle.digest("SHA-256", typeof input === "string" ? new TextEncoder().encode(input) : input)
    .then((buffer) => [...new Uint8Array(buffer)].map((b) => b.toString(16).padStart(2, "0")).join(""));
}

export function parseDelimited(text, delimiter = "\t") {
  const rows = [];
  let row = [];
  let field = "";
  let quoted = false;
  for (let i = 0; i < text.length; i += 1) {
    const char = text[i];
    if (char === '"') {
      if (quoted && text[i + 1] === '"') { field += '"'; i += 1; }
      else quoted = !quoted;
    } else if (char === delimiter && !quoted) {
      row.push(field); field = "";
    } else if ((char === "\n" || char === "\r") && !quoted) {
      if (char === "\r" && text[i + 1] === "\n") i += 1;
      row.push(field); field = "";
      if (row.some((cell) => cell.length > 0)) rows.push(row);
      row = [];
    } else field += char;
  }
  if (field.length > 0 || row.length > 0) { row.push(field); rows.push(row); }
  if (rows.length === 0) return [];
  const headers = rows[0].map((header) => header.replace(/^\uFEFF/, "").trim());
  return rows.slice(1).map((cells) => Object.fromEntries(headers.map((header, index) => [header, cells[index] ?? ""])));
}

export function mapEdinetCsvRow(row) {
  const pick = (...names) => names.map((name) => row[name]).find((value) => value !== undefined && value !== "");
  const elementId = pick("要素ID", "element_id", "要素名") ?? "";
  const label = pick("項目名", "label") ?? "";
  const valueRaw = pick("値", "value") ?? "";
  const period = String(pick("期間・時点", "period") ?? "");
  const [periodStart, periodEnd] = period.includes("～") ? period.split("～").map((part) => part.trim()) : [null, null];
  const instantDate = !periodStart && /^\d{4}-\d{2}-\d{2}$/.test(period) ? period : null;
  return {
    elementId,
    label,
    conceptKey: inferConcept(elementId, label),
    contextId: pick("コンテキストID", "context_id") ?? null,
    relativeFiscalYear: pick("相対年度", "relative_fiscal_year") ?? null,
    consolidated: /連結|Consolidated/i.test(String(pick("連結・個別", "consolidated") ?? "")) ? true : /個別|NonConsolidated/i.test(String(pick("連結・個別", "consolidated") ?? "")) ? false : null,
    periodStart,
    periodEnd,
    instantDate,
    unitId: pick("ユニットID", "unit_id") ?? null,
    unitLabel: pick("単位", "unit") ?? null,
    valueNumeric: parseNumeric(valueRaw),
    valueText: parseNumeric(valueRaw) === null && valueRaw !== "" ? String(valueRaw) : null,
    metadata: row
  };
}

export function extractSecondaryFacts(payload) {
  const facts = [];
  const visit = (value, path = []) => {
    if (Array.isArray(value)) return value.forEach((item, index) => visit(item, [...path, String(index)]));
    if (!value || typeof value !== "object") return;
    for (const [key, child] of Object.entries(value)) {
      const conceptKey = inferConcept(key, key);
      const numeric = parseNumeric(child);
      if (conceptKey && numeric !== null) facts.push({ conceptKey, elementId: `the_shashi:${path.concat(key).join(".")}`, label: key, valueNumeric: numeric, metadata: { path: path.concat(key) } });
      visit(child, [...path, key]);
    }
  };
  visit(payload);
  return facts;
}

export function classifyDifference(officialValue, comparisonValue) {
  const absoluteDifference = Math.abs(officialValue - comparisonValue);
  const denominator = Math.max(Math.abs(officialValue), 1);
  const relativeDifference = absoluteDifference / denominator;
  const issueType = absoluteDifference === 0 ? "exact_match" : relativeDifference <= 0.005 ? "rounding_difference" : relativeDifference <= 0.05 ? "definition_difference" : "material_conflict";
  return { issueType, absoluteDifference, relativeDifference };
}
