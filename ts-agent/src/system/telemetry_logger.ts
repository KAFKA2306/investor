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
