import {test,expect} from '@playwright/test';
import small from '../benchmarks/fixtures/100.json' with {type:'json'};
import large from '../benchmarks/fixtures/500.json' with {type:'json'};

for(const fixture of [small,large])test(`guest plays and restarts ${fixture.project.nodes.length} nodes; routes follow viewport changes`,async({page})=>{
  await page.goto('/#'+encodeURIComponent(JSON.stringify(fixture.project)));
  await expect(page.locator('.node')).toHaveCount(fixture.project.nodes.length);
  const paths=()=>page.locator('#lines path').evaluateAll(elements=>elements.map(el=>el.getAttribute('d')));
  await expect(page.locator('#lines path')).toHaveCount(fixture.project.nodes.length-1);
  const before=await paths();
  await page.locator('#next').click();await page.locator('#next').click();
  await expect(page.locator('.node.active')).toHaveAttribute('aria-label','Service 003');
  await expect(page.locator('#lines path.active-edge')).toHaveCount(2);
  expect(await paths()).toEqual(before);
  await page.locator('#prev').click();await expect(page.locator('.node.active')).toHaveAttribute('aria-label','Service 002');
  await page.locator('#restart').click();await expect(page.locator('.node.active')).toHaveAttribute('aria-label','Service 001');
  await expect(page.locator('#lines path.active-edge')).toHaveCount(0);
  await page.setViewportSize({width:1024,height:800});
  await expect.poll(paths).not.toEqual(before);
});
