import {test,expect} from './fixtures/ownedProject';

test('header logout sits next to save status, is usable on mobile, and preserves the local diagram',async({page,ownedProject:project})=>{
  await page.setViewportSize({width:1440,height:1000});await page.goto('/');
  const logout=page.getByRole('button',{name:'Log Out',exact:true});await expect(logout).toBeVisible();
  expect(await page.locator('#save-state').evaluate(el=>el.nextElementSibling?.id)).toBe('header-logout');
  await page.getByRole('tab',{name:'Editor',exact:true}).click();await page.locator('#project-title').fill('Keep my local work');await page.locator('#project-title').press('Tab');
  await expect(page.locator('#save-state')).toHaveText('Saved Locally');
  const local=await page.evaluate(()=>JSON.parse(localStorage.getItem('diagram-studio-v1')!));
  for(const width of [1440,1024,390,320]){
    await page.setViewportSize({width,height:1000});await expect(logout).toBeVisible();
    expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
  }
  await logout.click();const confirmation=page.getByRole('dialog',{name:'Sign Out',exact:true});
  await confirmation.getByRole('button',{name:'Cancel',exact:true}).click();await expect(logout).toBeVisible();
  await logout.click();await confirmation.getByRole('button',{name:'Continue',exact:true}).click();
  await expect(page.locator('#sign-in')).toBeVisible();await expect(logout).toHaveCount(0);await expect(page.getByRole('button',{name:'Account Settings',exact:true})).toHaveCount(0);
  expect((await (await page.request.get('/api/auth/me')).json()).user).toBeNull();expect((await page.request.get('/api/projects')).status()).toBe(401);
  expect(await page.evaluate(()=>JSON.parse(localStorage.getItem('diagram-studio-v1')!))).toEqual(local);
  await page.reload();await expect(page.locator('#project-heading')).toHaveText('Keep my local work');await expect(logout).toHaveCount(0);
  await project.signIn();
});
