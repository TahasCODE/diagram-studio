import {describe,it,expect} from 'vitest';
import {mergeConflict} from './conflictMerge';
import type {Diagram} from './model';
const base:Diagram={title:'Read flow',nodes:[{id:'a',label:'API',x:20,y:50},{id:'b',label:'Database',x:80,y:50}],scenarios:[{name:'Read',steps:['a','b']}]};
describe('three-way conflict recovery',()=>{
  it('combines non-overlapping fields and identical concurrent edits without conflicts',()=>{
    const local=structuredClone(base),server=structuredClone(base);
    local.nodes[0].label='Gateway';server.nodes[0].notes='Validate input';
    local.title=server.title='Shared title';
    const plan=mergeConflict(base,local,server);
    expect(plan.conflicts).toEqual([]);expect(plan.document?.nodes[0]).toMatchObject({label:'Gateway',notes:'Validate input'});
    expect(plan.document?.title).toBe('Shared title');
    expect(plan.preserved.map(change=>change.source)).toEqual(['both','local','server']);
  });
  it('requires a choice for each conflicting field and treats a move as one position',()=>{
    const local=structuredClone(base),server=structuredClone(base);
    local.title='Local';server.title='Server';local.nodes[0].x=30;server.nodes[0].y=60;
    const plan=mergeConflict(base,local,server);
    expect(plan.document).toBeNull();expect(plan.unresolved).toHaveLength(2);
    const choices=Object.fromEntries(plan.conflicts.map(conflict=>[conflict.id,conflict.label==='Project title'?'server':'local'])) as Record<string,'local'|'server'>;
    const resolved=mergeConflict(base,local,server,choices);
    expect(resolved.document?.title).toBe('Server');expect(resolved.document?.nodes[0]).toMatchObject({x:30,y:50});
  });
  it('distinguishes deletion from concurrent modification and blocks dangling steps',()=>{
    const local=structuredClone(base),server=structuredClone(base);
    local.nodes[0].notes='Keep this work';local.scenarios[0].steps=['a','a','b'];
    server.nodes=server.nodes.filter(node=>node.id!=='a');server.scenarios[0].steps=['b'];
    const initial=mergeConflict(base,local,server);expect(initial.conflicts).toHaveLength(2);
    const choices=Object.fromEntries(initial.conflicts.map(conflict=>[conflict.id,conflict.label==='Scenarios and step order'?'local':'server'])) as Record<string,'local'|'server'>;
    const invalid=mergeConflict(base,local,server,choices);
    expect(invalid.document).toBeNull();expect(invalid.errors[0]).toContain('references removed nodes');
    choices[initial.conflicts[0].id]='local';
    expect(mergeConflict(base,local,server,choices).document?.scenarios[0].steps).toEqual(['a','a','b']);
  });
  it('preserves independent additions and requires a choice for the same new ID',()=>{
    const local=structuredClone(base),server=structuredClone(base);
    local.nodes.push({id:'c',label:'Cache',x:50,y:25});server.nodes.push({id:'d',label:'Worker',x:50,y:75});
    expect(mergeConflict(base,local,server).document?.nodes.map(node=>node.id)).toEqual(['a','b','d','c']);
    server.nodes[2].id='c';
    expect(mergeConflict(base,local,server).conflicts[0].label).toBe('Node: Cache');
  });
  it('promotes a delete-versus-new-reference dependency to an explicit choice',()=>{
    const original=structuredClone(base);original.nodes.push({id:'c',label:'Unused',x:50,y:75});
    const local=structuredClone(original),server=structuredClone(original);local.nodes.pop();server.scenarios[0].steps.push('c');
    const plan=mergeConflict(original,local,server);
    expect(plan.conflicts).toHaveLength(1);expect(plan.conflicts[0].reason).toContain('referenced by changed scenarios');
    expect(mergeConflict(original,local,server,{[plan.conflicts[0].id]:'server'}).document?.nodes).toHaveLength(3);
    expect(mergeConflict(original,local,server,{[plan.conflicts[0].id]:'local'}).errors[0]).toContain('references removed nodes');
  });
  it('does not guess a merge for concurrent scenario edits or lose repeated visits',()=>{
    const local=structuredClone(base),server=structuredClone(base);
    local.scenarios[0].steps=['a','b','a'];server.scenarios[0].name='Renamed';
    const plan=mergeConflict(base,local,server);expect(plan.conflicts).toHaveLength(1);
    const chosen=mergeConflict(base,local,server,{[plan.conflicts[0].id]:'local'});
    expect(chosen.document?.scenarios[0].steps).toEqual(['a','b','a']);
  });
  it('validates combined limits and leaves inputs unchanged',()=>{
    const empty:Diagram={nodes:[],scenarios:[{name:'Empty',steps:[]}]};
    const local=structuredClone(empty),server=structuredClone(empty);
    local.nodes=Array.from({length:251},(_,i)=>({id:'local-'+i,label:'Local',x:50,y:50}));
    server.nodes=Array.from({length:250},(_,i)=>({id:'server-'+i,label:'Server',x:50,y:50}));
    const before=structuredClone({empty,local,server});
    const plan=mergeConflict(empty,local,server);
    expect(plan.document).toBeNull();expect(plan.errors[0]).toContain('500 nodes');expect({empty,local,server}).toEqual(before);
  });
  it('normalizes empty optional fields and keeps delimiter-containing identities distinct',()=>{
    const local=structuredClone(base);local.nodes[0].notes='';local.scenarios[0].description='';local.scenarios[0].review=[];
    expect(mergeConflict(base,local,base).conflicts).toEqual([]);
    const original={...base,nodes:[{id:'a,b',label:'One',x:20,y:50},{id:'a',label:'Two',x:80,y:50}],scenarios:[{name:'Empty',steps:[]}]};
    const left=structuredClone(original),right=structuredClone(original);
    for(const node of left.nodes)node.label+=' local';for(const node of right.nodes)node.label+=' server';
    expect(new Set(mergeConflict(original,left,right).conflicts.map(conflict=>conflict.id)).size).toBe(2);
  });
  it('rejects a combined request over the backend byte limit even when each side fits',()=>{
    const original:Diagram={nodes:[],scenarios:[{name:'Empty',steps:[]}]},local=structuredClone(original),server=structuredClone(original);
    const nodes=(prefix:string)=>Array.from({length:100},(_,i)=>({id:prefix+i,label:'Node',x:50,y:50,notes:'界'.repeat(1900)}));
    local.nodes=nodes('l');server.nodes=nodes('s');
    expect(mergeConflict(original,local,original).document).not.toBeNull();
    const merged=mergeConflict(original,local,server);expect(merged.document).toBeNull();expect(merged.errors[0]).toContain('1 MB');
  });
});
