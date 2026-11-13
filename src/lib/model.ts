export interface DiagramNode { id: string; label: string; x: number; y: number; notes?: string }
export interface Scenario { name: string; steps: string[]; description?: string; review?: string[] }
export interface Diagram { title?: string; nodes: DiagramNode[]; scenarios: Scenario[] }
export const STORAGE_KEY = 'diagram-studio-v1';

const record = (value: unknown): Record<string, unknown> => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('Expected a diagram object.');
  return value as Record<string, unknown>;
};
const text = (value: unknown, max: number, optional = false): string | undefined => {
  if (optional && (value === undefined || value === null)) return undefined;
  if (typeof value !== 'string' || value.length > max || (!optional && !value.trim())) throw new Error('A diagram field is missing or too long.');
  return value;
};

export function parseDiagram(raw: unknown): Diagram {
  const data = record(raw);
  if (!Array.isArray(data.nodes) || data.nodes.length > 500 || !Array.isArray(data.scenarios) || !data.scenarios.length || data.scenarios.length > 100)
    throw new Error('A project supports 500 nodes and 1–100 scenarios.');
  const nodes = data.nodes.map(value => {
    const node = record(value);
    if (![node.x, node.y].every(n => typeof n === 'number' && Number.isFinite(n) && n >= 0 && n <= 100)) throw new Error('Invalid node positions.');
    return { id: text(node.id, 100)!, label: text(node.label, 48)!, x: node.x as number, y: node.y as number, notes: text(node.notes, 2000, true) };
  });
  const ids = new Set(nodes.map(n => n.id));
  if (ids.size !== nodes.length) throw new Error('Node IDs must be unique.');
  const scenarios = data.scenarios.map(value => {
    const scenario = record(value);
    if (!Array.isArray(scenario.steps) || scenario.steps.length > 500 || !scenario.steps.every(id => typeof id === 'string' && ids.has(id))) throw new Error('Scenario steps reference missing nodes or exceed 500 steps.');
    if (scenario.review != null && (!Array.isArray(scenario.review) || scenario.review.length > 100 || !scenario.review.every(reason => typeof reason === 'string' && reason.trim() && reason.length <= 500))) throw new Error('Invalid review notes.');
    return { name: text(scenario.name, 48)!, steps: [...scenario.steps] as string[], description: text(scenario.description, 2000, true), review: scenario.review == null ? undefined : [...scenario.review] as string[] };
  });
  return { title: text(data.title, 80, true), nodes, scenarios };
}

export function readProjectFile(raw: string): Diagram {
  const data = JSON.parse(raw);
  if (data?.format === 'diagram-studio') {
    if (data.version !== 1) throw new Error('Unsupported project version.');
    return parseDiagram(data.project);
  }
  return parseDiagram(data);
}
export function exportProject(document: Diagram): string {
  return JSON.stringify({ format: 'diagram-studio', version: 1, project: document }, null, 2);
}
export function publishedDocument(document: Diagram): Diagram {
  return { ...structuredClone(document), scenarios: document.scenarios.map(({ review: _, ...s }) => structuredClone(s)) };
}
export function flagScenarios(document: Diagram, id: string, reason: string) {
  for (const scenario of document.scenarios) if (scenario.steps.includes(id))
    scenario.review = [...new Set([...(scenario.review || []), reason.slice(0, 500)])].slice(-100);
}
export function arrangeNodes(document: Diagram, scenario: number, width: number): Diagram {
  const result = structuredClone(document);
  const ids = [...new Set([...result.scenarios[scenario].steps, ...result.nodes.map(n => n.id)])];
  const byId = new Map(result.nodes.map(n => [n.id, n]));
  const links=new Map<string,Set<string>>(),incoming=new Set<string>();
  for(const path of [result.scenarios[scenario],...result.scenarios])for(let i=1;i<path.steps.length;i++){
    const from=path.steps[i-1],to=path.steps[i];if(from===to)continue;
    if(!links.has(from))links.set(from,new Set());links.get(from)!.add(to);incoming.add(to);
  }
  const ranks=new Map<string,number>();
  const roots=ids.filter(id=>!incoming.has(id));
  const queue=roots.length?roots:[ids[0]].filter(Boolean);
  queue.forEach(id=>ranks.set(id,0));
  for(let i=0;i<queue.length;i++)for(const next of links.get(queue[i])||[]){
    if(ranks.has(next))continue;ranks.set(next,ranks.get(queue[i])!+1);queue.push(next);
  }
  for(const id of ids)if(!ranks.has(id))ranks.set(id,Math.max(0,...ranks.values())+1);
  const depth=Math.max(0,...ranks.values())+1;
  const columns=Math.min(depth,Math.max(1,Math.floor(width/180)));
  const groups=Array.from({length:columns},()=>[] as string[]);
  for(const id of ids)groups[ranks.get(id)!%columns].push(id);
  groups.forEach((group,column)=>{
    group.sort((a,b)=>ranks.get(a)!-ranks.get(b)!);
    group.forEach((id,row)=>{const node=byId.get(id)!;node.x=columns===1?50:16+column*68/(columns-1);node.y=group.length===1?50:20+row*60/(group.length-1);});
  });
  return result;
}

export interface History { past: Diagram[]; present: Diagram; future: Diagram[] }
export type HistoryAction = { type: 'edit' | 'reset'; document: Diagram } | { type: 'undo' | 'redo' };
export function historyReducer(state: History, action: HistoryAction): History {
  if (action.type === 'reset') return { past: [], present: action.document, future: [] };
  if (action.type === 'edit') {
    if (JSON.stringify(action.document) === JSON.stringify(state.present)) return state;
    return { past: [...state.past, state.present].slice(-49), present: action.document, future: [] };
  }
  if (action.type === 'undo' && state.past.length) return { past: state.past.slice(0,-1), present: state.past.at(-1)!, future: [state.present, ...state.future] };
  if (action.type === 'redo' && state.future.length) return { past: [...state.past, state.present].slice(-49), present: state.future[0], future: state.future.slice(1) };
  return state;
}
