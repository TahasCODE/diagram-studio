import {test as base,expect} from '@playwright/test';
import {parseDiagram} from '../../src/lib/model';
import type {Diagram} from '../../src/lib/model';
import type {Draft} from '../../src/lib/api';

interface Fixture {draft:Draft;document:Diagram;api:(path:string,method?:string,body?:unknown,status?:number)=>Promise<any>;track:(id:string)=>void;signIn:()=>Promise<void>}
export const test=base.extend<{ownedProject:Fixture}>({
  ownedProject:async({page,context},use,testInfo)=>{
    expect(['localhost','127.0.0.1']).toContain(new URL(testInfo.project.use.baseURL!).hostname);
    context.setDefaultNavigationTimeout(15000);context.setDefaultTimeout(15000);
    await context.route(/^https:\/\/fonts\.(?:googleapis|gstatic)\.com\//,route=>route.abort());
    const api=async(path:string,method='GET',body?:unknown,status=200)=>{
      const me=await (await page.request.get('/api/auth/me',{timeout:10000})).json();
      const response=await page.request.fetch('/api'+path,{method,headers:{'X-CSRF-TOKEN':me.csrfToken},data:body,timeout:10000});
      expect(response.status()).toBe(status);return status===204?null:response.json();
    };
    const email='recovery-'+crypto.randomUUID()+'@example.test',password='RecoveryTestPassword123';
    const account=await api('/auth/register','POST',{name:'Recovery Tester',email,password},201);
    const messages=await (await page.request.get('http://127.0.0.1:8025/messages?to='+encodeURIComponent(email))).json();
    await api('/auth/verify-email','POST',{email,code:messages.at(-1).code},204);await api('/auth/login','POST',{email,password});
    const original:Diagram={title:'Recovery project',nodes:[{id:'a',label:'API',x:20,y:40},{id:'b',label:'Database',x:75,y:40},{id:'c',label:'Worker',x:75,y:75}],scenarios:[{name:'Read',steps:['a','b']}]};
    const draft:Draft=await api('/projects','POST',{document:original},201),document=parseDiagram(draft.document);
    const ids=new Set([draft.id]);
    await page.addInitScript(({document,active})=>{
      if(!localStorage.getItem('diagram-studio-v1')){
        localStorage.setItem('diagram-studio-v1',JSON.stringify(document));localStorage.setItem('diagram-studio-v1-cloud',JSON.stringify(active));
      }
    },{document,active:{id:draft.id,version:draft.version,ownerId:account.id,savedJson:JSON.stringify(document)}});
    try{await use({draft,document,api,track:id=>ids.add(id),signIn:async()=>{await api('/auth/login','POST',{email,password});}});}
    finally{
      for(const id of ids){
        try{const latest=await api('/projects/'+id);await api('/projects/'+id+'?version='+latest.version,'DELETE',undefined,204);}
        catch(error){if(testInfo.status==='passed')throw error;testInfo.annotations.push({type:'cleanup',description:'Could not remove an isolated recovery test project after failure.'});}
      }
    }
  },
});
export {expect} from '@playwright/test';
