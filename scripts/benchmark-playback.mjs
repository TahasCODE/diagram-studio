import assert from 'node:assert/strict';
import {mkdir,readFile,writeFile} from 'node:fs/promises';
import os from 'node:os';
import {execFileSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import {chromium} from '@playwright/test';
import sourceMap from 'source-map-js';
import {playbackFixture} from './playback-fixtures.mjs';

const label=process.argv[2];
if(!/^[a-z0-9-]+$/.test(label||''))throw new Error('Usage: node scripts/benchmark-playback.mjs baseline|after');
const base=process.env.BENCH_URL||'http://127.0.0.1:5175';
assert.ok(['127.0.0.1','localhost'].includes(new URL(base).hostname),'Use a local preview server.');
const loads=Number(process.env.BENCH_LOADS||10),steps=30;
assert.ok(Number.isSafeInteger(loads)&&loads>=3&&loads<=100);
const browser=await chromium.launch({channel:process.env.CI?undefined:'chrome'});
const output={label,recordedAt:new Date().toISOString(),commit:execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim(),browser:browser.version(),node:process.version,machine:{platform:os.platform(),release:os.release(),cpu:os.cpus()[0].model,logicalCpus:os.cpus().length,memoryGiB:Math.round(os.totalmem()/1024**3)},conditions:{base,viewport:{width:1440,height:1000},headless:true,deviceScaleFactor:1,reducedMotion:'reduce',httpCache:'disabled by request routing; new context per load',fonts:'external requests blocked; system fallback',network:'local static production preview; API unavailable; no account',loads,stepsPerLoad:steps,warmupLoads:1,cpuThrottle:1},results:[]};
output.sourceHashes={};
for(const path of ['src/components/Canvas.tsx','src/lib/model.ts','benchmarks/fixtures/100.json','benchmarks/fixtures/500.json'])output.sourceHashes[path]=createHash('sha256').update(await readFile(path)).digest('hex');
output.workingTreeDirty=execFileSync('git',['status','--porcelain'],{encoding:'utf8'}).trim().length>0;
const summarize=values=>{const sorted=[...values].sort((a,b)=>a-b);return {n:values.length,medianMs:sorted[Math.floor(sorted.length/2)],p95Ms:sorted[Math.ceil(sorted.length*.95)-1]};};
await mkdir('benchmarks/results',{recursive:true});
await mkdir('.runtime/playback-profiles',{recursive:true});

async function advance(page,index){
  return page.evaluate(async target=>{
    const start=performance.now();
    document.querySelector('#next').click();
    await new Promise((resolve,reject)=>{
      const timeout=setTimeout(()=>{observer.disconnect();reject(new Error('Playback update timed out'));},10000);
      const ready=()=>{
        if(document.querySelector('.node.active')?.getAttribute('aria-label')!==`Service ${String(target+1).padStart(3,'0')}`||Number(document.querySelector('#progress').value)!==target+1)return;
        clearTimeout(timeout);observer.disconnect();
        requestAnimationFrame(()=>requestAnimationFrame(resolve));
      };
      const observer=new MutationObserver(ready);observer.observe(document.querySelector('#root'),{subtree:true,childList:true,attributes:true,characterData:true});ready();
    });
    return performance.now()-start;
  },index);
}

try{
  for(const count of [100,500]){
    const fixture=JSON.parse(await readFile(`benchmarks/fixtures/${count}.json`,'utf8')).project;
    assert.deepEqual(fixture,playbackFixture(count),'Regenerate changed fixtures.');
    const usable=[],latencies=[];
    for(let sample=-1;sample<loads;sample++){
      const context=await browser.newContext({viewport:output.conditions.viewport,deviceScaleFactor:1,reducedMotion:'reduce'});
      await context.route('**/*',route=>new URL(route.request().url()).origin===new URL(base).origin?route.continue():route.abort());
      const page=await context.newPage();
      await page.goto(base+'/#'+encodeURIComponent(JSON.stringify(fixture)),{waitUntil:'domcontentloaded'});
      await page.waitForFunction(expected=>document.querySelectorAll('.node').length===expected&&!document.querySelector('#next')?.disabled&&document.querySelector('.node.active')?.getAttribute('aria-label')==='Service 001',count);
      const ready=await page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(()=>resolve(performance.now())))));
      const updates=[];
      for(let step=1;step<=steps;step++)updates.push(await advance(page,step));
      if(sample>=0){usable.push(ready);latencies.push(...updates);}
      if(sample===loads-1){
        const cdp=await context.newCDPSession(page);
        await cdp.send('Profiler.enable');await cdp.send('Profiler.setSamplingInterval',{interval:1000});await cdp.send('Profiler.start');
        for(let step=steps+1;step<=steps+10;step++)await advance(page,step);
        const {profile}=await cdp.send('Profiler.stop');
        await writeFile(`.runtime/playback-profiles/${label}-${count}.cpuprofile`,JSON.stringify(profile));
        const maps=new Map(),bySource={};
        for(const node of profile.nodes){
          const frame=node.callFrame;if(!frame.url.startsWith(base)||!frame.url.includes('/assets/'))continue;
          if(!maps.has(frame.url)){
            const response=await fetch(frame.url+'.map');
            if(!response.ok)throw new Error('Build with --sourcemap before profiling.');
            maps.set(frame.url,new sourceMap.SourceMapConsumer(await response.json()));
          }
          const original=maps.get(frame.url).originalPositionFor({line:frame.lineNumber+1,column:frame.columnNumber});
          const key=original.source||frame.url;bySource[key]=(bySource[key]||0)+(node.hitCount||0);
        }
        const total=profile.samples?.length||0;
        output.results.push({nodes:count,edges:count-1,usable:summarize(usable),stepUpdate:summarize(latencies),raw:{usableMs:usable,stepMs:latencies},profile:{totalSamples:total,assets:[...maps.keys()],bySourceSelfSamples:bySource,geometrySelfPercent:100*Object.entries(bySource).filter(([key])=>key.includes('diagramGeometry')).reduce((sum,[,value])=>sum+value,0)/Math.max(1,total)}});
      }
      await context.close();
    }
    const result=output.results.at(-1);console.log(JSON.stringify({nodes:count,usable:result.usable,stepUpdate:result.stepUpdate,geometrySelfPercent:result.profile.geometrySelfPercent}));
  }
  await writeFile(`benchmarks/results/${label}.json`,JSON.stringify(output,null,2)+'\n');
}finally{await browser.close();}
