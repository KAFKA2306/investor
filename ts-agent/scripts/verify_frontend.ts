import { chromium } from 'playwright';

(async () => {
    const browser = await chromium.launch({ headless: true });
    const page = await browser.newPage();

    page.on('console', msg => console.log(`BROWSER CONSOLE: ${msg.text()}`));

    console.log('🚀 Navigating to Dashboard...');
    try {
        await page.goto('http://localhost:5173/investor/', { waitUntil: 'load', timeout: 30000 });
        console.log('✅ Dashboard reached!');
    } catch (e) {
        console.log('❌ Failed to load dashboard:', (e as Error).message);
        await browser.close();
        process.exit(1);
    }

    // Wait for the evidence tab to show up (default)
    console.log('📊 Verifying Financial Chart (Recharts)...');
    try {
        await page.waitForSelector('.recharts-surface', { timeout: 20000 });
        console.log('✅ Chart rendered successfully!');
        await page.screenshot({ path: '/root/.gemini/antigravity/brain/ffd09d3a-9247-4f5c-a7c7-3d414fc00e06/evidence_recharts_migration.png', fullPage: true });
    } catch (e) {
        console.log('❌ Chart rendering failed:', (e as Error).message);
    }

    console.log('🔍 Navigating to Research Tab...');
    try {
        // Use exact label from StatusBar.tsx
        const researchBtn = page.locator('button', { hasText: '研究のきろくっ！📝' });
        await researchBtn.click({ timeout: 10000 });
        console.log('✅ Clicked Research tab!');

        // Wait for cards
        await page.waitForSelector('.passport-card', { timeout: 30000 });
        console.log('✅ Research logs loaded!');

        await page.screenshot({ path: '/root/.gemini/antigravity/brain/ffd09d3a-9247-4f5c-a7c7-3d414fc00e06/evidence_historical_logs.png', fullPage: true });

        const logCards = await page.$$('.passport-card');
        console.log(`✅ Found ${logCards.length} log cards in the view.`);
    } catch (e) {
        console.log('❌ Research logs failed:', (e as Error).message);
        await page.screenshot({ path: '/root/.gemini/antigravity/brain/ffd09d3a-9247-4f5c-a7c7-3d414fc00e06/error_research_logs.png', fullPage: true });
    }

    await browser.close();
})();
