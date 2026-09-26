// Focused re-check after touch-target fixes: overflow + sub-24px targets
// on the pages whose footer/auth/filter components changed.
import { chromium } from 'playwright-core';

const BASE = 'http://127.0.0.1:3909';
const WIDTHS = [320, 390, 1280];
const PAGES = ['/', '/products', '/login', '/register', '/forgot-password',
  '/faq', '/contact', '/privacy', '/terms'];

const browser = await chromium.launch();
let bad = 0;
for (const w of WIDTHS) {
  const ctx = await browser.newContext({ viewport: { width: w, height: 844 }, locale: 'ar-EG', hasTouch: true });
  for (const path of PAGES) {
    const page = await ctx.newPage();
    await page.goto(BASE + path, { waitUntil: 'domcontentloaded', timeout: 30000 }).catch(() => {});
    await page.waitForTimeout(350);
    const r = await page.evaluate(() => {
      const ov = document.documentElement.scrollWidth - window.innerWidth;
      const small = [];
      document.querySelectorAll('button, a, [role="button"], input, select, textarea').forEach((el) => {
        const b = el.getBoundingClientRect();
        if (b.width === 0 || b.height === 0) return;
        // AA target minimum 24x24; exclude checkboxes wrapped by a >=32px label
        if (b.width < 24 || b.height < 24) {
          const label = el.closest('label');
          const lb = label && label.getBoundingClientRect();
          if (!(el.type === 'checkbox' && lb && lb.height >= 32 && lb.width >= 32)) {
            small.push(`${Math.round(b.width)}x${Math.round(b.height)} ${el.tagName} ${(el.innerText || el.getAttribute('aria-label') || el.type || '').trim().slice(0, 40)}`);
          }
        }
      });
      return { ov, small };
    });
    const status = r.ov > 1 || r.small.length ? 'FAIL' : 'ok';
    if (status === 'FAIL') bad++;
    console.log(`${w} ${status} ov=${r.ov} ${path}${r.small.length ? '\n   small: ' + r.small.join(' | ') : ''}`);
    await page.close();
  }
  await ctx.close();
}
await browser.close();
process.exit(bad ? 1 : 0);
