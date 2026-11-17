import {test,expect} from './fixtures/ownedProject';

test('in-app invitation, Viewer playback, Editor saves and revoked access',async({page,browser,ownedProject})=>{
  const recipient=await browser.newContext({baseURL:test.info().project.use.baseURL});
  await recipient.route(/^https:\/\/fonts\.(?:googleapis|gstatic)\.com\//,route=>route.abort());
  const other=await recipient.newPage();
  const api=async(path:string,method='GET',data?:unknown,status=200)=>{
    const me=await(await recipient.request.get('/api/auth/me')).json();
    const response=await recipient.request.fetch('/api'+path,{method,headers:{'X-CSRF-TOKEN':me.csrfToken},data});
    expect(response.status()).toBe(status);return status===204?null:response.json();
  };
  const email='member-'+crypto.randomUUID()+'@example.test',password='CollaborationBrowser123';
  try{
    await api('/auth/register','POST',{email,name:'Project Reader',password},201);
    const mail=await(await recipient.request.get('http://127.0.0.1:8025/messages?to='+encodeURIComponent(email))).json();
    await api('/auth/verify-email','POST',{email,code:mail.at(-1).code},204);
    await api('/auth/login','POST',{email,password});
    await page.goto('/');
    await page.locator('#collaboration').click();
    await page.getByLabel('Invite by Account Email').fill(email);
    await page.getByRole('button',{name:'Send Invitation',exact:true}).click();
    await expect(page.getByText('Invitation pending',{exact:false})).toBeVisible();
    await other.goto('/');await other.locator('#collaboration').click();
    await other.getByRole('button',{name:'Accept',exact:true}).click();
    await other.getByRole('button',{name:'Open '+ownedProject.document.title,exact:true}).click();
    await other.getByRole('button',{name:'Continue',exact:true}).click();
    await expect(other.getByText('Viewer access: explore this saved project without changing it.',{exact:false})).toBeVisible();
    await expect(other.getByRole('tab',{name:'Editor',exact:true})).toHaveCount(0);
    await expect(other.locator('#save-online')).toBeDisabled();
    await expect(other.locator('#share')).toBeDisabled();
    await other.getByRole('button',{name:'Next Step',exact:true}).click();
    await other.reload();await expect(other.locator('#save-online')).toBeDisabled();
    await page.getByRole('button',{name:'Make Project Reader Editor',exact:true}).click();
    await expect(page.getByText('Editor · Active',{exact:true})).toBeVisible();
    await other.reload();await other.getByRole('tab',{name:'Editor',exact:true}).click();
    await other.getByRole('button',{name:'API',exact:true}).click();
    await expect(other.locator('#label')).toHaveValue('API');
    await other.locator('#label').fill('Shared API');await other.locator('#label').press('Tab');
    await other.locator('#save-online').click();
    await expect(other.locator('#save-state')).toHaveText('Saved Online');
    const saved=await ownedProject.api('/projects/'+ownedProject.draft.id);
    expect(saved.version).toBe(2);expect(saved.document.nodes[0].label).toBe('Shared API');
    for(const width of [1440,1024,390]){
      await page.setViewportSize({width,height:900});
      await page.getByRole('dialog').evaluate(dialog=>{dialog.scrollTop=0;});
      expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
      await page.screenshot({path:`.runtime/collaboration-${width}.png`});
    }
    await page.getByRole('button',{name:'Remove Project Reader',exact:true}).click();
    await expect(page.getByText(email,{exact:true})).toHaveCount(0);
    await other.locator('#label').fill('Unsaved after revocation');await other.locator('#label').press('Tab');
    await other.locator('#save-online').click();
    await expect(other.getByRole('alert')).toContainText('access has been removed');
    await expect(other.locator('#label')).toHaveValue('Unsaved after revocation');
    await api('/projects/'+ownedProject.draft.id,'GET',undefined,404);
  }finally{await recipient.close();}
});
