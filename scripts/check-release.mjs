import assert from 'node:assert/strict';

const target=new URL(process.env.APP_URL||'http://127.0.0.1:8090');
assert.ok(target.protocol==='https:'||(target.protocol==='http:'&&['localhost','127.0.0.1'].includes(target.hostname)),'Use HTTPS, or HTTP on loopback for local checks.');
assert.equal(target.pathname,'/','Use the app origin, without a path.');
assert.ok(!target.username&&!target.password&&!target.search&&!target.hash,'Do not put credentials or query parameters in the URL.');
let checks=0;
async function get(path,status=200,type){
  const response=await fetch(new URL(path,target),{signal:AbortSignal.timeout(10000),redirect:'error'});
  assert.equal(response.status,status,`Unexpected status for ${path}`);
  if(type)assert.match(response.headers.get('content-type')||'',type,`Unexpected content type for ${path}`);
  checks++;return response;
}
const html=await (await get('/',200,/text\/html/)).text();
const scripts=[...html.matchAll(/<script\b[^>]*\bsrc="([^"]+)"[^>]*>/g)];
assert.ok(scripts.some(script=>script[1]==='/theme.js'&&!/\b(?:async|defer|type=)/.test(script[0])),'Theme restoration must run synchronously.');checks++;
assert.ok(html.indexOf('/theme.js')<html.indexOf('type="module"'),'Theme must precede the app module.');checks++;
for(const script of scripts)await (await get(script[1],200,/(?:java|ecma)script/)).arrayBuffer();
for(const link of html.matchAll(/<link\b[^>]*href="([^"]+\.css)"[^>]*>/g))if(link[1].startsWith('/'))await (await get(link[1],200,/text\/css/)).arrayBuffer();
await (await get('/?walkthrough=cache-outage',200,/text\/html/)).text();
await (await get('/p/00000000-0000-0000-0000-000000000000',200,/text\/html/)).text();
assert.equal((await (await get('/api/health',200,/application\/json/)).json()).status,'ok');checks++;
assert.equal((await (await get('/api/auth/me',200,/application\/json/)).json()).user,null);checks++;
await (await get('/api/projects',401,/application\/problem\+json/)).json();
if(process.env.PUBLICATION_ID){
  assert.match(process.env.PUBLICATION_ID,/^[a-f0-9-]{36}$/i);
  const publication=await (await get('/api/publications/'+process.env.PUBLICATION_ID,200,/application\/json/)).json();
  assert.ok(publication.document?.nodes?.length&&publication.document?.scenarios?.length);checks++;
  await (await get('/p/'+process.env.PUBLICATION_ID,200,/text\/html/)).text();
}
console.log(`Passed ${checks} read-only release checks against ${target.origin}. No accounts, projects or emails created.`);
