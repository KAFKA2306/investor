import { z } from "zod";
import { ApiVerifyGateway } from "../providers/unified_market_data_gateway.ts";
import { QualityGateSchema } from "../schemas/system_event_schemas.ts";
import { writeCanonicalEnvelope } from "./app_runtime_core.ts";

/**
 * API Connectivity Verification
 */
const VerifyTargetSchema = z.enum(["jquants", "kabucom", "edinet", "estat"]);

const VerifyTargetsSchema = z
  .string()
  .optional()
  .transform((v) => v ?? "jquants,kabucom,edinet,estat")
  .transform((v) =>
    v
      .split(",")
      .map((i) => i.trim().toLowerCase())
      .filter((i) => i.length > 0),
  )
  .pipe(z.array(VerifyTargetSchema).nonempty());

export const ApiVerificationReportSchema = z.object({
  verifiedAt: z.string(),
  jquants: z.object({
    listedCount: z.number().int().optional(),
    status: z.enum(["PASS", "SKIP", "FAIL"]),
    reason: z.string().optional(),
  }),
  kabucom: z.object({
    resultCode: z.number().int().optional(),
    orderId: z.string().optional(),
    status: z.enum(["PASS", "SKIP", "FAIL"]),
    reason: z.string().optional(),
  }),
  edinet: z.object({
    documentsCount: z.number().int().optional(),
    status: z.enum(["PASS", "SKIP", "FAIL"]),
    reason: z.string().optional(),
  }),
  estat: z.object({
    hasStatsData: z.boolean().optional(),
    status: z.enum(["PASS", "SKIP", "FAIL"]),
    reason: z.string().optional(),
  }),
});

export async function runApiVerification(): Promise<
  z.infer<typeof ApiVerificationReportSchema>
> {
  const env = z
    .object({ VERIFY_TARGETS: z.string().optional() })
    .parse(process.env);
  const targets = new Set(VerifyTargetsSchema.parse(env.VERIFY_TARGETS));
  const gateway = new ApiVerifyGateway();

  const verifyJquants = targets.has("jquants")
    ? gateway
        .getJquantsListedInfo()
        .then((l) => ({ listedCount: l.length, status: "PASS" as const }))
        .catch((error: unknown) => ({
          status: "FAIL" as const,
          reason: error instanceof Error ? error.message : String(error),
        }))
    : Promise.resolve({ status: "SKIP" as const });

  const verifyEstat = targets.has("estat")
    ? gateway
        .getEstatStatsData("0000010101")
        .then((r) => ({
          hasStatsData: "GET_STATS_DATA" in (r as Record<string, unknown>),
          status: "PASS" as const,
        }))
        .catch((error: unknown) => ({
          status: "FAIL" as const,
          reason: error instanceof Error ? error.message : String(error),
        }))
    : Promise.resolve({ status: "SKIP" as const });

  const [jquants, kabucom, edinet, estat] = await Promise.all([
    verifyJquants,
    { status: "SKIP" as const },
    { status: "SKIP" as const },
    verifyEstat,
  ]);

  return ApiVerificationReportSchema.parse({
    verifiedAt: new Date().toISOString(),
    jquants,
    kabucom,
    edinet,
    estat,
  });
}

export function deriveQualityGateFromVerification(
  report: z.infer<typeof ApiVerificationReportSchema>,
) {
  const targets = [report.jquants, report.estat];
  const passRatio =
    targets.filter((item) => item.status === "PASS").length / targets.length;

  const components = {
    dataConnectivity: Math.round(passRatio * 100),
    dataAvailability:
      report.jquants.status === "PASS" && report.estat.status === "PASS"
        ? 100
        : report.jquants.status === "FAIL" || report.estat.status === "FAIL"
          ? 0
          : 50,
    executionObservability: 60,
    reproducibility: 70,
  };
  const weightedScore = Math.round(
    components.dataConnectivity * 0.35 +
      components.dataAvailability * 0.35 +
      components.executionObservability * 0.15 +
      components.reproducibility * 0.15,
  );
  const verdict =
    weightedScore >= 75
      ? "READY"
      : weightedScore >= 50
        ? "CAUTION"
        : "NOT_READY";

  return QualityGateSchema.parse({
    verdict,
    score: weightedScore,
    components,
    derivedFrom: ["api_verification:jquants", "api_verification:estat"],
    generatedAt: new Date().toISOString(),
  });
}

export async function runAndPersistQualityGate() {
  const verification = await runApiVerification();
  const qualityGate = deriveQualityGateFromVerification(verification);
  const asOfDate = qualityGate.generatedAt.slice(0, 10).replaceAll("-", "");

  writeCanonicalEnvelope({
    kind: "quality_gate",
    asOfDate,
    generatedAt: qualityGate.generatedAt,
    producerComponent: "system.system_verifications.runAndPersistQualityGate",
    sourceSchema: "investor.api-verification.v1",
    sourceBucket: "unified",
    derived: true,
    payload: {
      ...qualityGate,
      connectivity: {
        jquants: {
          status: verification.jquants.status,
          listedCount: verification.jquants.listedCount,
        },
        estat: {
          status: verification.estat.status,
          hasStatsData: verification.estat.hasStatsData,
        },
        kabucom: {
          status: verification.kabucom.status,
        },
        edinet: {
          status: verification.edinet.status,
        },
      },
    },
  });

  return { verification, qualityGate };
}

if (import.meta.main) {
  runAndPersistQualityGate().then((r) =>
    console.log(JSON.stringify(r, null, 2)),
  );
}
