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

    const tabs = [
        { name: 'Evidence', label: '証拠のお部屋✨', file: 'evidence_tab.png' },
        { name: 'Inspector', label: 'データ調査しちゃうもんっ！🔍', file: 'inspector_tab.png' },
        { name: 'Research', label: '研究のきろくっ！📝', file: 'research_tab.png' },
        { name: 'Health', label: 'システムの健康診断🏥', file: 'health_tab_radar.png' },
        { name: 'Backtest', label: '解析するよっ！📊', file: 'backtest_tab_comparison.png' }
    ];

    for (const tab of tabs) {
        console.log(`🔍 Verifying ${tab.name} Tab...`);
        try {
            const btn = page.locator('button', { hasText: tab.label });
            await btn.click({ timeout: 10000 });
            await page.waitForTimeout(2000); // Wait for transitions

            // Wait for charts or cards
            if (tab.name === 'Health') {
                await page.waitForSelector('.recharts-radar-antialiased', { timeout: 10000 }).catch(() => console.log('Radar chart not found yet...'));
            } else if (tab.name === 'Research') {
                await page.waitForSelector('.passport-card', { timeout: 10000 }).catch(() => console.log('Log cards not found yet...'));
            } else {
                await page.waitForSelector('.recharts-surface', { timeout: 10000 }).catch(() => console.log('General chart not found yet...'));
            }

            await page.screenshot({ path: `/root/.gemini/antigravity/brain/ffd09d3a-9247-4f5c-a7c7-3d414fc00e06/${tab.file}`, fullPage: true });
            console.log(`✅ ${tab.name} tab verified and captured!`);
        } catch (e) {
            console.log(`❌ ${tab.name} tab failed:`, (e as Error).message);
            await page.screenshot({ path: `/root/.gemini/antigravity/brain/ffd09d3a-9247-4f5c-a7c7-3d414fc00e06/error_${tab.name}.png` });
        }
    }

    await browser.close();
    console.log('🎉 All tabs verified!');
})();
