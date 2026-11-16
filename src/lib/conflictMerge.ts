import {parseDiagram} from './model';
import type {Diagram,DiagramNode} from './model';

export type MergeSide='local'|'server';
export type MergeChoices=Record<string,MergeSide>;
export interface MergeConflict {id:string;label:string;base:unknown;local:unknown;server:unknown;reason?:string}
export interface PreservedChange {label:string;source:MergeSide|'both'}
const equal=(a:unknown,b:unknown)=>JSON.stringify(a)===JSON.stringify(b);
function normalized(raw:Diagram){
  const document=parseDiagram(raw);
  return {title:document.title??'',nodes:document.nodes.map(node=>({...node,notes:node.notes??''})),scenarios:document.scenarios.map(scenario=>({...scenario,description:scenario.description??'',review:scenario.review??[]}))};
}

/** Three-way merge against the shared saved revision. Never resolves a conflict
 * by silently preferring one writer, and never repairs dangling steps by deletion. */
export function mergeConflict(baseRaw:Diagram,localRaw:Diagram,serverRaw:Diagram,choices:MergeChoices={}){
  const base=normalized(baseRaw),local=normalized(localRaw),server=normalized(serverRaw);
  const conflicts:MergeConflict[]=[],preserved:PreservedChange[]=[];
  function pick<T>(path:string[],label:string,b:T,l:T,r:T,reason?:string):T{
    const conflict=()=>{
      const id=JSON.stringify(path);conflicts.push({id,label,base:b,local:l,server:r,reason});
      // Local is only a temporary candidate. Unresolved candidates cannot save.
      return structuredClone(choices[id]==='server'?r:l);
    };
    if(reason&&!equal(l,r))return conflict();
    let value:T,source:PreservedChange['source'];
    if(equal(l,r)){value=l;source='both';}
    else if(equal(l,b)){value=r;source='server';}
    else if(equal(r,b)){value=l;source='local';}
    else{
      return conflict();
    }
    if(!equal(value,b))preserved.push({label,source});
    return structuredClone(value);
  }
  const title=pick(['title'],'Project title',base.title,local.title,server.title);
  const byId=(nodes:DiagramNode[])=>new Map(nodes.map(node=>[node.id,node]));
  const bNodes=byId(base.nodes),lNodes=byId(local.nodes),rNodes=byId(server.nodes);
  const lReferences=new Set(local.scenarios.flatMap(s=>s.steps)),rReferences=new Set(server.scenarios.flatMap(s=>s.steps));
  const localScenariosChanged=!equal(local.scenarios,base.scenarios),serverScenariosChanged=!equal(server.scenarios,base.scenarios);
  const nodes:DiagramNode[]=[];
  for(const id of new Set([...rNodes.keys(),...lNodes.keys(),...bNodes.keys()])){
    const b=bNodes.get(id),l=lNodes.get(id),r=rNodes.get(id),name=(l??r??b)!.label;
    if(!b||!l||!r){
      const referenceConflict=b&&((!l&&r&&serverScenariosChanged&&rReferences.has(id))||(!r&&l&&localScenariosChanged&&lReferences.has(id)));
      const reason=referenceConflict?'This node was removed on one side but is referenced by changed scenarios on the other.':undefined;
      const node=pick(['node',id],`Node: ${name}`,b??null,l??null,r??null,reason);
      if(node)nodes.push(node);
    }else{
      const label=pick(['node',id,'label'],`${name} · Label`,b.label,l.label,r.label);
      const position=pick(['node',id,'position'],`${name} · Position`,{x:b.x,y:b.y},{x:l.x,y:l.y},{x:r.x,y:r.y});
      const notes=pick(['node',id,'notes'],`${name} · Notes`,b.notes??'',l.notes??'',r.notes??'');
      nodes.push({id,label,...position,notes});
    }
  }
  // No scenario IDs exist yet. Do not guess identities across renames, duplicate
  // names, order changes or deletions; retain an entire ordered scenario set.
  const scenarios=pick(['scenarios'],'Scenarios and step order',base.scenarios,local.scenarios,server.scenarios);
  const unresolved=conflicts.filter(conflict=>choices[conflict.id]!=='local'&&choices[conflict.id]!=='server');
  const errors:string[]=[];
  let document:Diagram|null=null;
  if(!unresolved.length){
    const ids=new Set(nodes.map(node=>node.id));
    for(const scenario of scenarios){
      const missing=[...new Set(scenario.steps.filter(id=>!ids.has(id)))];
      if(missing.length)errors.push(`Scenario “${scenario.name}” references removed nodes: ${missing.join(', ')}. Keep those nodes or choose a matching scenario set.`);
    }
    if(!errors.length){
      try{
        document=parseDiagram({title,nodes,scenarios});
        // Reserve the update envelope and the largest version supported by the
        // client, matching the backend's existing 1 MiB request-body ceiling.
        if(new TextEncoder().encode(JSON.stringify({document,version:Number.MAX_SAFE_INTEGER})).byteLength>1_048_576){document=null;errors.push('The combined save exceeds the 1 MB request limit. Keep a smaller combination or save your original local project separately.');}
      }
      catch(error){errors.push(error instanceof Error?error.message:'The combined project is invalid.');}
    }
  }
  return {document,conflicts,preserved,unresolved,errors};
}
