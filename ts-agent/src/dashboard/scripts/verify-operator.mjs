import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const files = {
  html: path.join(root, "public/operator/index.html"),
  css: path.join(root, "public/operator/operator.css"),
  js: path.join(root, "public/operator/operator.js"),
};

for (const file of Object.values(files)) {
  if (!fs.existsSync(file)) {
    throw new Error(`missing ${file}`);
  }
}

const html = fs.readFileSync(files.html, "utf8");
const css = fs.readFileSync(files.css, "utf8");
const js = fs.readFileSync(files.js, "utf8");

for (const marker of [
  'id="queues"',
  'data-queue-grid="attention"',
  'data-queue-grid="oos"',
  'data-queue-grid="review"',
  'data-queue-grid="rejected"',
  'id="risk"',
  'id="evidence"',
  'href="/"',
  "再現コマンド",
  "正式評価",
]) {
  if (!html.includes(marker)) {
    throw new Error(`HTML missing ${marker}`);
  }
}

for (const marker of [
  "const queues",
  "function queueFor",
  "function missingConditions",
  "function nextGate",
  "function evidenceLinks",
  "new URLSearchParams(location.search)",
  "history.replaceState",
  "/api/evidence",
]) {
  if (!js.includes(marker)) {
    throw new Error(`JS missing ${marker}`);
  }
}

for (const marker of [
  ".queue-attention",
  ".queue-oos",
  ".queue-review",
  ".queue-rejected",
  "min-height:44px",
  "@media(max-width:700px)",
  "@media(prefers-reduced-motion:reduce)",
]) {
  if (!css.replaceAll(" ", "").includes(marker.replaceAll(" ", ""))) {
    throw new Error(`CSS missing ${marker}`);
  }
}

console.log("operator_queue_contract=PASS");
