import { chromium } from 'playwright';
import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { execFileSync } from 'node:child_process';
import assert from 'node:assert/strict';

// Records real guest interactions, never mocks account/API responses.
const origin=new URL(process.env.APP_URL||'https://diagram-studio-demo.onrender.com').origin;
const output=path.resolve('public/demo');
const scratch=path.resolve('.runtime/demo-recording');
await fs.mkdir(output,{recursive:true});await fs.mkdir(scratch,{recursive:true});
const cache=process.env.PLAYWRIGHT_BROWSERS_PATH||(process.platform==='win32'?path.join(os.homedir(),'AppData/Local/ms-playwright'):process.platform==='darwin'?path.join(os.homedir(),'Library/Caches/ms-playwright'):path.join(os.homedir(),'.cache/ms-playwright'));
let encoder=process.env.FFMPEG_PATH;
if(!encoder){
  const entries=(await fs.readdir(cache)).filter(name=>name.startsWith('ffmpeg-')).sort((a,b)=>b.localeCompare(a,undefined,{numeric:true}));
  for(const entry of entries){const names=await fs.readdir(path.join(cache,entry));const name=names.find(n=>n.startsWith('ffmpeg-')&&(process.platform!=='win32'||n.endsWith('.exe')));if(name){encoder=path.join(cache,entry,name);break;}}
}
if(!encoder)throw new Error('Install the video encoder with npx playwright install ffmpeg, or set FFMPEG_PATH.');
for(let attempt=0;;attempt++){
  let ready=false;try{const response=await fetch(origin+'/api/auth/me',{signal:AbortSignal.timeout(10000)});ready=response.ok&&(await response.json()).accountsEnabled===false;}catch{}
  if(ready)break;if(attempt>=17)throw new Error('The recording requires a ready guest-mode deployment.');await new Promise(resolve=>setTimeout(resolve,1500));
}
const browser=await chromium.launch({channel:process.env.CI?undefined:'chrome'});
let context;
let raw,offset,duration;
const cues=[];
try {
  context=await browser.newContext({viewport:{width:1440,height:900},recordVideo:{dir:scratch,size:{width:1440,height:900}},acceptDownloads:true});
  // Optional web fonts must not stall capture if that CDN is unreachable.
  await context.route('https://fonts.googleapis.com/**',route=>route.abort());
  const began=performance.now();const page=await context.newPage();page.setDefaultTimeout(20000);
  await page.goto(origin+'/?walkthrough=cache-outage',{waitUntil:'domcontentloaded',timeout:120000});
  await page.getByText('Guest Demo: edits save in this browser.',{exact:false}).waitFor();
  await page.getByRole('button',{name:'Start Walkthrough',exact:true}).waitFor();
  const start=performance.now();offset=(start-began)/1000;
  const elapsed=()=> (performance.now()-start)/1000;
  const hold=async until=>{const ms=until*1000-(performance.now()-start);if(ms>0)await page.waitForTimeout(ms);};
  const caption=text=>cues.push({at:elapsed(),text});
  caption('Diagram Studio: explore different outcomes on one technical diagram. No account required.');
  await hold(6);await page.getByRole('button',{name:'Start Walkthrough',exact:true}).click();
  caption('A read request enters the API, then checks Redis before querying PostgreSQL.');
  await hold(10);await page.locator('#next').click();await hold(14);await page.locator('#next').click();await hold(18);await page.locator('#next').click();
  assert.equal(await page.locator('#next').isDisabled(),true);
  caption('Redis times out. The reader chooses how the API responds. Timing figures are illustrative.');
  await page.screenshot({path:path.join(output,'poster.png'),animations:'disabled'});
  await hold(24);await page.locator('.walkthrough-choices button').filter({hasText:'Fall back to PostgreSQL'}).click();
  caption('Choice 1: fall back to PostgreSQL. Keep reads available, at the cost of extra database load and latency.');
  await hold(31);await page.locator('#next').click();await page.locator('.walkthrough-outcome').waitFor();
  caption('The request succeeds with HTTP 200. The notes explain the capacity tradeoff.');
  await hold(38);await page.getByRole('button',{name:'Explore the Other Choice',exact:true}).click();
  caption('Reuse the same diagram to explore a different outcome.');
  await hold(43);await page.locator('.walkthrough-choices button').filter({hasText:'Return a temporary error'}).click();
  caption('Choice 2: return HTTP 503. Protect database capacity, but this request fails.');
  await hold(50);await page.locator('#next').click();await page.locator('.walkthrough-outcome').waitFor();
  caption('A bounded retry with backoff may help later. Uncontrolled retries could make the outage worse.');
  await hold(56);await page.getByRole('button',{name:'Restart Walkthrough',exact:true}).click();
  caption('Restart resets the walkthrough and requires a new choice.');
  await hold(59);await page.getByRole('button',{name:'Start Walkthrough',exact:true}).click();
  await hold(62);await page.locator('#remix').click();await page.waitForURL('**/?remix=1');
  await page.getByRole('tab',{name:'Editor',exact:true}).click();
  caption('Remix creates an independent browser-local copy. Edit it without changing the original example.');
  await page.locator('#project-title').fill('');await page.locator('#project-title').pressSequentially('My cache failure flow',{delay:65});await page.locator('#project-title').press('Tab');
  await hold(74);await page.getByRole('tab',{name:'Project',exact:true}).click();
  caption('The hosted demo keeps edits in this browser. Export JSON for a portable, editable backup.');
  await hold(78);const pending=page.waitForEvent('download');await page.locator('#export-project').click();const download=await pending;assert.equal(await download.failure(),null);
  caption('Full-version account saves, revisions and publications remain in the project and its tests; they are disabled in this hosted guest demo.');
  await hold(86);duration=elapsed();const video=page.video();await context.close();context=null;raw=await video.path();
} finally {if(context)await context.close();await browser.close();}
const filename=path.join(output,'diagram-studio.webm');
const encode=bitrate=>execFileSync(encoder,['-hide_banner','-loglevel','error','-y','-ss',offset.toFixed(3),'-i',raw,'-t',duration.toFixed(3),'-vf','scale=1280:800','-r','20','-an','-c:v','libvpx-vp9','-b:v',bitrate,'-crf','32','-deadline','good','-cpu-used','4',filename],{stdio:'pipe'});
encode('140k');if((await fs.stat(filename)).size>1_950_000)encode('100k');
assert.ok((await fs.stat(filename)).size<2_000_000,'Keep the checked-in recording below 2 MB.');
const time=seconds=>{const ms=Math.max(0,Math.round(seconds*1000));return `${String(Math.floor(ms/3600000)).padStart(2,'0')}:${String(Math.floor(ms/60000)%60).padStart(2,'0')}:${String(Math.floor(ms/1000)%60).padStart(2,'0')}.${String(ms%1000).padStart(3,'0')}`;};
const vtt='WEBVTT\n\n'+cues.map((cue,i)=>`${i+1}\n${time(cue.at)} --> ${time(cues[i+1]?.at??duration)}\n${cue.text}\n`).join('\n');
await fs.writeFile(path.join(output,'captions.vtt'),vtt);
await fs.writeFile(path.join(output,'recording.json'),JSON.stringify({recordedAt:new Date().toISOString(),source:origin,durationSeconds:Number(duration.toFixed(2)),width:1280,height:800,audio:false,captions:true,mode:'guest',sourceCommit:process.env.RECORDING_COMMIT||null},null,2)+'\n');
console.log(`Recorded ${duration.toFixed(1)} seconds; ${Math.round((await fs.stat(filename)).size/1024)} KB. Captions and poster saved in public/demo.`);
