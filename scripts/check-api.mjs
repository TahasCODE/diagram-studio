import assert from 'node:assert/strict';
const base = process.env.API_URL || 'http://127.0.0.1:8090/api';
let checks = 0;
function client() {
  const cookies = new Map();
  let csrf = '';
  return {
    async send(path, method='GET', body, expected=200, withCsrf=true) {
      const response = await fetch(base+path,{method,headers:{Cookie:[...cookies].map(([k,v])=>k+'='+v).join('; '),...(body!==undefined?{'Content-Type':'application/json'}:{}),...(withCsrf?{'X-CSRF-TOKEN':csrf}:{})},body:body===undefined?undefined:JSON.stringify(body)});
      for(const cookie of response.headers.getSetCookie()) { const pair=cookie.split(';')[0],index=pair.indexOf('=');cookies.set(pair.slice(0,index),pair.slice(index+1)); }
      const value = response.status===204 ? null : await response.json();
      assert.equal(response.status,expected,`${method} ${path}: ${JSON.stringify(value)}`); checks++;
      assert.match(response.headers.get('X-Request-ID')||'',/^[a-f0-9-]{36}$/);checks++;
      if(expected>=400){assert.equal(value.status,expected);assert.equal(value.requestId,response.headers.get('X-Request-ID'));assert.match(response.headers.get('Content-Type'),/application\/problem\+json/);checks+=3;}
      if(path==='/auth/me'&&value?.csrfToken)csrf=value.csrfToken;
      return value;
    }
  };
}
const author=client(), stranger=client(), anonymous=client();
const unique=crypto.randomUUID();
async function verifyEmail(client,email){
  const mail=await (await fetch('http://127.0.0.1:8025/messages?to='+encodeURIComponent(email))).json();
  assert.match(mail.at(-1)?.code||'',/^[0-9]{6}$/);checks++;
  await client.send('/auth/verify-email','POST',{email,code:mail.at(-1).code},204);
}
const document={title:'Integration Refund',nodes:[{id:'request',label:'Request',x:20,y:50,notes:'A private draft note.'},{id:'refund',label:'Refund',x:80,y:50}],scenarios:[{name:'Approved',steps:['request','refund'],description:'Successful refund.',review:['Check payout']}]};
await anonymous.send('/health');
await anonymous.send('/projects','GET',undefined,401);
await author.send('/auth/me');
await author.send('/auth/register','POST',{name:'Integration Author',email:`author-${unique}@example.test`,password:'IntegrationPassword123'},403,false);
const account=await author.send('/auth/register','POST',{name:'Integration Author',email:`author-${unique}@example.test`,password:'IntegrationPassword123'},201);
assert.equal((await author.send('/auth/me')).user,null);checks++;
await author.send('/auth/login','POST',{email:`author-${unique}@example.test`,password:'IntegrationPassword123'},403);
await verifyEmail(author,`author-${unique}@example.test`);
await author.send('/auth/login','POST',{email:`author-${unique}@example.test`,password:'IntegrationPassword123'});
assert.equal((await author.send('/auth/me')).user.id,account.id);checks++;
let draft=await author.send('/projects','POST',{document},201);
const projectId=draft.id;
await stranger.send('/auth/me');
await stranger.send('/auth/register','POST',{name:'Other Author',email:`other-${unique}@example.test`,password:'IntegrationPassword123'},201);
await verifyEmail(stranger,`other-${unique}@example.test`);
await stranger.send('/auth/login','POST',{email:`other-${unique}@example.test`,password:'IntegrationPassword123'});
const page=await author.send('/projects?page=0&size=1&q=Integration');assert.equal(page.total,1);assert.equal(page.items[0].id,projectId);checks+=2;
assert.equal((await author.send('/projects?page=1&size=1')).items.length,0);checks++;
await author.send('/projects?size=500','GET',undefined,400);
assert.equal((await stranger.send('/projects?q=Integration')).total,0);checks++;
await stranger.send('/projects/'+projectId,'GET',undefined,404);
await stranger.send('/projects/'+projectId,'PUT',{version:1,document},404);
await stranger.send(`/projects/${projectId}/publications`,'POST',{version:1},404);
await stranger.send(`/projects/${projectId}?version=1`,'DELETE',undefined,404);
await author.send('/projects/'+projectId,'PUT',{version:99,document},409);
await author.send('/projects/'+projectId,'PUT',{version:1,document:{...document,scenarios:[{name:'Broken',steps:['unknown']}]}},400);
await author.send('/projects/'+projectId,'PUT',{version:1,document:{...document,nodes:[{id:'request',label:'Missing Coordinates'},document.nodes[1]]}},400);
await author.send('/projects/'+projectId,'PUT',{version:1,document},403,false);
const published=await author.send(`/projects/${projectId}/publications`,'POST',{version:1},201);
const publicBefore=await anonymous.send('/publications/'+published.id);
assert.equal(publicBefore.document.scenarios[0].review,null);checks++;
draft=await author.send('/projects/'+projectId,'PUT',{version:1,document:{...document,title:'Edited Draft'}},200);
assert.equal((await anonymous.send('/publications/'+published.id)).document.title,'Integration Refund');checks++;
await author.send(`/projects/${projectId}/publications`,'POST',{version:1},409);
const remixed=await stranger.send('/publications/'+published.id+'/remix','POST',undefined,201);
await stranger.send('/projects/'+remixed.id,'PUT',{version:1,document:{...document,title:'Independent Remix'}});
assert.equal((await author.send('/projects/'+projectId)).document.title,'Edited Draft');checks++;
const revisions=await author.send(`/projects/${projectId}/revisions`);
assert.deepEqual(revisions.map(r=>r.version),[2,1]);checks++;
assert.equal((await author.send(`/projects/${projectId}/revisions/1`)).document.title,'Integration Refund');checks++;
await stranger.send(`/projects/${projectId}/revisions`,'GET',undefined,404);
await stranger.send(`/projects/${projectId}/revisions/1`,'GET',undefined,404);
await stranger.send(`/projects/${projectId}/restore`,'POST',{version:2,revisionVersion:1},404);
await author.send(`/projects/${projectId}/restore`,'POST',{version:1,revisionVersion:1},409);
await author.send(`/projects/${projectId}/revisions/999`,'GET',undefined,404);
draft=await author.send(`/projects/${projectId}/restore`,'POST',{version:2,revisionVersion:1});
assert.equal(draft.version,3);checks++;
assert.equal(draft.document.title,'Integration Refund');checks++;
assert.equal((await author.send(`/projects/${projectId}/revisions/2`)).document.title,'Edited Draft');checks++;
assert.equal((await anonymous.send('/publications/'+published.id)).document.title,'Integration Refund');checks++;
// Restore different content too: returning to the published revision alone cannot
// prove that a restore leaves the publication independent of the mutable draft.
draft=await author.send(`/projects/${projectId}/restore`,'POST',{version:draft.version,revisionVersion:2});
assert.equal(draft.document.title,'Edited Draft');checks++;
assert.deepEqual((await anonymous.send('/publications/'+published.id)).document,publicBefore.document);checks++;
const login=client();await login.send('/auth/me');
await login.send('/auth/login','POST',{email:`author-${unique}@example.test`,password:'WrongPassword'},401);
await login.send('/auth/login','POST',{email:`author-${unique}@example.test`,password:'IntegrationPassword123'});
await login.send('/projects/'+projectId);
await login.send('/auth/logout','POST',undefined,204);
await login.send('/projects','GET',undefined,401);
await author.send(`/projects/${projectId}?version=${draft.version}`,'DELETE',undefined,204);
const activity=await author.send('/activity?size=50&projectId='+projectId);
assert.ok(activity.items.some(event=>event.action==='PROJECT_DELETED'));checks++;
assert.ok(activity.items.some(event=>event.action==='PROJECT_RESTORED'));checks++;
assert.equal((await stranger.send('/activity?projectId='+projectId)).total,0);checks++;
await author.send('/activity?size=0','GET',undefined,400);
await anonymous.send('/publications/'+published.id,'GET',undefined,404);
await stranger.send(`/projects/${remixed.id}?version=2`,'DELETE',undefined,204);
console.log(`Passed ${checks} real HTTP checks: explicit sign-in, CSRF, request IDs, Problem Details, pagination/search, transactional audit, ownership, validation, optimistic locking, persistent revisions, safe restoration, publishing, remix, logout, and revocation.`);
