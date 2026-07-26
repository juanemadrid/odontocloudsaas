import { chromium } from 'playwright';

(async () => {
    const browser = await chromium.launch();
    const page = await browser.newPage();

    // Set viewport to 1920x1080 for full desktop view
    await page.setViewportSize({ width: 1920, height: 1080 });

    try {
        console.log("Navigating to Home...");
        await page.goto('http://localhost:5173/');
        await page.waitForTimeout(3000); // Wait for animations
        await page.screenshot({ path: 'C:/Users/JoshuaGamingTV/.gemini/antigravity/brain/940623cc-9715-4da2-bdde-18b34fdcb73c/home_hero_fixed.png' });
        console.log("Captured Home Hero.");

        console.log("Navigating to Servicios...");
        await page.goto('http://localhost:5173/servicios');
        await page.waitForTimeout(3000);
        await page.screenshot({ path: 'C:/Users/JoshuaGamingTV/.gemini/antigravity/brain/940623cc-9715-4da2-bdde-18b34fdcb73c/servicios_clean.png', fullPage: true });
        console.log("Captured Servicios.");

        console.log("Navigating to Planes...");
        await page.goto('http://localhost:5173/planes');
        await page.waitForTimeout(3000);
        await page.screenshot({ path: 'C:/Users/JoshuaGamingTV/.gemini/antigravity/brain/940623cc-9715-4da2-bdde-18b34fdcb73c/planes_clean.png', fullPage: true });
        console.log("Captured Planes.");

    } catch (error) {
        console.error("Error capturing screenshots:", error);
    } finally {
        await browser.close();
    }
})();
