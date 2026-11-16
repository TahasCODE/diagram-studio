import {test,expect} from './fixtures/ownedProject';
import type {Page} from '@playwright/test';
import {parseDiagram} from '../src/lib/model';

async function editor(page:Page){await page.bringToFront();await page.getByRole('tab',{name:'Editor',exact:true}).click();}
async function title(page:Page,value:string){await page.locator('#project-title').fill(value);await page.locator('#project-title').press('Tab');}
async function notes(page:Page,value:string){await page.getByText('Node Notes',{exact:true}).click();await page.locator('#node-notes').fill(value);await page.locator('#node-notes').press('Tab');}
async function save(page:Page){await page.locator('#save-online').click();await expect(page.locator('#save-state')).toHaveText('Saved Online');}
const localDocument=(page:Page)=>page.evaluate(()=>JSON.parse(sessionStorage.getItem('diagram-studio-v1-tab')!).document);
const localVersion=(page:Page)=>page.evaluate(()=>JSON.parse(sessionStorage.getItem('diagram-studio-v1-tab')!).active.version);

test('reviews field choices, preserves cancel/reload edits, and rejects a second writer before a reviewed merge',async({page,context,ownedProject:project})=>{
  test.setTimeout(120000);
  await page.setViewportSize({width:1440,height:1000});await page.goto('/');await expect(page.locator('#save-state')).toHaveText('Saved Online');
  const stale=await context.newPage();await stale.goto('/');await expect(stale.locator('#save-state')).toHaveText('Saved Online');
  await editor(page);await title(page,'Server title');await notes(page,'Server node notes');await page.locator('#reviewed').click();await save(page);
  await editor(stale);await title(stale,'Local title');await stale.locator('#label').fill('Local gateway');await stale.locator('#label').press('Tab');await stale.locator('#reviewed').click();
  const original=await localDocument(stale);
  await stale.locator('#save-online').click();await expect(stale.getByRole('alert')).toContainText('another session');
  const writes:string[]=[];stale.on('request',request=>{if(request.method()==='PUT')writes.push(request.url());});
  await stale.getByRole('button',{name:'Review Changes',exact:true}).click();
  const dialog=stale.getByRole('dialog',{name:'Resolve Save Conflict',exact:true});
  await expect(dialog.getByRole('group',{name:'Project title',exact:true})).toBeVisible();
  await expect(dialog.getByRole('button',{name:'Save Reviewed Merge',exact:true})).toBeDisabled();
  await expect(dialog).toContainText('From your tab');await expect(dialog).toContainText('From server');
  for(const width of [1440,1024,390]){
    await stale.setViewportSize({width,height:1000});expect(await dialog.evaluate(el=>el.scrollWidth<=el.clientWidth)).toBe(true);
    await stale.screenshot({path:`.runtime/conflict-${width}-light.png`,fullPage:true,animations:'disabled'});
  }
  expect(writes).toEqual([]);await dialog.getByRole('button',{name:'Cancel',exact:true}).click();
  expect(await localDocument(stale)).toEqual(original);expect(await localVersion(stale)).toBe(1);
  await stale.locator('#theme-toggle').click();await stale.getByRole('button',{name:'Review Changes',exact:true}).click();
  await expect(dialog.getByRole('group',{name:'Project title',exact:true})).toBeVisible();
  await stale.screenshot({path:'.runtime/conflict-390-dark.png',fullPage:true,animations:'disabled'});
  await dialog.getByRole('group',{name:'Project title',exact:true}).getByRole('radio',{name:'Keep My Value',exact:true}).check();
  await editor(page);await page.getByRole('button',{name:'Worker',exact:true}).click();await expect(page.locator('#label')).toHaveValue('Worker');await page.locator('#label').fill('Worker revised');await expect(page.locator('#label')).toHaveValue('Worker revised');await page.locator('#label').press('Tab');await save(page);
  const winner=await project.api('/projects/'+project.draft.id);expect(winner.version).toBe(3);expect(winner.document.nodes.find((node:{id:string})=>node.id==='c').label).toBe('Worker revised');
  await stale.bringToFront();const rejected=stale.waitForResponse(response=>response.url().endsWith('/api/projects/'+project.draft.id)&&response.request().method()==='PUT');
  await dialog.getByRole('button',{name:'Save Reviewed Merge',exact:true}).click();expect((await rejected).status()).toBe(409);
  await expect(dialog.getByRole('alert')).toContainText('server changed again');await expect(dialog.getByRole('button',{name:'Save Reviewed Merge',exact:true})).toBeDisabled();
  expect(await localDocument(stale)).toEqual(original);expect(await localVersion(stale)).toBe(1);
  expect((await project.api('/projects/'+project.draft.id)).document).toEqual(winner.document);
  await dialog.getByRole('button',{name:'Refresh Server Version',exact:true}).click();await expect(dialog.getByText('v3',{exact:true})).toBeVisible();
  await expect(dialog.getByRole('radio',{checked:true})).toHaveCount(0);await expect(dialog.getByRole('button',{name:'Save Reviewed Merge',exact:true})).toBeDisabled();
  await dialog.getByRole('button',{name:'Cancel',exact:true}).click();
  await stale.reload();await expect(stale.locator('#project-heading')).toHaveText('Local title');expect(await localVersion(stale)).toBe(1);
  await stale.locator('#save-online').click();await expect(stale.getByRole('button',{name:'Review Changes',exact:true})).toBeVisible();
  await stale.getByRole('button',{name:'Review Changes',exact:true}).click();
  await expect(dialog.getByRole('radio',{checked:true})).toHaveCount(0);
  await dialog.getByRole('group',{name:'Project title',exact:true}).getByRole('radio',{name:'Keep My Value',exact:true}).check();
  await dialog.getByRole('button',{name:'Save Reviewed Merge',exact:true}).click();await expect(stale.locator('#save-state')).toHaveText('Saved Online');
  const merged=await project.api('/projects/'+project.draft.id);
  expect(merged.version).toBe(4);expect(merged.document.title).toBe('Local title');
  expect(merged.document.nodes.find((node:{id:string})=>node.id==='a')).toMatchObject({label:'Local gateway',notes:'Server node notes'});
  expect(merged.document.nodes.find((node:{id:string})=>node.id==='c').label).toBe('Worker revised');
  expect((await project.api(`/projects/${project.draft.id}/revisions/3`)).document).toEqual(winner.document);
  await stale.close();
});

