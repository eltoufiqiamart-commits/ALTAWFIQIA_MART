import { chromium } from 'playwright-core';

const BASE = 'http://127.0.0.1:3909';
const WIDTHS = [320, 360, 375, 390, 414, 1280];
const PAGES = ['/', '/products', '/search?q=فلتر', '/categories', '/brands', '/cart',
  '/login', '/register', '/contact', '/faq', '/shipping', '/returns', '/vehicles',
  '/terms', '/privacy', '/forgot-password'];

const browser = await chromium.launch();
const results = [];
const errors = [];
for (const w of WIDTHS) {
  const h = w >= 768 ? 900 : 800;
  const ctx = await browser.newContext({ viewport: { width: w, height: h }, isMobile: w < 768, deviceScaleFactor: w < 768 ? 2 : 1, locale: 'ar-EG' });
  ctx.on('pageerror', (e) => errors.push(`${w} pageerror: ${e.message}`));
  for (const path of PAGES) {
    const page = await ctx.newPage();
    const consoleErrors = [];
    page.on('console', (m) => { if (m.type() === 'error') consoleErrors.push(m.text().slice(0, 200)); });
    page.on('pageerror', (e) => consoleErrors.push('PAGEERROR ' + e.message.slice(0, 200)));
    await page.goto(BASE + path, { waitUntil: 'networkidle', timeout: 30000 }).catch(() => {});
    await page.waitForTimeout(400);
    const metrics = await page.evaluate(() => {
      const de = document.documentElement;
      const overflow = de.scrollWidth - window.innerWidth;
      const small = [];
      document.querySelectorAll('a, button, input[type=checkbox], input[type=radio], [role=button]').forEach((el) => {
        const r = el.getBoundingClientRect();
        const st = getComputedStyle(el);
        if (r.width > 0 && r.height > 0 && st.visibility !== 'hidden' && (r.width < 36 || r.height < 36)) {
          const label = (el.getAttribute('aria-label') || el.textContent || '').trim().slice(0, 28);
          small.push(`${Math.round(r.width)}x${Math.round(r.height)} ${el.tagName} ${label}`);
        }
      });
      return { overflow, small: small.slice(0, 12), title: document.title, dir: document.documentElement.dir };
    });
    results.push({ w, path, ...metrics, consoleErrors: [...new Set(consoleErrors)].slice(0, 3) });
    if (w === 320 || w === 390) {
      const safe = path.replace(/[\/?=]/g, '_').replace(/^_/, '') || 'home';
      await page.screenshot({ path: `/home/user/qa/shots/${w}-${safe}.png`, fullPage: false });
    }
    await page.close();
  }
  await ctx.close();
}
await browser.close();
for (const r of results) {
  const flag = r.overflow > 1 ? 'OVERFLOW!' : 'ok';
  console.log(`${r.w} ${flag.padEnd(9)} ov=${r.overflow} dir=${r.dir} ${r.path}${r.small.length ? ' small: ' + r.small.slice(0,4).join(' | ') : ''}`);
  r.consoleErrors.forEach((e) => console.log(`   console: ${e}`));
}
errors.forEach((e) => console.log('GLOBAL', e));
