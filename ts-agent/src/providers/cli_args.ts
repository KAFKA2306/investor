export type ParsedCliArgs = {
  positional: string[];
  _: string[];
  flags: Set<string>;
  values: Map<string, string>;
};

const normalizeKey = (key: string): string => key.replace(/^--/, "");

export function parseCliArgs(argv: readonly string[]): ParsedCliArgs {
  const positional: string[] = [];
  const flags = new Set<string>();
  const values = new Map<string, string>();

  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === undefined) {
      continue;
    }
    if (arg.startsWith("--")) {
      if (arg.includes("=")) {
        throw new Error(
          `Invalid argument format: "${arg}". Use "--key value" instead of "--key=value".`,
        );
      }
      const key = normalizeKey(arg);
      const next = argv[i + 1];

      if (next !== undefined && !next.startsWith("--")) {
        values.set(key, next);
        i++;
      } else {
        flags.add(key);
      }
    } else {
      positional.push(arg);
    }
  }

  return { positional, _: positional, flags, values };
}

export function getStringArg(
  parsed: ParsedCliArgs,
  key: string,
  defaultValue?: string,
): string | undefined {
  return parsed.values.get(normalizeKey(key)) ?? defaultValue;
}

export function getNumberArg(
  parsed: ParsedCliArgs,
  key: string,
): number | undefined;
export function getNumberArg(
  parsed: ParsedCliArgs,
  key: string,
  defaultValue: number,
): number;
export function getNumberArg(
  parsed: ParsedCliArgs,
  key: string,
  defaultValue?: number,
): number | undefined {
  const val = parsed.values.get(normalizeKey(key));
  if (val === undefined) return defaultValue;
  const num = Number(val);
  if (Number.isNaN(num)) {
    throw new Error(`Invalid number for ${key}: "${val}"`);
  }
  return num;
}

export function hasFlag(parsed: ParsedCliArgs, key: string): boolean {
  return parsed.flags.has(normalizeKey(key));
}

export function requireIsoDate(value: string, keyName: string): string {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    throw new Error(
      `${keyName} must be in YYYY-MM-DD format (got: "${value}")`,
    );
  }
  return value;
}

export function parseUniverseArgs(parsed: ParsedCliArgs): {
  symbols: string[];
  limit: number;
} {
  const symbolsRaw = getStringArg(parsed, "--symbols", "");
  const symbols = symbolsRaw
    ? symbolsRaw
      .split(",")
      .map((s) => s.trim())
      .filter((s) => s.length > 0)
    : [];
  const limit = getNumberArg(parsed, "--limit", 100);
  return { symbols, limit };
}

export function parseDateRangeArgs(parsed: ParsedCliArgs): {
  from?: string;
  to?: string;
} {
  const fromRaw = getStringArg(parsed, "--from");
  const toRaw = getStringArg(parsed, "--to");
  return {
    from: fromRaw ? requireIsoDate(fromRaw, "--from") : undefined,
    to: toRaw ? requireIsoDate(toRaw, "--to") : undefined,
  };
}

/**
 * コマンドラインとお友達になれる cliArgs ユーティリティだよっ！🚀✨
 */
export const cliArgs = {
  parse: parseCliArgs,
  getString: getStringArg,
  getNumber: getNumberArg,
  hasFlag,
  requireIsoDate,
  parseUniverseArgs,
  parseDateRangeArgs,
};