test('blocks a merge with deleted step references and can save the untouched local work as a separate copy',async({page,context,ownedProject:project})=>{
  test.setTimeout(90000);await page.goto('/');await expect(page.locator('#save-state')).toHaveText('Saved Online');
  const stale=await context.newPage();await stale.goto('/');await expect(stale.locator('#save-state')).toHaveText('Saved Online');
  await editor(stale);await notes(stale,'Local node notes');await stale.locator('#append').click();await stale.locator('#reviewed').click();
  const original=await localDocument(stale);
  await editor(page);await page.locator('#remove').click();await page.locator('#reviewed').click();await save(page);
  const winner=await project.api('/projects/'+project.draft.id);
  await stale.bringToFront();await stale.locator('#save-online').click();await stale.getByRole('button',{name:'Review Changes',exact:true}).click();
  const dialog=stale.getByRole('dialog',{name:'Resolve Save Conflict',exact:true});
  await dialog.getByRole('group',{name:'Node: API',exact:true}).getByRole('radio',{name:'Use Server Value',exact:true}).check();
  await dialog.getByRole('group',{name:'Scenarios and step order',exact:true}).getByRole('radio',{name:'Keep My Value',exact:true}).check();
  await expect(dialog.getByRole('alert')).toContainText('references removed nodes');await expect(dialog.getByRole('button',{name:'Save Reviewed Merge',exact:true})).toBeDisabled();
  const download=stale.waitForEvent('download');await dialog.getByRole('button',{name:'Download Local Backup',exact:true}).click();
  const stream=await (await download).createReadStream();let backup='';for await(const chunk of stream!)backup+=chunk.toString();expect(parseDiagram(JSON.parse(backup).project)).toEqual(parseDiagram(original));
  await dialog.getByRole('button',{name:'Save as Separate Copy',exact:true}).click();await expect(stale.locator('#save-state')).toHaveText('Saved Online');
  const metadata=await stale.evaluate(()=>JSON.parse(sessionStorage.getItem('diagram-studio-v1-tab')!).active);project.track(metadata.id);expect(metadata.id).not.toBe(project.draft.id);
  expect(parseDiagram((await project.api('/projects/'+metadata.id)).document)).toEqual(parseDiagram(original));
  const unchanged=await project.api('/projects/'+project.draft.id);expect(unchanged.document).toEqual(winner.document);expect(unchanged.version).toBe(winner.version);
  await stale.close();
});
