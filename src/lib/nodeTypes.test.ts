import {describe,it,expect} from 'vitest';
import {NODE_TYPE_KEYS,paletteNode} from './nodeTypes';
import {parseDiagram,exportProject,readProjectFile,publishedDocument} from './model';
import {mergeConflict} from './conflictMerge';
import {compareRevisions} from './revisionDiff';
import {diagramSvg} from './imageExport';
import {NODE_TYPES} from './nodeTypes';
describe('typed components across document boundaries',()=>{
  it('preserves every type through JSON and snapshots while legacy nodes stay automatic',()=>{
    const nodes=NODE_TYPE_KEYS.map(type=>paletteNode(type,[]));
    const document=parseDiagram({nodes,scenarios:[{name:'Main',steps:nodes.map(n=>n.id)}]});
    expect(readProjectFile(exportProject(document))).toEqual(document);
    expect(publishedDocument(document).nodes.map(n=>n.type)).toEqual(NODE_TYPE_KEYS);
    const svg=diagramSvg(document,0,0,{appearance:'light',transparent:false,playback:false});
    for(const type of NODE_TYPE_KEYS)expect(svg).toContain(NODE_TYPES[type].path);
    expect(parseDiagram({nodes:[{id:'old',label:'Old',x:50,y:50}],scenarios:[{name:'Main',steps:[]}]}).nodes[0].type).toBeUndefined();
    expect(()=>parseDiagram({...document,nodes:[{...nodes[0],type:'script'}]})).toThrow('Unknown node type');
  });
  it('merges a type change with another field and flags it in revision review',()=>{
    const base=parseDiagram({nodes:[{id:'a',label:'API',x:20,y:30}],scenarios:[{name:'Main',steps:['a']}]});
    const local=structuredClone(base),server=structuredClone(base);local.nodes[0].type='api';server.nodes[0].notes='Authenticate';
    const result=mergeConflict(base,local,server);expect(result.conflicts).toHaveLength(0);
    expect(result.document?.nodes[0]).toMatchObject({type:'api',notes:'Authenticate'});
    expect(compareRevisions(base,local).hasChanges).toBe(true);
  });
  it('uses distinct defaults and bounded drop positions',()=>{
    const first=paletteNode('database',[]),second=paletteNode('database',[first],{x:-20,y:150});
    expect(second.label).toBe('Database 2');expect(second.x).toBeGreaterThan(5);expect(second.y).toBeLessThan(95);
  });
  it('places components clear of the order flow using rendered dimensions and rejects a full plane',()=>{
    const bounds={width:740,height:600,nodeWidth:148,nodeHeight:72};
    const nodes=[{label:'Receive',x:14,y:50},{label:'Inventory',x:37,y:50},{label:'Pack',x:62,y:32},{label:'Ship',x:86,y:32},{label:'Restock',x:62,y:72}];
    for(const type of NODE_TYPE_KEYS){
      const next=paletteNode(type,nodes,undefined,bounds);
      expect(nodes.every(n=>Math.abs(n.x-next.x)*bounds.width/100>=bounds.nodeWidth+15.9||Math.abs(n.y-next.y)*bounds.height/100>=bounds.nodeHeight+15.9)).toBe(true);
      nodes.push(next);
    }
    const dropped=paletteNode('api',nodes,{x:37,y:50},bounds);
    expect(dropped.x!==37||dropped.y!==50).toBe(true);
    expect(()=>paletteNode('api',[{label:'Full',x:50,y:50}],undefined,{width:160,height:72,nodeWidth:160,nodeHeight:72})).toThrow('No empty space');
  });
});
