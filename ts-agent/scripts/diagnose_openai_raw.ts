import { OpenAIThemeProvider } from "../src/providers/openai_theme_provider.ts";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

function loadEnv() {
    const envPath = join(process.cwd(), "..", ".env");
    if (existsSync(envPath)) {
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
    const provider = new OpenAIThemeProvider();

    // 🎀 Provier の内部で fetch を横取りして生のレスポンスを表示するよっ！✨
    const originalFetch = globalThis.fetch;
    globalThis.fetch = async (...args) => {
        const response = await originalFetch(...args);
        const clone = response.clone();
        const json = await clone.json();
        console.log("--- RAW LLM RESPONSE START ---");
        console.log(JSON.stringify(json, null, 2));
        console.log("--- RAW LLM RESPONSE END ---");
        return response;
    };

    try {
        await provider.propose({
            missionContext: "Verify GPT-5 Nano API connectivity and logic capability.",
            marketContext: "Japanese equities, high volatility regime.",
            existingThemes: [],
            forbiddenThemes: [],
            recentSuccesses: [],
            recentFailures: [],
            userIntent: "Test connectivity",
            inputChannel: "diag-script"
        });
    } catch (error) {
        // Ignore error here as we just want the raw response
    }
}

diagnose();
