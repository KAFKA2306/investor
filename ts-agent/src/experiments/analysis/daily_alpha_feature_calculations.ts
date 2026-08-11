// Compatibility extraction helper retained for the foundation benchmark.
// The deleted experiment module exposed many unrelated calculations; only the
// e-Stat numeric-value parser remains an active dependency.
export const extractEstatValues = (root: unknown): number[] => {
  const walk = (node: unknown): number[] => {
    if (Array.isArray(node)) return node.flatMap((value) => walk(value));
    if (typeof node === "object" && node !== null) {
      const object = node as Record<string, unknown>;
      if (object.$ !== undefined && object["@unit"] !== undefined) {
        const value = Number(object.$);
        return Number.isFinite(value) ? [value] : [];
      }
      return Object.values(object).flatMap((value) => walk(value));
    }
    return [];
  };

  return walk(root).filter(
    (value) => Number.isFinite(value) && Math.abs(value) > 0,
  );
};
