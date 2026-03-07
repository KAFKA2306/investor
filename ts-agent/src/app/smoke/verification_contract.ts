import { mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const root = mkdtempSync(join(tmpdir(), "investor-smoke-verification-"));
process.env.UQTL_VERIFICATION_ROOT = root;

const { paths } = await import("../../system/path_registry.ts");

mkdirSync(paths.verificationRoot, { recursive: true });
const plotFile = join(paths.verificationRoot, "smoke_plot.png");
writeFileSync(plotFile, "png", "utf8");

const payload = {
  fileName: "smoke_plot.png",
};

writeFileSync(paths.verificationJson, JSON.stringify(payload, null, 2), "utf8");

const parsed = JSON.parse(await Bun.file(paths.verificationJson).text()) as {
  fileName?: string;
};

if (!parsed.fileName) {
  throw new Error("verification contract missing fileName");
}

const referencedFile = join(paths.verificationRoot, parsed.fileName);
if (!(await Bun.file(referencedFile).exists())) {
  throw new Error(`verification contract target missing: ${referencedFile}`);
}

console.log(
  JSON.stringify(
    {
      ok: true,
      verificationJson: paths.verificationJson,
      fileName: parsed.fileName,
    },
    null,
    2,
  ),
);
