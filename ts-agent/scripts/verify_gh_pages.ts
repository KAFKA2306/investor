import { chromium } from 'playwright';

(async () => {
    const browser = await chromium.launch({ headless: true });
    const page = await browser.newPage();

    page.on('console', msg => console.log(`BROWSER CONSOLE: ${msg.text()}`));

    const url = 'https://kafka2306.github.io/investor/';
    console.log(`🚀 Navigating to GitHub Pages: ${url}`);

    try {
        await page.goto(url, { waitUntil: 'networkidle', timeout: 60000 });
        console.log('✅ Page loaded!');

        // Wait for page to be ready
        await page.waitForTimeout(5000);

        const tabs = [
            { name: 'Evidence', label: '証拠のお部屋✨', file: 'gh_pages_evidence.png' },
            { name: 'Health', label: 'システムの健康診断🏥', file: 'gh_pages_health.png' },
            { name: 'Backtest', label: '解析するよっ！📊', file: 'gh_pages_backtest.png' }
        ];

        for (const tab of tabs) {
            console.log(`🔍 Checking Tab: ${tab.name}`);
            const btn = page.locator('button', { hasText: tab.label });
            if (await btn.isVisible()) {
                await btn.click();
                await page.waitForTimeout(3000);
                await page.screenshot({ path: `/root/.gemini/antigravity/brain/ffd09d3a-9247-4f5c-a7c7-3d414fc00e06/${tab.file}`, fullPage: true });
                console.log(`✅ Captured ${tab.name}`);
            } else {
                console.log(`⚠️ Tab button not found: ${tab.label}`);
            }
        }

    } catch (e) {
        console.log('❌ Failed to verify GitHub Pages:', (e as Error).message);
        await page.screenshot({ path: '/root/.gemini/antigravity/brain/ffd09d3a-9247-4f5c-a7c7-3d414fc00e06/gh_pages_error.png' });
    }

    await browser.close();
    console.log('🎉 Verification process finished!');
})();
