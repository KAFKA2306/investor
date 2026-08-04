import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

const scriptDirectory = dirname(fileURLToPath(import.meta.url));
const dashboardRoot = resolve(scriptDirectory, "..");

const activeSurfaceFiles = [
  "src/App.tsx",
  "src/features/StatusBar.tsx",
  "src/features/EvidenceRoom.tsx",
  "src/features/ProfessionalDataInspector.tsx",
  "src/features/ProfessionalResearchLog.tsx",
  "src/features/ProfessionalSecuritiesView.tsx",
  "src/features/ProfessionalSystemHealth.tsx",
  "src/features/ProfessionalValidationView.tsx",
  "src/components/AlphaValidationResults.tsx",
];

const forbiddenPhrases = [
  "だよぉ",
  "だよっ",
  "もんっ",
  "しちゃう",
  "お部屋",
  "全システム停止っ",
  "ready for deployment",
];

const decorativeEmoji = /\p{Extended_Pictographic}/u;
const failures = [];

for (const relativePath of activeSurfaceFiles) {
  const absolutePath = resolve(dashboardRoot, relativePath);
  const content = readFileSync(absolutePath, "utf8");

  for (const phrase of forbiddenPhrases) {
    if (content.toLowerCase().includes(phrase.toLowerCase())) {
      failures.push(`${relativePath}: forbidden phrase ${JSON.stringify(phrase)}`);
    }
  }

  const lines = content.split("\n");
  lines.forEach((line, index) => {
    if (decorativeEmoji.test(line)) {
      failures.push(`${relativePath}:${index + 1}: decorative emoji detected`);
    }
  });
}

if (failures.length > 0) {
  console.error("UI copy contract failed:\n");
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log(
  `UI copy contract passed for ${activeSurfaceFiles.length} active surface files.`,
);
