import { chromium } from 'playwright-core';
const BASE='http://127.0.0.1:3909';
const browser=await chromium.launch();
for (const w of [320,390]) {
  const ctx=await browser.newContext({viewport:{width:w,height:800},isMobile:true,deviceScaleFactor:2,locale:'ar-EG'});
  for (const path of ['/','/products']) {
    const page=await ctx.newPage();
    await page.goto(BASE+path,{waitUntil:'networkidle',timeout:30000}).catch(()=>{});
    await page.waitForTimeout(300);
    const m=await page.evaluate(()=>{
      const de=document.documentElement, ov=de.scrollWidth-window.innerWidth;
      const small=[];
      document.querySelectorAll('a,button,[role=button]').forEach(el=>{
        const r=el.getBoundingClientRect(),st=getComputedStyle(el);
        if(r.width>0&&r.height>0&&st.visibility!=='hidden'&&(r.width<36||r.height<36)){
          small.push(`${Math.round(r.width)}x${Math.round(r.height)} ${el.tagName} ${(el.getAttribute('aria-label')||el.textContent||'').trim().slice(0,20)}`);
        }
      });
      return {ov,small:[...new Set(small)].slice(0,15)};
    });
    console.log(`${w} ${path} ov=${m.ov}`);
    m.small.forEach(s=>console.log('   small:',s));
    const safe=(path==='/'?'home':'products');
    await page.screenshot({path:`/home/user/qa/shots/${w}-${safe}.png`});
    await page.close();
  }
  await ctx.close();
}
await browser.close();
