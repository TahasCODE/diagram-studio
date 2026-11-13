import {describe,it,expect} from 'vitest';
import {compareRevisions,diagramConnections} from './revisionDiff';
import type {Diagram} from './model';

const original:Diagram={title:'Read flow',nodes:[{id:'a',label:'API',x:20,y:50},{id:'b',label:'Cache',x:80,y:50}],scenarios:[{name:'Read',steps:['a','b']}]};
describe('revision comparison',()=>{
  it('does not flag serialization order, optional empty values or node ordering as edits',()=>{
    const reordered:Diagram={scenarios:[{steps:['a','b'],name:'Read',description:'',review:[]}],nodes:[{...original.nodes[1],notes:''},{...original.nodes[0],notes:''}],title:original.title};
    expect(compareRevisions(original,reordered).hasChanges).toBe(false);
  });
  it('compares nodes by identity and reports all changed fields without mutating either document',()=>{
    const after=structuredClone(original);after.title='Updated flow';
    after.nodes=[{...after.nodes[0],label:'Gateway',x:25,notes:'Authenticate first'},{id:'c',label:'Database',x:75,y:50}];
    after.scenarios[0].steps=['a','c'];
    const snapshot=structuredClone(after),diff=compareRevisions(original,after);
    expect(diff.nodes.map(n=>[n.key,n.kind])).toEqual([['a','changed'],['b','removed'],['c','added']]);
    expect(diff.nodes[0].fields.map(f=>f.label)).toEqual(['Label','Position','Notes']);
    expect(diff.project[0]).toEqual({label:'Title',before:'Read flow',after:'Updated flow'});
    expect(diff.connections.map(e=>e.kind)).toEqual(['removed','added']);
    expect(after).toEqual(snapshot);expect(original.nodes[0].label).toBe('API');
  });
  it('detects ordered repeated steps even when the set of edges stays the same',()=>{
    const before={...original,scenarios:[{name:'Read',steps:['a','b','a']}]};
    const after={...original,scenarios:[{name:'Read',steps:['a','b','a','b']}]};
    const diff=compareRevisions(before,after);
    expect(diff.scenarios[0].fields[0].label).toBe('Steps');expect(diff.connections).toEqual([]);
  });
  it('keeps duplicate scenario names distinct and represents renames as removal/addition',()=>{
    const before={...original,scenarios:[{name:'Read',steps:['a']},{name:'Read',steps:['b']}]};
    const after={...original,scenarios:[{name:'Read',steps:['a']},{name:'Read',steps:['b','a']}]};
    expect(compareRevisions(before,after).scenarios).toHaveLength(1);
    const renamed={...original,scenarios:[{name:'Fallback',steps:['a','b']}]};
    expect(compareRevisions(original,renamed).scenarios.map(s=>s.kind)).toEqual(['removed','added']);
  });
  it('reports scenario order, descriptions, review notes and connection membership',()=>{
    const before={...original,scenarios:[{name:'Read',steps:['a','b']},{name:'Retry',steps:['b']}]};
    const after={...original,scenarios:[{name:'Retry',steps:['a','b'],description:'Retry once',review:['Check load']},{name:'Read',steps:['a','b']}]};
    const diff=compareRevisions(before,after);
    expect(diff.project[0].label).toBe('Scenario order');
    expect(diff.scenarios[0].fields.map(f=>f.label)).toEqual(['Steps','Description','Review notes']);
    expect(diff.connections[0].kind).toBe('changed');
  });
  it('handles empty graphs, self visits and IDs containing delimiters',()=>{
    const empty:Diagram={nodes:[],scenarios:[{name:'Empty',steps:[]}]};
    expect(compareRevisions(empty,structuredClone(empty)).hasChanges).toBe(false);
    expect(diagramConnections({...original,scenarios:[{name:'Loop',steps:['a','a','b']}]}).size).toBe(1);
    expect(diagramConnections({...original,scenarios:[{name:'Keys',steps:['a,b','c','a','b,c']}]}).size).toBe(3);
  });
  it('preserves list boundaries when names or notes contain separator characters',()=>{
    const before={...original,scenarios:[{name:'Read',steps:['a','b'],review:['One\nTwo']}]};
    const after={...original,scenarios:[{name:'Read',steps:['a','b'],review:['One','Two']}]};
    expect(compareRevisions(before,after).scenarios[0].fields[0].label).toBe('Review notes');
    const one={...original,scenarios:[{name:'A\nB',steps:['a','b']}]};
    const two={...original,scenarios:[{name:'A',steps:['a','b']},{name:'B',steps:['a','b']}]};
    expect(compareRevisions(one,two).connections[0].kind).toBe('changed');
  });
});
