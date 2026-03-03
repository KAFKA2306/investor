import { OpenAIThemeProvider } from "../src/providers/openai_theme_provider.ts";
import { logger } from "../src/utils/logger.ts";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

// 🎀 環境変数を手動でロードするよっ！（Bun run の .env 自動読み込みが効かない場合用）✨
function loadEnv() {
    const envPath = join(process.cwd(), "..", ".env");
    if (existsSync(envPath)) {
        console.log(`📂 [Diagnostics] Loading .env from ${envPath}...`);
        const content = readFileSync(envPath, "utf8");
        for (const line of content.split("\n")) {
            const [key, ...rest] = line.split("=");
            if (key && rest.length > 0) {
                process.env[key.trim()] = rest.join("=").trim();
            }
        }
    }
}

async function diagnose() {
    loadEnv();

    console.log("🔍 [Diagnostics] Initializing OpenAIThemeProvider...");
    const provider = new OpenAIThemeProvider();

    if (!provider.isEnabled()) {
        console.error("❌ [Diagnostics] provider.isEnabled() is FALSE! Check OPENAI_API_KEY in .env");
        console.log("Current Keys:", Object.keys(process.env).filter(k => k.includes("OPENAI")));
        process.exit(1);
    }

    console.log("🚀 [Diagnostics] Requesting a novel alpha theme from gpt-5-nano...");

    try {
        const proposal = await provider.propose({
            missionContext: "Verify GPT-5 Nano API connectivity and logic capability.",
            marketContext: "Japanese equities, high volatility regime.",
            existingThemes: [],
            forbiddenThemes: [],
            recentSuccesses: [],
            recentFailures: [],
            userIntent: "Test connectivity",
            inputChannel: "diag-script"
        });

        console.log("\n✨ [SUCCESS] Received Proposal from GPT-5 Nano! ✨");
        console.log("--------------------------------------------------");
        console.log(`🏷️  Theme: ${proposal.theme}`);
        console.log(`🧪 Hypothesis: ${proposal.hypothesis}`);
        console.log(`🧬 Features: ${proposal.featureSignature.join(", ")}`);
        console.log(`🤖 Model used: ${proposal.model}`);
        console.log(`🔗 Source: ${proposal.source}`);
        console.log("--------------------------------------------------");
        console.log("🎉 gpt-5-nano は元気に動いてるみたいだよっ！💖");

    } catch (error) {
        console.error("\n❌ [FAILURE] API Request failed!");
        console.error(error);
        console.log("\n💡 ヒント: モデル名が間違っているか、まだ API で公開されていない可能性があるよっ！💢");
    }
}

diagnose();
