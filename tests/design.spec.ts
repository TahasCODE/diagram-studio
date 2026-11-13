import { test,expect } from '@playwright/test';
import { examples } from '../src/lib/examples';

for(const width of [1440,1024,390])test(`polished workspace remains usable at ${width}px in both themes`,async({page})=>{
  await page.setViewportSize({width,height:width===390?844:1000});
  await page.emulateMedia({reducedMotion:'reduce'});
  await page.goto('/');await expect(page.locator('.node')).toHaveCount(examples.refund.nodes.length);
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
  await expect(page.locator('.workspace-description')).toContainText(`${examples.refund.scenarios[0].steps.length} path steps`);
  await expect(page.locator('.workspace-description')).toContainText(`${examples.refund.nodes.length} diagram nodes`);
  await page.getByRole('button',{name:'Zoom In',exact:true}).click();await expect(page.getByRole('button',{name:'Reset Zoom'})).toHaveText('110%');
  await page.getByRole('button',{name:'Reset Zoom'}).click();await expect(page.getByRole('button',{name:'Reset Zoom'})).toHaveText('100%');
  await page.getByRole('button',{name:'Fit Diagram',exact:true}).click();
  if(width<1024)await page.getByRole('button',{name:'Open Inspector',exact:true}).click();
  await page.getByRole('tab',{name:'Editor',exact:true}).click();
  await page.locator('#project-title').fill('Presentation QA');await page.locator('#project-title').press('Tab');
  await expect(page.locator('#project-heading')).toHaveText('Presentation QA');
  await page.locator('#auto-arrange').click();
  await page.locator('#label').fill('QA selected node');await page.locator('#label').press('Tab');
  if(width<1024){await page.getByRole('button',{name:'Close Inspector',exact:true}).click();await expect(page.locator('#diagram-inspector')).toHaveAttribute('inert','');}
  await page.locator('#undo').click();await expect(page.locator('#project-heading')).toHaveText('Presentation QA');
  await expect(page.getByRole('button',{name:'Request refund',exact:true})).toBeVisible();
  await page.screenshot({path:`.runtime/design-${width}-light.png`,fullPage:true,animations:'disabled'});
  await page.locator('#theme-toggle').click();await expect(page.locator('html')).toHaveAttribute('data-theme','dark');
  await page.screenshot({path:`.runtime/design-${width}-dark.png`,fullPage:true,animations:'disabled'});
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
  await page.keyboard.press('Control+s');await expect(page.getByRole('dialog')).toBeVisible();
});

test('mobile inspector traps focus, closes with Escape and keeps canvas data intact',async({page})=>{
  await page.setViewportSize({width:390,height:844});await page.goto('/');
  await page.getByRole('button',{name:'Open Inspector',exact:true}).click();
  await expect(page.getByRole('button',{name:'Close Inspector',exact:true})).toBeFocused();
  await page.keyboard.press('Shift+Tab');
  expect(await page.evaluate(()=>!!document.activeElement?.closest('#diagram-inspector'))).toBe(true);
  await page.keyboard.press('Escape');await expect(page.locator('#diagram-inspector')).toHaveAttribute('inert','');
  await expect(page.locator('.node')).toHaveCount(examples.refund.nodes.length);
});

test('notifications repeat, dismiss and pause their timeout while focused',async({page})=>{
  await page.clock.install();await page.goto('/');
  await page.getByRole('tab',{name:'Project',exact:true}).click();
  const firstDownload=page.waitForEvent('download');await page.locator('#export-project').click();await firstDownload;
  await expect(page.locator('.notice-bar')).toContainText('Project file exported.');
  await page.getByRole('button',{name:'Dismiss Notification'}).click();await expect(page.locator('.notice-bar')).toHaveCount(0);
  const nextDownload=page.waitForEvent('download');await page.locator('#export-project').click();await nextDownload;
  await expect(page.locator('.notice-bar')).toContainText('Project file exported.');
  await page.getByRole('button',{name:'Dismiss Notification'}).focus();
  await page.clock.runFor(8000);await expect(page.locator('.notice-bar')).toBeVisible();
  await page.screenshot({path:'.runtime/design-toast.png',animations:'disabled'});
  await page.locator('#export-project').focus();await page.clock.runFor(7100);
  await expect(page.locator('.notice-bar')).toHaveCount(0);
});
