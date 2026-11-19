export const NODE_TYPES={
  client:{label:'Client',description:'A browser, app or external caller',path:'M2 2h12v9H2V2Zm3 12h6M8 11v3'},
  api:{label:'API',description:'An entry point for requests',path:'m5 4-4 4 4 4m6-8 4 4-4 4M9 2 7 14'},
  service:{label:'Service',description:'Application or business logic',path:'M2 2h12v5H2V2Zm0 7h12v5H2V9Zm2-5h1m-1 7h1'},
  database:{label:'Database',description:'Persistent application data',path:'M2 4a6 2 0 1 0 12 0 6 2 0 1 0-12 0Zm0 0v8a6 2 0 0 0 12 0V4M2 8a6 2 0 0 0 12 0'},
  cache:{label:'Cache',description:'A fast, temporary data store',path:'M9 1 3 9h4l-1 6 7-9H9l0-5Z'},
  queue:{label:'Queue',description:'Messages waiting for processing',path:'M1 3h10v3H1V3Zm2 5h10v3H3V8Zm2 5h10M13 3h2'},
  decision:{label:'Decision',description:'A condition with different outcomes',path:'m8 1 7 7-7 7-7-7 7-7Z'},
} as const;
export type NodeType=keyof typeof NODE_TYPES;
export const NODE_TYPE_KEYS=Object.keys(NODE_TYPES) as NodeType[];
export const PALETTE_MIME='application/x-diagram-studio-node';
export const isNodeType=(value:unknown):value is NodeType=>typeof value==='string'&&Object.hasOwn(NODE_TYPES,value);
export interface NodePlacementBounds {width:number;height:number;nodeWidth:number;nodeHeight:number}
export function paletteNode(type:NodeType,nodes:{label:string;x:number;y:number}[],position?:{x:number;y:number},bounds:NodePlacementBounds={width:900,height:600,nodeWidth:160,nodeHeight:72}){
  let label:string=NODE_TYPES[type].label,suffix=2;
  while(nodes.some(node=>node.label===label))label=`${NODE_TYPES[type].label} ${suffix++}`;
  const gap=16,scan=8;
  const marginX=(bounds.nodeWidth/2+gap)/bounds.width*100,marginY=(bounds.nodeHeight/2+gap)/bounds.height*100;
  const clear=(p:{x:number;y:number})=>nodes.every(n=>Math.abs(n.x-p.x)*bounds.width/100>=bounds.nodeWidth+gap||Math.abs(n.y-p.y)*bounds.height/100>=bounds.nodeHeight+gap);
  const preferred=position?{x:Math.max(marginX,Math.min(100-marginX,position.x)),y:Math.max(marginY,Math.min(100-marginY,position.y))}:undefined;
  if(preferred&&clear(preferred))return{id:crypto.randomUUID(),label,type,...preferred};
  let point:{x:number;y:number}|undefined,best=Infinity;
  for(let y=marginY;y<=100-marginY;y+=scan/bounds.height*100)for(let x=marginX;x<=100-marginX;x+=scan/bounds.width*100){
    const p={x,y};if(!clear(p))continue;
    const score=preferred?Math.hypot((x-preferred.x)*bounds.width,(y-preferred.y)*bounds.height):y*bounds.height+x;
    if(score<best){best=score;point=p;}
  }
  if(!point)throw new Error('No empty space for another component. Move existing nodes apart or remove unused nodes, then try again.');
  return{id:crypto.randomUUID(),label,type,...point};
}
