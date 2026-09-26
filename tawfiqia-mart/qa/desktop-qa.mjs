// Desktop overflow + console-error sweep at 768/1024/1280/1440/1920.
import { chromium } from 'playwright-core';

const BASE = 'http://127.0.0.1:3909';
const WIDTHS = [768, 1024, 1280, 1440, 1920];
const PAGES = ['/', '/products', '/categories', '/brands', '/cart', '/login',
  '/contact', '/faq', '/vehicles', '/search?q=فلتر'];

const browser = await chromium.launch();
for (const w of WIDTHS) {
  const ctx = await browser.newContext({ viewport: { width: w, height: 900 }, locale: 'ar-EG' });
  for (const path of PAGES) {
    const page = await ctx.newPage();
    let errorCount = 0;
    page.on('pageerror', () => errorCount++);
    await page.goto(BASE + path, { waitUntil: 'domcontentloaded', timeout: 30000 }).catch(() => {});
    await page.waitForTimeout(400);
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - window.innerWidth,
    );
    console.log(`${w} ${overflow > 1 ? 'OVERFLOW!' : 'ok'} ov=${overflow} errs=${errorCount} ${path}`);
    await page.close();
  }
  await ctx.close();
}
await browser.close();
