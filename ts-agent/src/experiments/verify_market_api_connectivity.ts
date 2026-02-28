import { z } from "zod";
import { ApiVerifyGateway } from "../providers/unified_market_data_gateway.ts";

const VerifyTargetSchema = z.enum(["jquants", "kabucom", "edinet", "estat"]);
type VerifyTarget = z.infer<typeof VerifyTargetSchema>;

const VerifyTargetsSchema = z
  .string()
  .optional()
  .transform((value) => value ?? "jquants,kabucom,edinet,estat")
  .transform((value) =>
    value
      .split(",")
      .map((item) => item.trim().toLowerCase())
      .filter((item) => item.length > 0),
  )
  .pipe(z.array(VerifyTargetSchema).nonempty());

const ApiVerificationReportSchema = z.object({
  verifiedAt: z.string(),
  jquants: z.object({
    listedCount: z.number().int().nonnegative().optional(),
    status: z.enum(["PASS", "SKIP"]),
  }),
  kabucom: z.object({
    resultCode: z.number().int().optional(),
    orderId: z.string().optional(),
    status: z.enum(["PASS", "SKIP"]),
  }),
  edinet: z.object({
    documentsCount: z.number().int().nonnegative().optional(),
    status: z.enum(["PASS", "SKIP"]),
  }),
  estat: z.object({
    hasStatsData: z.boolean().optional(),
    status: z.enum(["PASS", "SKIP"]),
  }),
});

type ApiVerificationReport = z.infer<typeof ApiVerificationReportSchema>;

async function verifyJQuantsApi(): Promise<{
  listedCount: number;
  status: "PASS";
}> {
  const gateway = new ApiVerifyGateway();
  const listed = await gateway.getJquantsListedInfo();
  const validated = z.array(z.unknown()).parse(listed);
  return {
    listedCount: validated.length,
    status: "PASS",
  };
}

async function verifyKabucomApi(): Promise<{
  status: "SKIP";
}> {
  return { status: "SKIP" };
}

async function verifyEdinetApi(): Promise<{
  status: "SKIP";
}> {
  return { status: "SKIP" };
}

async function verifyEstatApi(): Promise<{
  hasStatsData: boolean;
  status: "PASS";
}> {
  const gateway = new ApiVerifyGateway();
  const response = await gateway.getEstatStatsData("0000010101");
  const validated = z.record(z.string(), z.unknown()).parse(response);
  return {
    hasStatsData: "GET_STATS_DATA" in validated,
    status: "PASS",
  };
}

function parseVerifyTargets(): Set<VerifyTarget> {
  const env = z
    .object({ VERIFY_TARGETS: z.string().optional() })
    .parse(process.env);
  return new Set(VerifyTargetsSchema.parse(env.VERIFY_TARGETS));
}

export async function runApiVerification(): Promise<ApiVerificationReport> {
  const targets = parseVerifyTargets();
  const [jquants, kabucom, edinet, estat] = await Promise.all([
    targets.has("jquants")
      ? verifyJQuantsApi()
      : Promise.resolve({ status: "SKIP" as const }),
    targets.has("kabucom")
      ? verifyKabucomApi()
      : Promise.resolve({ status: "SKIP" as const }),
    targets.has("edinet")
      ? verifyEdinetApi()
      : Promise.resolve({ status: "SKIP" as const }),
    targets.has("estat")
      ? verifyEstatApi()
      : Promise.resolve({ status: "SKIP" as const }),
  ]);
  return ApiVerificationReportSchema.parse({
    verifiedAt: new Date().toISOString(),
    jquants,
    kabucom,
    edinet,
    estat,
  });
}

const runAsMain = import.meta.main;
runAsMain &&
  runApiVerification().then((report) => {
    console.log(JSON.stringify(report, null, 2));
  });
