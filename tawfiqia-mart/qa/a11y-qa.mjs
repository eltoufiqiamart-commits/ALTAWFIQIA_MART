// Lightweight accessibility checks (no external rules engine):
// html lang/dir, single h1, heading order, labeled controls,
// named buttons/links, image alt.
import { chromium } from 'playwright-core';

const BASE = 'http://127.0.0.1:3909';
const PAGES = ['/', '/products', '/categories', '/brands', '/cart', '/login',
  '/register', '/contact', '/faq', '/vehicles', '/forgot-password',
  '/shipping', '/returns', '/terms', '/privacy', '/about', '/reset-password', '/order-success', '/search?q=%D9%81%D9%84%D8%AA%D8%B1'];

const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, locale: 'ar-EG' });
let findings = 0;
for (const path of PAGES) {
  const page = await ctx.newPage();
  await page.goto(BASE + path, { waitUntil: 'domcontentloaded', timeout: 30000 }).catch(() => {});
  await page.waitForTimeout(400);
  const issues = await page.evaluate(() => {
    const out = [];
    const html = document.documentElement;
    if (html.getAttribute('dir') !== 'rtl') out.push('html[dir]!=rtl');
    if (!(html.getAttribute('lang') || '').startsWith('ar')) out.push('html[lang]!=ar');
    const h1 = document.querySelectorAll('h1');
    if (h1.length !== 1) out.push(`h1 count=${h1.length}`);
    let prev = 1;
    document.querySelectorAll('h1,h2,h3,h4,h5,h6').forEach((h) => {
      const l = +h.tagName[1];
      if (l > prev + 1) out.push(`heading skip h${prev}->h${l}`);
      prev = l;
    });
    document.querySelectorAll('button, [role="button"]').forEach((el) => {
      const name = (el.innerText || el.getAttribute('aria-label') || '').trim();
      if (!name && !el.querySelector('svg title')) out.push(`unnamed button ${el.className}`.slice(0, 80));
    });
    document.querySelectorAll('a').forEach((el) => {
      const name = (el.innerText || el.getAttribute('aria-label') || '').trim();
      const hasImgAlt = [...el.querySelectorAll('img')].every((i) => (i.alt || '').trim());
      if (!name && !hasImgAlt) out.push(`unnamed link ${el.getAttribute('href')}`);
    });
    document.querySelectorAll('input, select, textarea').forEach((el) => {
      const id = el.id && document.querySelector(`label[for="${el.id}"]`);
      const wrapped = el.closest('label');
      const aria = el.getAttribute('aria-label') || el.getAttribute('aria-labelledby') || el.placeholder;
      const type = el.getAttribute('type');
      if (type !== 'hidden' && !id && !wrapped && !aria) out.push(`unlabeled ${el.name || type}`);
    });
    document.querySelectorAll('img').forEach((el) => {
      if (!el.hasAttribute('alt')) out.push(`img without alt: ${(el.src || '').slice(0, 60)}`);
    });
    return out;
  });
  if (issues.length) {
    findings += issues.length;
    console.log(`${path}: ${issues.length} finding(s)`);
    issues.slice(0, 8).forEach((i) => console.log('   - ' + i));
  } else {
    console.log(`${path}: clean`);
  }
  await page.close();
}
await ctx.close();
await browser.close();
console.log(`\nTOTAL FINDINGS: ${findings}`);
process.exit(findings ? 1 : 0);
