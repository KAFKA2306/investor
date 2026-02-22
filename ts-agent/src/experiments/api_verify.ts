import { z } from "zod";
import { EdinetProvider } from "../providers/edinet.ts";
import { EstatProvider } from "../providers/estat.ts";
import { JQuantsProvider } from "../providers/jquants.ts";
import { KabucomProvider } from "../providers/kabucom.ts";
import { KabuOrderSchema, KabuResponseSchema } from "../schemas/kabucom.ts";

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
  const provider = new JQuantsProvider();
  const listed = await provider.getListedInfo();
  const validated = z.array(z.unknown()).parse(listed);
  return {
    listedCount: validated.length,
    status: "PASS",
  };
}

async function verifyKabucomApi(): Promise<{
  resultCode: number;
  orderId: string | undefined;
  status: "PASS";
}> {
  const provider = new KabucomProvider();
  const order = KabuOrderSchema.parse({
    symbol: "7203",
    side: "2",
    orderType: 1,
    qty: 100,
  });
  const response = await provider.placeOrder(order);
  const validated = KabuResponseSchema.parse(response);
  return {
    resultCode: validated.ResultCode,
    orderId: validated.OrderId,
    status: "PASS",
  };
}

async function verifyEdinetApi(): Promise<{
  documentsCount: number;
  status: "PASS";
}> {
  const provider = new EdinetProvider();
  const documents = await provider.getDocuments(
    new Date().toISOString().slice(0, 10),
  );
  const validated = z.array(z.unknown()).parse(documents);
  return {
    documentsCount: validated.length,
    status: "PASS",
  };
}

async function verifyEstatApi(): Promise<{
  hasStatsData: boolean;
  status: "PASS";
}> {
  const provider = new EstatProvider();
  const response = await provider.getStats("0000010101");
  const validated = z.record(z.string(), z.unknown()).parse(response);
  return {
    hasStatsData: "GET_STATS_DATA" in validated,
    status: "PASS",
  };
}

function parseVerifyTargets(): Set<VerifyTarget> {
  return new Set(VerifyTargetsSchema.parse(process.env["VERIFY_TARGETS"]));
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
