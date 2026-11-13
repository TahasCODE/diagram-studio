import { test,expect } from '@playwright/test';
import { examples } from '../src/lib/examples';

test('guest discovers the walkthrough, chooses both outcomes and restarts without touching a draft',async({page})=>{
  const saved={...examples.refund,title:'My existing local draft'};
  await page.addInitScript(document=>localStorage.setItem('diagram-studio-v1',JSON.stringify(document)),saved);
  // Static walkthrough must remain usable even with the account/storage API unavailable.
  await page.route('**/api/**',route=>route.abort());
  await page.goto('/');
  await page.getByRole('link',{name:/FEATURED WALKTHROUGH/}).click();
  await expect(page.getByRole('heading',{name:'What happens when the cache goes down?',exact:true})).toBeVisible();
  await expect(page.getByText('Illustrative scenario, not a live Redis outage or a benchmark.',{exact:false})).toBeVisible();
  await page.keyboard.press('ArrowRight');
  await expect(page.getByRole('button',{name:'Start Walkthrough',exact:true})).toBeVisible();
  await page.getByRole('button',{name:'Start Walkthrough',exact:true}).click();
  for(let i=0;i<3;i++)await page.locator('#next').click();
  await expect(page.locator('#step')).toContainText('Redis is unavailable');
  await expect(page.getByText('this figure is illustrative, not measured.',{exact:false})).toBeVisible();
  await expect(page.locator('#next')).toBeDisabled();
  await page.locator('#project-heading').click();await page.keyboard.press('ArrowRight');
  await expect(page.locator('#step')).toContainText('4 / 6');
  await page.getByRole('button',{name:/^Fall back to PostgreSQL/}).click();
  await expect(page.locator('#step')).toContainText('Read from PostgreSQL');
  await expect(page.locator('.node.active')).toHaveAttribute('aria-label','Read from PostgreSQL');
  await page.locator('#next').click();await expect(page.locator('.walkthrough-outcome')).toContainText('the customer gets the data');
  await expect(page.locator('.walkthrough-outcome')).toContainText('database load');
  await page.getByRole('button',{name:'Explore the Other Choice'}).click();
  await page.getByRole('button',{name:/^Return a temporary error/}).click();
  await expect(page.locator('#step')).toContainText('Return temporary error (503)');
  await expect(page.locator('.node.active')).toHaveAttribute('aria-label','Return temporary error (503)');
  await page.locator('#next').click();await expect(page.locator('.walkthrough-outcome')).toContainText('this request fails');
  await expect(page.locator('.walkthrough-outcome')).toContainText('client must try again later');
  await page.getByRole('button',{name:'Restart Walkthrough'}).click();
  await page.getByRole('button',{name:'Start Walkthrough',exact:true}).click();
  for(let i=0;i<3;i++)await page.locator('#next').click();
  await expect(page.locator('#next')).toBeDisabled();
  expect(await page.evaluate(()=>JSON.parse(localStorage.getItem('diagram-studio-v1')!))).toEqual(saved);
  await page.getByRole('link',{name:'Back to Workspace',exact:true}).click();
  await expect(page.locator('#project-heading')).toHaveText(saved.title);
});

test('a guest on mobile sees an obvious start and can complete the temporary-error branch',async({page})=>{
  await page.setViewportSize({width:390,height:844});
  await page.route('**/api/**',route=>route.abort());await page.goto('/?walkthrough=cache-outage');
  await page.getByRole('button',{name:'Start Walkthrough',exact:true}).click();
  for(let i=0;i<3;i++)await page.locator('#next').click();
  await page.getByRole('button',{name:/^Return a temporary error/}).click();
  await page.locator('#next').click();await expect(page.locator('.walkthrough-outcome')).toContainText('this request fails');
  await page.getByRole('button',{name:'Restart Walkthrough'}).click();
  await expect(page.getByRole('button',{name:'Start Walkthrough',exact:true})).toBeVisible();
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
});
