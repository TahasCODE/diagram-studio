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
export function paletteNode(type:NodeType,nodes:{label:string;x:number;y:number}[],position?:{x:number;y:number}){
  let label:string=NODE_TYPES[type].label,suffix=2;
  while(nodes.some(node=>node.label===label))label=`${NODE_TYPES[type].label} ${suffix++}`;
  const spots=Array.from({length:16},(_,i)=>({x:16+(i%4)*22,y:20+Math.floor(i/4)*20}));
  const point=position??spots.find(p=>nodes.every(n=>Math.abs(n.x-p.x)>14||Math.abs(n.y-p.y)>14))??{x:50,y:50};
  return{id:crypto.randomUUID(),label,type,x:Math.max(5,Math.min(95,point.x)),y:Math.max(5,Math.min(95,point.y))};
}
