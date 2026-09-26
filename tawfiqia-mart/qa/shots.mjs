import { chromium } from 'playwright-core';
const b=await chromium.launch();
for (const [w,h,m] of [[320,800,true],[1280,900,false]]) {
  const ctx=await b.newContext({viewport:{width:w,height:h},isMobile:m,deviceScaleFactor:m?2:1,locale:'ar-EG'});
  const p=await ctx.newPage();
  await p.goto('http://127.0.0.1:3909/',{waitUntil:'networkidle',timeout:30000}).catch(()=>{});
  await p.waitForTimeout(400);
  await p.screenshot({path:`/home/user/qa/shots/home-${w}.png`});
  await ctx.close();
}
await b.close();
console.log('done');
