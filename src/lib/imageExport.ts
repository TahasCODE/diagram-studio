import type { Diagram } from './model';
import { placeConnectionLabel, routeConnection } from './diagramGeometry';
import type { Box } from './diagramGeometry';

export interface ImageOptions { appearance:'light'|'dark'; transparent:boolean; playback:boolean }
const SIZE={width:1440,height:900,padding:56,nodeWidth:180,nodeHeight:76};
const escape=(value:string)=>value.replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&apos;'}[c]!));
export function diagramSvg(document:Diagram,scenario:number,step:number,options:ImageOptions){
  const dark=options.appearance==='dark';
  const colors=dark?{background:'#101c18',surface:'#1b2c25',text:'#ecf4ef',edge:'#8baba0',border:'#496558',brand:'#3a8060'}:{background:'#f4f8f5',surface:'#ffffff',text:'#19362a',edge:'#688579',border:'#bacbc1',brand:'#216b4b'};
  const boxes:Box[]=document.nodes.map(n=>({id:n.id,x:SIZE.padding+SIZE.nodeWidth/2+n.x/100*(SIZE.width-2*SIZE.padding-SIZE.nodeWidth),y:SIZE.padding+SIZE.nodeHeight/2+n.y/100*(SIZE.height-2*SIZE.padding-SIZE.nodeHeight),width:SIZE.nodeWidth,height:SIZE.nodeHeight}));
  const byId=new Map(boxes.map(b=>[b.id,b]));
  const path=document.scenarios[scenario]?.steps||[];
  const active=new Set(options.playback?path.slice(1,step+1).map((to,i)=>JSON.stringify([path[i],to])):[]);
  const edges=new Map<string,{from:string;to:string;name:string}>();
  for(const s of document.scenarios)for(let i=1;i<s.steps.length;i++)if(s.steps[i-1]!==s.steps[i])edges.set(JSON.stringify([s.steps[i-1],s.steps[i]]),{from:s.steps[i-1],to:s.steps[i],name:s.name});
  const outgoing=new Map<string,number>();for(const edge of edges.values())outgoing.set(edge.from,(outgoing.get(edge.from)||0)+1);
  const occupied:Box[]=[];
  const links=[...edges].map(([key,e],i)=>{const from=byId.get(e.from),to=byId.get(e.to);if(!from||!to)return '';const route=routeConnection(from,to,boxes,i);let label='';if((outgoing.get(e.from)||0)>1){const text=e.name.length>23?e.name.slice(0,22)+'…':e.name,width=text.length*6+16,point=placeConnectionLabel(route.points,boxes,width,SIZE,occupied);occupied.push({id:key,...point,width,height:22});label=`<g transform="translate(${point.x},${point.y})"><rect x="${-width/2}" y="-11" width="${width}" height="22" rx="8" fill="${colors.surface}" stroke="${colors.border}"/><text text-anchor="middle" dominant-baseline="middle" font-family="Inter,Arial,sans-serif" font-size="11" fill="${colors.text}">${escape(text)}</text></g>`;}return `<path d="${route.path}" stroke="${active.has(key)?colors.brand:colors.edge}" stroke-width="2" fill="none" marker-end="url(#export-arrow)"><title>${escape(e.name)}</title></path>`+label;}).join('');
  const nodes=document.nodes.map((n,i)=>{const b=boxes[i],current=options.playback&&path[step]===n.id;const words=n.label.match(/.{1,22}(?:\s|$)|.{1,22}/g)||[n.label];const lines=words.map(s=>s.trim());return `<g><title>${escape(n.label)}</title><rect x="${b.x-b.width/2}" y="${b.y-b.height/2}" width="${b.width}" height="${b.height}" rx="10" fill="${current?colors.brand:colors.surface}" stroke="${colors.border}"/><text x="${b.x}" y="${b.y-(lines.length-1)*9}" text-anchor="middle" dominant-baseline="middle" fill="${current?'#ffffff':colors.text}" font-family="Inter,Arial,sans-serif" font-size="14" font-weight="500">${lines.map((line,j)=>`<tspan x="${b.x}" dy="${j?18:0}">${escape(line)}</tspan>`).join('')}</text></g>`;}).join('');
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${SIZE.width}" height="${SIZE.height}" viewBox="0 0 ${SIZE.width} ${SIZE.height}" role="img"><title>${escape(document.title||'Untitled Diagram')}</title><desc>${escape(options.playback?`${document.scenarios[scenario]?.name||'Scenario'} · Step ${path.length?step+1:0} of ${path.length}`:'Whole diagram')}</desc><defs><marker id="export-arrow" viewBox="0 0 8 8" refX="7" refY="4" markerWidth="5" markerHeight="5" orient="auto"><path d="M1 1 7 4 1 7" fill="none" stroke="${colors.edge}" stroke-width="1.5"/></marker></defs>${options.transparent?'':`<rect width="100%" height="100%" fill="${colors.background}"/>`}${links}${nodes}</svg>`;
}
export function downloadBlob(blob:Blob,filename:string){
  const url=URL.createObjectURL(blob),anchor=document.createElement('a');anchor.href=url;anchor.download=filename;anchor.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
}
export async function imageBlob(svg:string,format:'svg'|'png'):Promise<Blob>{
  const blob=new Blob([svg],{type:'image/svg+xml;charset=utf-8'});if(format==='svg')return blob;
  const url=URL.createObjectURL(blob);
  try{const image=new Image();image.src=url;await image.decode();const canvas=document.createElement('canvas');canvas.width=SIZE.width*2;canvas.height=SIZE.height*2;const context=canvas.getContext('2d');if(!context)throw new Error('Image export is unavailable in this browser.');context.drawImage(image,0,0,canvas.width,canvas.height);return await new Promise<Blob>((resolve,reject)=>canvas.toBlob(result=>result?resolve(result):reject(new Error('Could not create the PNG.')),'image/png'));}finally{URL.revokeObjectURL(url);}
}
