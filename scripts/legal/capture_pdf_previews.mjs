import fs from 'fs';
import path from 'path';
import { chromium } from 'playwright';

async function capturePreviews() {
  const baseDir = path.resolve('documentacion/odontocloud/ENTREGA-DEFINITIVA-EXPEDIENTE-2026/pdf');
  const outDir = path.resolve('documentacion/odontocloud/ENTREGA-DEFINITIVA-EXPEDIENTE-2026/capturas');
  fs.mkdirSync(outDir, { recursive: true });

  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  await page.setViewportSize({ width: 1200, height: 1600 });

  const pdfFiles = fs.readdirSync(baseDir).filter(f => f.endsWith('.pdf'));

  for (const f of pdfFiles) {
    const filePath = path.join(baseDir, f);
    const fileUrl = `file:///${filePath.replace(/\\/g, '/')}`;
    console.log(`Abriendo para captura: ${f}...`);
    try {
      await page.goto(fileUrl, { waitUntil: 'networkidle' });
      const imgPath = path.join(outDir, `${f}.png`);
      await page.screenshot({ path: imgPath, fullPage: true });
      console.log(`✓ Captura guardada: ${imgPath}`);
    } catch (err) {
      console.log(`Error capturando ${f}: ${err.message}`);
    }
  }

  await browser.close();
}

capturePreviews().catch(err => {
  console.error("Error:", err);
});
