export function calculateExpectedValue(p: number, decimalOdds: number): number {
  const b = decimalOdds - 1;
  return p * b - (1 - p);
}

export function calculateEdge(pModel: number, pMkt: number): number {
  return pModel - pMkt;
}

export function calculateKelly(p: number, decimalOdds: number): number {
  const b = decimalOdds - 1;
  return (p * b - (1 - p)) / b;
}

export function calculateFractionalKelly(
  p: number,
  decimalOdds: number,
  alpha: number,
): number {
  return alpha * calculateKelly(p, decimalOdds);
}

export function calculateVaR95(mu: number, sigma: number): number {
  return mu - 1.645 * sigma;
}

export function calculateBrierScore(p: number, outcome: number): number {
  return (p - outcome) ** 2;
}

export function updateBayesian(
  prior: number,
  likelihood: number,
  evidence: number,
): number {
  return (likelihood * prior) / evidence;
}
