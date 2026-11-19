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
    expect(second.label).toBe('Database 2');expect(second.x).toBe(5);expect(second.y).toBe(95);
  });
});
