import { test, expect } from '@playwright/test';
import { examples } from '../src/lib/examples';
import { readFileSync } from 'node:fs';
const securitySource=readFileSync('backend/src/main/java/com/diagramstudio/SecurityConfiguration.java','utf8');
const contentSecurityPolicy=securitySource.match(/policyDirectives\("([^"]+)"\)/)?.[1].match(/img-src[^;]+/)?.[0];
if(!contentSecurityPolicy)throw new Error('Could not read the application image security policy.');
test.beforeEach(async({page})=>{
  page.setDefaultTimeout(10000);
  // Exercise the exact packaged image directive. Vite's inline development preamble
  // needs a different script policy, so do not copy unrelated directives here.
  await page.route('**/*',async route=>{
    if(route.request().resourceType()!=='document'){await route.continue();return;}
    const response=await route.fetch();
    const headers=response.headers();
    await route.fulfill({response,headers:{...headers,'content-security-policy':headers['content-security-policy']||contentSecurityPolicy!}});
  });
});
test('guest exports portable SVG/PNG and reviews affected paths without losing edits',async({page})=>{
  await page.route('https://fonts.googleapis.com/**',route=>route.abort());
  await page.addInitScript(project=>localStorage.setItem('diagram-studio-v1',JSON.stringify(project)),examples.refund);
  await page.goto('/',{waitUntil:'domcontentloaded'});
  await page.getByRole('button',{name:'Export Diagram Image',exact:true}).click();
  await expect(page.getByAltText('Diagram export preview')).toBeVisible();
  await page.locator('#export-scope').selectOption('playback');await page.locator('#export-appearance').selectOption('dark');await page.getByLabel('Transparent Background').check();
  for(const format of ['SVG','PNG']){
    const pending=page.waitForEvent('download');await page.getByRole('button',{name:'Download '+format,exact:true}).click();const download=await pending;
    expect(download.suggestedFilename()).toMatch(new RegExp('\\.'+format.toLowerCase()+'$'));expect(await download.failure()).toBeNull();
    const stream=await download.createReadStream();const chunks:Buffer[]=[];for await(const chunk of stream!)chunks.push(Buffer.from(chunk));const bytes=Buffer.concat(chunks);
    if(format==='PNG'){expect(bytes.subarray(1,4).toString()).toBe('PNG');expect(bytes.readUInt32BE(16)).toBe(2880);}else{expect(bytes.toString()).toContain('Step 1 of');expect(bytes.toString()).not.toContain('<rect width="100%"');}
  }
  await page.getByRole('button',{name:'Close Dialog',exact:true}).click();
  await page.getByRole('tab',{name:'Editor',exact:true}).click();await page.locator('#label').fill('Updated refund entry');await page.locator('#label').press('Tab');
  await expect(page.getByRole('button',{name:'Review Scenario Impact'})).toBeVisible();await page.getByRole('button',{name:'Review Scenario Impact'}).click();
  await expect(page.locator('#reviews')).toContainText('Renamed');
  await page.locator('#review-step-0').selectOption('0');await expect(page.getByRole('tab',{name:'Playback',exact:true})).toHaveAttribute('aria-selected','true');
  await expect(page.locator('#timeline button[aria-current="step"]')).toContainText('Updated refund entry');
  await page.reload();await page.getByRole('button',{name:'Review Scenario Impact'}).click();await expect(page.locator('#reviews')).toContainText('Renamed');
  const first=page.locator('#reviews>li').first();const name=await first.locator('strong').innerText();await first.getByRole('button',{name:'Mark '+name+' Reviewed',exact:true}).click();
  await expect(page.locator('#reviews>li').filter({has:page.locator('strong',{hasText:name})})).toHaveCount(0);
  await page.locator('#undo').click();await expect(page.locator('#reviews')).toContainText(name);
});
test('export fits desktop and mobile and is available in guest playback',async({page})=>{
  await page.route('https://fonts.googleapis.com/**',route=>route.abort());
  await page.goto('/?walkthrough=cache-outage',{waitUntil:'domcontentloaded'});
  for(const width of [1440,1024,390]){
    await page.setViewportSize({width,height:900});
    const close=page.locator('#diagram-inspector.is-open').getByRole('button',{name:'Close Inspector',exact:true});if(await close.count())await close.click();
    await page.getByRole('button',{name:'Export Diagram Image',exact:true}).click();
    const dialog=page.getByRole('dialog');await expect(dialog).toBeVisible();expect(await dialog.evaluate(el=>el.scrollWidth<=el.clientWidth+1)).toBe(true);
    await expect(page.getByRole('button',{name:'Download PNG',exact:true})).toBeVisible();await page.screenshot({path:'.runtime/export-'+width+'.png'});await page.getByRole('button',{name:'Close Dialog',exact:true}).click();
    expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1)).toBe(true);
  }
});
