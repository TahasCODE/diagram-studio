import {test,expect} from '@playwright/test';
import {parseDiagram} from '../src/lib/model';
import type {Diagram} from '../src/lib/model';

test('compares a saved revision with unsaved edits without saving, then handles a matching revision',async({page},testInfo)=>{
  test.setTimeout(90000);
  expect(['127.0.0.1','localhost']).toContain(new URL(testInfo.project.use.baseURL!).hostname);
  const api=async(path:string,method='GET',body?:unknown,status=200)=>{
    const me=await (await page.request.get('/api/auth/me',{timeout:10000})).json();
    const response=await page.request.fetch('/api'+path,{method,headers:{'X-CSRF-TOKEN':me.csrfToken},data:body,timeout:10000});
    expect(response.status()).toBe(status);return status===204?null:response.json();
  };
  const email='revision-'+crypto.randomUUID()+'@example.test',password='RevisionTestPassword123';
  const account=await api('/auth/register','POST',{name:'Revision Tester',email,password},201);
  const mail=await (await page.request.get('http://127.0.0.1:8025/messages?to='+encodeURIComponent(email))).json();
  await api('/auth/verify-email','POST',{email,code:mail.at(-1).code},204);
  await api('/auth/login','POST',{email,password});
  const original:Diagram={title:'Read flow',nodes:[{id:'a',label:'API',x:16,y:25},{id:'b',label:'Redis',x:50,y:25},{id:'c',label:'PostgreSQL',x:82,y:65}],scenarios:[{name:'Success',steps:['a','b','c']},{name:'Failure',steps:['a','b']}]};
  const created=await api('/projects','POST',{document:original},201);
  let completed=false;
  try{
    const saved=structuredClone(original);saved.nodes[0].label='Gateway';
    const server=await api('/projects/'+created.id,'PUT',{version:created.version,document:saved});
    const current=parseDiagram(server.document);current.title='Unsaved read flow';
    current.nodes=[{...current.nodes[0],x:25,notes:'Authenticate first'},current.nodes[2],{id:'d',label:'Fallback handler',x:50,y:65}];
    current.scenarios=[{name:'Success',steps:['a','d','c']},{name:'Fallback',steps:['a','c']}];
    await page.addInitScript(({document,active})=>{
      localStorage.setItem('diagram-studio-v1',JSON.stringify(document));
      localStorage.setItem('diagram-studio-v1-cloud',JSON.stringify(active));
    },{document:current,active:{id:server.id,version:server.version,ownerId:account.id,savedJson:JSON.stringify(parseDiagram(server.document))}});
    const writes:string[]=[];
    page.on('request',request=>{if(['POST','PUT','PATCH','DELETE'].includes(request.method())&&request.url().includes('/api/'))writes.push(request.url());});
    await page.setViewportSize({width:1440,height:1000});await page.goto('/');
    await page.getByRole('tab',{name:'Project',exact:true}).click();await page.locator('#version-history').click();
    await page.getByRole('button',{name:'Preview Version 1',exact:true}).click();
    const comparison=page.getByRole('region',{name:'Version 1 → Current Draft',exact:true});
    await expect(comparison).toBeVisible();await expect(comparison).toBeFocused();
    await expect(comparison).toContainText('Includes unsaved edits');
    const nodes=comparison.getByRole('region',{name:'Nodes',exact:true});
    await expect(nodes.locator('[data-kind=added]')).toHaveCount(1);
    await expect(nodes.locator('[data-kind=removed]')).toHaveCount(1);
    const changed=nodes.locator('[data-kind=changed]');await changed.locator('summary').click();
    await expect(changed).toContainText('Authenticate first');await expect(changed).toContainText('25%, 25%');
    await expect(changed).toContainText('API');await expect(changed).toContainText('Gateway');
    await expect(comparison.locator('.revision-graph').first().locator('[data-node-id=b][data-kind=removed]')).toHaveCount(1);
    await expect(comparison.locator('.revision-graph').last().locator('[data-node-id=d][data-kind=added]')).toHaveCount(1);
    await expect(comparison.getByRole('region',{name:'Scenarios',exact:true}).locator('[data-kind=removed]')).toHaveCount(1);
    for(const width of [1440,1024,390]){
      await page.setViewportSize({width,height:1000});
      await comparison.evaluate(section=>section.scrollIntoView({block:'start'}));
      expect(await page.getByRole('dialog').evaluate(dialog=>dialog.scrollWidth<=dialog.clientWidth)).toBe(true);
      await page.screenshot({path:`.runtime/revision-${width}-light.png`,fullPage:true,animations:'disabled'});
    }
    await page.keyboard.press('Escape');await page.locator('#theme-toggle').click();
    await page.getByRole('button',{name:'Open Inspector',exact:true}).click();
    await page.locator('#version-history').click();await page.getByRole('button',{name:'Preview Version 1',exact:true}).click();
    await expect(comparison).toBeVisible();await expect(page.locator('html')).toHaveAttribute('data-theme','dark');
    await page.screenshot({path:'.runtime/revision-390-dark.png',fullPage:true,animations:'disabled'});
    expect(writes).toEqual([]);
    expect((await api('/projects/'+created.id)).document).toEqual(server.document);
    expect((await api('/projects/'+created.id+'/revisions')).map((revision:{version:number})=>revision.version)).toEqual([2,1]);
    await page.keyboard.press('Escape');await page.setViewportSize({width:1440,height:1000});
    await page.locator('#my-projects').click();await page.getByRole('dialog',{name:'My Projects',exact:true}).getByRole('button',{name:'Open',exact:true}).click();
    await page.getByRole('button',{name:'Continue',exact:true}).click();
    await page.locator('#version-history').click();await page.getByRole('button',{name:'Preview Version 2',exact:true}).click();
    await expect(page.getByText('No changes. This revision matches your current draft.',{exact:true})).toBeVisible();
    await expect(page.locator('#project-heading')).toHaveText('Read flow');
    completed=true;
  }finally{
    try{await api('/projects/'+created.id,'DELETE',undefined,204);}
    catch(error){
      if(completed)throw error;
      testInfo.annotations.push({type:'cleanup',description:'Could not remove the isolated test project after the test failure.'});
    }
  }
});
