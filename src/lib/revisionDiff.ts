import type {Diagram,DiagramNode,Scenario} from './model';

export type ChangeKind='added'|'removed'|'changed';
export interface FieldChange {label:string;before:string;after:string}
export interface EntryChange<T> {key:string;kind:ChangeKind;before?:T;after?:T;fields:FieldChange[]}
export interface Connection {from:string;to:string;scenarios:string[]}
const optional=(value:string|undefined)=>value??'';
const sameList=(a:string[],b:string[])=>a.length===b.length&&a.every((value,index)=>value===b[index]);

export function diagramConnections(document:Diagram){
  const edges=new Map<string,Connection>();
  for(const scenario of document.scenarios)for(let i=1;i<scenario.steps.length;i++){
    const from=scenario.steps[i-1],to=scenario.steps[i];if(from===to)continue;
    const key=JSON.stringify([from,to]);
    const edge=edges.get(key)??{from,to,scenarios:[]};
    if(!edge.scenarios.includes(scenario.name))edge.scenarios.push(scenario.name);
    edges.set(key,edge);
  }
  return edges;
}

// Scenarios have no persistent IDs in the existing model. Never infer a rename:
// pair equal names, and pair duplicate names by their occurrence in each list.
function scenarioEntries(scenarios:Scenario[]){
  const occurrences=new Map<string,number>();
  return new Map(scenarios.map(scenario=>{
    const occurrence=occurrences.get(scenario.name)??0;
    occurrences.set(scenario.name,occurrence+1);
    return [JSON.stringify([scenario.name,occurrence]),scenario];
  }));
}

function fields(before:Record<string,string>,after:Record<string,string>,absentBefore=false,absentAfter=false){
  return [...new Set([...Object.keys(before),...Object.keys(after)])]
    .filter(label=>before[label]!==after[label])
    .map(label=>({label,before:absentBefore?'Not present':before[label]||'None',after:absentAfter?'Not present':after[label]||'None'}));
}

function compareEntries<T>(before:Map<string,T>,after:Map<string,T>,values:(entry:T)=>Record<string,string>):EntryChange<T>[] {
  const changes:EntryChange<T>[]=[];
  for(const key of new Set([...before.keys(),...after.keys()])){
    const previous=before.get(key),current=after.get(key);
    const changesInFields=fields(previous?values(previous):{},current?values(current):{},!previous,!current);
    if(!previous||!current||changesInFields.length)changes.push({key,kind:!previous?'added':!current?'removed':'changed',before:previous,after:current,fields:changesInFields});
  }
  return changes;
}

export function compareRevisions(before:Diagram,after:Diagram){
  const nodeValues=(node:DiagramNode)=>({Label:node.label,Position:`${node.x}%, ${node.y}%`,Notes:optional(node.notes)});
  const nodes=compareEntries(new Map(before.nodes.map(node=>[node.id,node])),new Map(after.nodes.map(node=>[node.id,node])),nodeValues);
  const beforeScenarios=scenarioEntries(before.scenarios),afterScenarios=scenarioEntries(after.scenarios);
  const scenarioValues=(scenario:Scenario)=>({Steps:JSON.stringify(scenario.steps),Description:optional(scenario.description),'Review notes':JSON.stringify([...(scenario.review??[])].sort())});
  const scenarios=compareEntries(beforeScenarios,afterScenarios,scenarioValues);
  const connections=compareEntries(diagramConnections(before),diagramConnections(after),edge=>({Scenarios:JSON.stringify([...edge.scenarios].sort())}));
  const project=fields({Title:optional(before.title)},{Title:optional(after.title)});
  if(!sameList([...beforeScenarios.keys()],[...afterScenarios.keys()]))project.push({label:'Scenario order',before:JSON.stringify(before.scenarios.map(s=>s.name)),after:JSON.stringify(after.scenarios.map(s=>s.name))});
  return {nodes,scenarios,connections,project,hasChanges:!!(nodes.length||scenarios.length||connections.length||project.length)};
}

export type RevisionDiff=ReturnType<typeof compareRevisions>;
