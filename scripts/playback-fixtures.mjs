import {mkdir,writeFile} from 'node:fs/promises';
import {pathToFileURL} from 'node:url';

export function playbackFixture(count){
  if(![100,500].includes(count))throw new Error('Use a 100-node or 500-node workload.');
  const columns=count===100?10:25,rows=count/columns;
  const nodes=Array.from({length:count},(_,i)=>{
    const row=Math.floor(i/columns),column=row%2?columns-1-i%columns:i%columns;
    return {id:`node-${i}`,label:`Service ${String(i+1).padStart(3,'0')}`,x:10+column*80/(columns-1),y:10+row*80/(rows-1),notes:'Synthetic playback workload; positions are deliberately dense.'};
  });
  return {title:`Playback stress fixture: ${count} nodes`,nodes,scenarios:[{name:'Read request',steps:nodes.map(n=>n.id),description:'Synthetic serpentine path. This is a rendering workload, not an architecture example.'}]};
}

if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){
  await mkdir('benchmarks/fixtures',{recursive:true});
  for(const count of [100,500])await writeFile(`benchmarks/fixtures/${count}.json`,JSON.stringify({format:'diagram-studio',version:1,project:playbackFixture(count)},null,2)+'\n');
  console.log('Wrote deterministic 100-node and 500-node fixtures.');
}
