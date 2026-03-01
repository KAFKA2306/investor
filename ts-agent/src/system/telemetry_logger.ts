export type TelemetryLevel = "INFO" | "METRIC";
export type TelemetryDirection = "IN" | "OUT" | "INTERNAL";

type TelemetryRecord = {
  ts: string;
  level: TelemetryLevel;
  stage: string;
  direction: TelemetryDirection;
  name: string;
  values: Record<string, number | string | boolean>;
};

function emit(record: TelemetryRecord): void {
  console.log(JSON.stringify(record));
}

export function logIO(args: {
  stage: string;
  direction: TelemetryDirection;
  name: string;
  values: Record<string, number | string | boolean>;
}): void {
  emit({
    ts: new Date().toISOString(),
    level: "INFO",
    stage: args.stage,
    direction: args.direction,
    name: args.name,
    values: args.values,
  });
}

export function logMetric(args: {
  stage: string;
  name: string;
  values: Record<string, number | string | boolean>;
}): void {
  emit({
    ts: new Date().toISOString(),
    level: "METRIC",
    stage: args.stage,
    direction: "INTERNAL",
    name: args.name,
    values: args.values,
  });
}

/**
 * エラーを標準的な形式でかわいく記録するよっ！🛡️
 */
export function logError(args: {
  stage: string;
  name: string;
  error: unknown;
  context?: Record<string, number | string | boolean>;
}): void {
  const message =
    args.error instanceof Error ? args.error.message : String(args.error);
  emit({
    ts: new Date().toISOString(),
    level: "METRIC",
    stage: args.stage,
    direction: "INTERNAL",
    name: `${args.name}.error`,
    values: {
      message,
      ...(args.context ?? {}),
    },
  });
}

/**
 * 処理の実行時間を測って記録するよっ！⏱️✨
 */
export async function withTelemetry<T>(
  stage: string,
  name: string,
  fn: () => Promise<T>,
): Promise<T> {
  const start = performance.now();
  try {
    const result = await fn();
    const duration = performance.now() - start;
    logMetric({
      stage,
      name: `${name}.duration`,
      values: { ms: duration },
    });
    return result;
  } catch (error) {
    const duration = performance.now() - start;
    logError({ stage, name, error, context: { ms: duration } });
    throw error;
  }
}
