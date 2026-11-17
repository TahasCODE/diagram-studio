import {test,expect} from './fixtures/ownedProject';

test('members discuss a node, retain reply text across conflicts, and respect revocation',async({page,browser,ownedProject},testInfo)=>{
  test.setTimeout(75000);
  const context=await browser.newContext({baseURL:testInfo.project.use.baseURL});
  await context.route(/^https:\/\/fonts\.(?:googleapis|gstatic)\.com\//,route=>route.abort());
  const viewer=await context.newPage();
  const api=async(path:string,method='GET',data?:unknown,status=200)=>{
    const me=await(await context.request.get('/api/auth/me')).json();
    const response=await context.request.fetch('/api'+path,{method,data,headers:{'X-CSRF-TOKEN':me.csrfToken}});
    expect(response.status()).toBe(status);return status===204?null:response.json();
  };
  const email='reviewer-'+crypto.randomUUID()+'@example.test',password='NodeCommentsTest123';
  try{
    const account=await api('/auth/register','POST',{email,name:'Diagram Reviewer',password},201);
    const mail=await(await context.request.get('http://127.0.0.1:8025/messages?to='+encodeURIComponent(email))).json();
    await api('/auth/verify-email','POST',{email,code:mail.at(-1).code},204);await api('/auth/login','POST',{email,password});
    await ownedProject.api(`/projects/${ownedProject.draft.id}/members`,'POST',{email,role:'VIEWER'},204);
    await api(`/invitations/${ownedProject.draft.id}/accept`,'POST',undefined,204);
    const draft=await api('/projects/'+ownedProject.draft.id);
    await context.addInitScript(({document,active})=>sessionStorage.setItem('diagram-studio-v1-tab',JSON.stringify({document,active})),{document:draft.document,active:{id:draft.id,version:draft.version,ownerId:account.id,role:'VIEWER',savedJson:JSON.stringify(draft.document)}});
    await page.goto('/');await page.getByRole('button',{name:'Comments for API',exact:true}).click();
    await page.getByLabel('Start a Discussion',{exact:true}).fill('Should the API retry? <img src=x onerror=alert(1)>');
    await page.getByRole('button',{name:'Post Comment',exact:true}).click();
    await expect(page.getByRole('region',{name:'Discussion Details'})).toContainText('<img src=x onerror=alert(1)>');
    await expect(page.getByRole('dialog').locator('img')).toHaveCount(0);
    await viewer.goto('/');await expect(viewer.locator('#save-online')).toBeDisabled();
    await viewer.getByRole('button',{name:'Comments for API',exact:true}).click();
    await viewer.locator('.comment-thread').first().click();
    await viewer.getByLabel('Your Reply',{exact:true}).fill('Use bounded retries with backoff.');
    await viewer.getByRole('button',{name:'Post Reply',exact:true}).click();
    await expect(viewer.getByRole('region',{name:'Discussion Details'})).toContainText('Use bounded retries with backoff.');
    await expect(viewer.getByRole('button',{name:'Resolve Discussion',exact:true})).toHaveCount(0);
    await viewer.getByLabel('Your Reply',{exact:true}).fill('Keep my unsent review text');
    await page.getByRole('button',{name:'Refresh Comments',exact:true}).click();
    await page.getByRole('button',{name:'Resolve Discussion',exact:true}).click();
    await expect(page.getByText('Discussion resolved.',{exact:true})).toBeVisible();
    await viewer.getByRole('button',{name:'Post Reply',exact:true}).click();
    await expect(viewer.getByRole('alert')).toContainText('Reopen this discussion before replying');
    await expect(viewer.getByLabel('Your Reply',{exact:true})).toHaveValue('Keep my unsent review text');
    await viewer.getByRole('button',{name:'Refresh Comments',exact:true}).click();
    await expect(viewer.getByLabel('Your Reply',{exact:true})).toHaveCount(0);
    await page.getByRole('button',{name:'Reopen Discussion',exact:true}).click();
    await expect(page.getByText('Discussion reopened.',{exact:true})).toBeVisible();
    await viewer.getByRole('button',{name:'Refresh Comments',exact:true}).click();
    await expect(viewer.getByLabel('Your Reply',{exact:true})).toHaveValue('Keep my unsent review text');
    for(const width of [1440,1024,390]){
      await page.setViewportSize({width,height:900});await page.getByRole('dialog').evaluate(d=>{d.scrollTop=0;});
      expect(await page.getByRole('dialog').evaluate(d=>d.scrollWidth<=d.clientWidth)).toBe(true);
      await page.screenshot({path:`.runtime/comments-${width}.png`});
    }
    await page.getByRole('button',{name:'Close Dialog',exact:true}).click();
    await page.locator('#theme-toggle').click();
    await page.getByRole('button',{name:'Comments for API',exact:true}).click();
    await expect(page.locator('html')).toHaveAttribute('data-theme','dark');
    await page.screenshot({path:'.runtime/comments-390-dark.png'});
    // Comments never change the shared graph's optimistic-save version.
    expect((await ownedProject.api('/projects/'+draft.id)).version).toBe(draft.version);
    await ownedProject.api(`/projects/${draft.id}/members/${account.id}`,'DELETE',undefined,204);
    await viewer.getByRole('button',{name:'Post Reply',exact:true}).click();
    await expect(viewer.getByRole('alert')).toContainText('access has been removed');
    await expect(viewer.getByLabel('Your Reply',{exact:true})).toHaveValue('Keep my unsent review text');
  }finally{await context.close();}
});
