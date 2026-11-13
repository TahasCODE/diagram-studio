import { describe, expect, it } from 'vitest';
import { examples } from './examples';
import { arrangeNodes, exportProject, flagScenarios, historyReducer, parseDiagram, publishedDocument, readProjectFile } from './model';

describe('diagram documents', () => {
  it('accepts a 500-node round trip and rejects a 501st node', () => {
    const nodes=Array.from({length:500},(_,i)=>({id:`n${i}`,label:`Node ${i}`,x:50,y:50}));
    const document={title:'Large graph',nodes,scenarios:[{name:'All nodes',steps:nodes.map(n=>n.id)}]};
    expect(readProjectFile(exportProject(document))).toEqual(parseDiagram(document));
    expect(()=>parseDiagram({...document,nodes:[...nodes,{id:'extra',label:'Extra',x:50,y:50}]})).toThrow('500 nodes');
  });
  it('migrates prototype JSON and accepts nullable backend fields', () => {
    const document = parseDiagram({...examples.refund, title:null, nodes:examples.refund.nodes.map(n => ({...n,notes:null}))});
    expect(document.nodes).toHaveLength(6);
    expect(document.title).toBeUndefined();
    expect(readProjectFile(exportProject(document))).toEqual(document);
    expect(readProjectFile(JSON.stringify(examples.checkout))).toEqual(parseDiagram(examples.checkout));
  });
  it('rejects missing references, duplicate IDs, invalid coordinates, and incompatible versions', () => {
    expect(() => parseDiagram({...examples.refund,scenarios:[{name:'Broken',steps:['missing']}]})).toThrow();
    expect(() => parseDiagram({...examples.refund,nodes:[examples.refund.nodes[0],examples.refund.nodes[0]]})).toThrow();
    expect(() => parseDiagram({...examples.refund,nodes:[{...examples.refund.nodes[0],x:NaN}]})).toThrow();
    expect(() => readProjectFile('{"format":"diagram-studio","version":2}')).toThrow();
  });
  it('flags every affected path without changing unrelated scenarios', () => {
    const document = structuredClone(examples.refund);
    flagScenarios(document,'approved','Changed payout');
    expect(document.scenarios[0].review).toEqual(['Changed payout']);
    expect(document.scenarios[1].review).toBeUndefined();
    expect(document.scenarios[2].review).toEqual(['Changed payout']);
    const publication = publishedDocument(document);
    expect(publication.scenarios.every(s => !s.review)).toBe(true);
    publication.nodes[0].label='Different';
    expect(document.nodes[0].label).toBe('Request refund');
  });
  it('arranges repeated routes once per node and stays inside the canvas', () => {
    const arranged = arrangeNodes(examples.webhook,1,350);
    expect(new Set(arranged.nodes.map(n => `${n.x},${n.y}`)).size).toBe(arranged.nodes.length);
    expect(arranged.nodes.every(n => n.x>=13 && n.x<=87 && n.y>=10 && n.y<=90)).toBe(true);
    expect(examples.webhook.nodes[0].x).toBe(16);
    expect(arranged.scenarios).toEqual(examples.webhook.scenarios);
  });
  it('undoes edits and drops redo history after a new edit', () => {
    const first = structuredClone(examples.refund);
    let state = {past:[],present:first,future:[]} as Parameters<typeof historyReducer>[0];
    state=historyReducer(state,{type:'edit',document:{...first,title:'A'}});
    state=historyReducer(state,{type:'undo'});
    expect(state.present).toEqual(first);
    state=historyReducer(state,{type:'redo'});
    expect(state.present.title).toBe('A');
    state=historyReducer(state,{type:'undo'});
    state=historyReducer(state,{type:'edit',document:{...first,title:'B'}});
    expect(state.future).toEqual([]);
  });
});
