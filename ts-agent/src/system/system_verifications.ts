import { z } from "zod";
import { ApiVerifyGateway } from "../providers/unified_market_data_gateway.ts";

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
    status: z.enum(["PASS", "SKIP"]),
  }),
  kabucom: z.object({
    resultCode: z.number().int().optional(),
    orderId: z.string().optional(),
    status: z.enum(["PASS", "SKIP"]),
  }),
  edinet: z.object({
    documentsCount: z.number().int().optional(),
    status: z.enum(["PASS", "SKIP"]),
  }),
  estat: z.object({
    hasStatsData: z.boolean().optional(),
    status: z.enum(["PASS", "SKIP"]),
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

  const [jquants, kabucom, edinet, estat] = await Promise.all([
    targets.has("jquants")
      ? gateway
          .getJquantsListedInfo()
          .then((l) => ({ listedCount: l.length, status: "PASS" as const }))
      : { status: "SKIP" as const },
    { status: "SKIP" as const },
    { status: "SKIP" as const },
    targets.has("estat")
      ? gateway.getEstatStatsData("0000010101").then((r) => ({
          hasStatsData: "GET_STATS_DATA" in (r as Record<string, unknown>),
          status: "PASS" as const,
        }))
      : { status: "SKIP" as const },
  ]);

  return ApiVerificationReportSchema.parse({
    verifiedAt: new Date().toISOString(),
    jquants,
    kabucom,
    edinet,
    estat,
  });
}

if (import.meta.main) {
  runApiVerification().then((r) => console.log(JSON.stringify(r, null, 2)));
}
