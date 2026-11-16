import { test, expect } from '@playwright/test';
import { examples } from '../src/lib/examples';
test.beforeEach(async({page})=>{
  await page.route('https://fonts.googleapis.com/**',route=>route.abort());
  page.setDefaultTimeout(10000);
});
test('guest presents, navigates, switches paths and exits without editing the draft',async({page})=>{
  await page.addInitScript(project=>localStorage.setItem('diagram-studio-v1',JSON.stringify(project)),examples.refund);
  await page.goto('/',{waitUntil:'domcontentloaded'});
  await expect(page.locator('.header-context')).toHaveText('Personal Workspace');
  const draft=await page.evaluate(()=>localStorage.getItem('diagram-studio-v1'));
  await page.getByRole('button',{name:'Present Diagram',exact:true}).click();
  const presentation=page.getByRole('dialog',{name:examples.refund.title});
  await expect(presentation).toBeVisible();await expect(page.locator('#label')).not.toBeVisible();
  if(await page.evaluate(()=>document.fullscreenEnabled)){
    await page.getByRole('button',{name:'Full Screen',exact:true}).click();
    await expect.poll(()=>page.evaluate(()=>document.fullscreenElement?.classList.contains('presentation-surface'))).toBe(true);
    await page.getByRole('button',{name:'Exit Full Screen',exact:true}).click();
    await expect.poll(()=>page.evaluate(()=>document.fullscreenElement===null)).toBe(true);
  }
  await page.keyboard.press('ArrowRight');await expect(page.locator('#step')).toContainText('2 /');
  await page.keyboard.press('Home');await expect(page.locator('#step')).toContainText('1 /');
  await page.locator('#scenario').selectOption('1');await expect(page.locator('#step')).toContainText('1 /');
  await page.getByRole('button',{name:'Next Step',exact:true}).click();await expect(page.locator('#step')).toContainText('2 /');
  await page.getByRole('button',{name:'Restart',exact:true}).click();await expect(page.locator('#step')).toContainText('1 /');
  await page.keyboard.press('Escape');await expect(presentation).not.toBeVisible();
  await expect(page.getByRole('button',{name:'Present Diagram',exact:true})).toBeFocused();
  expect(await page.evaluate(()=>localStorage.getItem('diagram-studio-v1'))).toBe(draft);
  await page.getByRole('button',{name:'Present Diagram',exact:true}).click();await page.getByRole('button',{name:'Exit Presentation',exact:true}).click();await expect(page.locator('.presentation')).toHaveCount(0);
});
test('presentation keeps both guided choices gated, supports restart and fits light/dark layouts',async({page})=>{
  await page.goto('/?walkthrough=cache-outage',{waitUntil:'domcontentloaded'});
  await page.getByRole('button',{name:'Present Diagram',exact:true}).click();
  for(const choice of ['Fall back to PostgreSQL','Return a temporary error']){
    await page.getByRole('button',{name:'Start Walkthrough',exact:true}).click();
    for(let i=0;i<3;i++)await page.keyboard.press('ArrowRight');
    await expect(page.locator('#next')).toBeDisabled();await page.keyboard.press('ArrowRight');await expect(page.locator('#step')).toContainText('4 /');
    await page.locator('.walkthrough-choices button').filter({hasText:choice}).click();
    await expect(page.locator('#step')).toContainText('5 /');
    await page.locator('#next').click();await expect(page.locator('.walkthrough-outcome')).toBeVisible();
    await page.getByRole('button',{name:'Restart Walkthrough',exact:true}).click();
  }
  for(const width of [1440,1024,390]){
    await page.setViewportSize({width,height:900});
    for(const theme of ['light','dark']){
      await page.evaluate(theme=>document.documentElement.dataset.theme=theme,theme);
      await expect(page.getByRole('button',{name:'Start Walkthrough',exact:true})).toBeVisible();
      const dialog=page.locator('.presentation');expect(await dialog.evaluate(el=>el.scrollWidth<=el.clientWidth+1)).toBe(true);
      await expect(page.locator('.presentation .node:not(.active)').first()).toHaveCSS('background-color',theme==='dark'?'rgb(25, 37, 30)':'rgb(255, 255, 255)');
      await page.screenshot({animations:'disabled',path:'.runtime/presentation-'+width+'-'+theme+'.png'});
    }
  }
});
