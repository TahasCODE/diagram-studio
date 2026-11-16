import { test, expect } from '@playwright/test';
test('guest demo explains local storage, disables accounts and shares a remixable snapshot',async({page,context})=>{
  await context.route('https://fonts.googleapis.com/**',route=>route.abort());
  let releaseCapabilities!:()=>void;
  const capabilitiesReady=new Promise<void>(resolve=>{releaseCapabilities=resolve;});
  await context.route('**/api/auth/me',async route=>{await capabilitiesReady;await route.fulfill({json:{user:null,csrfToken:'demo-test',accountsEnabled:false}});});
  const writes:string[]=[];context.on('request',request=>{if(request.url().includes('/api/')&&request.method()!=='GET')writes.push(request.url());});
  await page.goto('/',{waitUntil:'domcontentloaded'});await expect(page.locator('#project-heading')).toBeVisible();await expect(page.locator('#sign-in')).toHaveCount(0);await expect(page.locator('#save-online')).toHaveCount(0);releaseCapabilities();await expect(page.getByText('Guest Demo: edits save in this browser.',{exact:false})).toBeVisible();
  await expect(page.locator('#sign-in')).toHaveCount(0);await expect(page.locator('#save-online')).toHaveCount(0);
  await page.keyboard.press('Control+s');await expect(page.getByText('Accounts are unavailable in this guest demo.',{exact:false})).toBeVisible();await expect(page.getByRole('dialog')).toHaveCount(0);
  await page.getByRole('button',{name:'Share Snapshot',exact:true}).click();await expect(page.getByRole('dialog')).toContainText('It is not saved as an online project.');const url=await page.locator('#playback-link').inputValue();expect(new URL(url).hash.length).toBeGreaterThan(10);
  const reader=await context.newPage();await reader.goto(url,{waitUntil:'domcontentloaded'});await expect(reader.locator('#remix')).toBeVisible();await expect(reader.locator('#sign-in')).toHaveCount(0);
  await reader.locator('#next').click();await expect(reader.locator('#step')).toContainText('2 /');await reader.locator('#my-projects').click();await expect(reader).toHaveURL('/');await expect(reader.locator('#remix')).toHaveCount(0);
  await page.getByRole('button',{name:'Close Dialog',exact:true}).click();await page.locator('#my-projects').click();await expect(page.getByRole('tab',{name:'Project',exact:true})).toHaveAttribute('aria-selected','true');await expect(page.locator('#panel-project')).toContainText('Online saves and version history are available in the full application, not this guest demo.');
  expect(writes).toEqual([]);
});
