import {useEffect,useId,useMemo,useRef} from 'react';
import type {Diagram} from '../lib/model';
import {compareRevisions,diagramConnections} from '../lib/revisionDiff';
import type {ChangeKind,EntryChange,FieldChange,RevisionDiff} from '../lib/revisionDiff';
import {routeConnection} from '../lib/diagramGeometry';
import type {Box} from '../lib/diagramGeometry';

const STATUS={added:{label:'Added',mark:'+'},removed:{label:'Removed',mark:'−'},changed:{label:'Changed',mark:'~'}};
const GRAPH={width:720,height:420,nodeWidth:168,nodeHeight:72,labelLimit:13,padding:88};

function Badge({kind}:{kind:ChangeKind}){
  return <span className={'revision-badge '+kind}><span aria-hidden="true">{STATUS[kind].mark}</span>{STATUS[kind].label}</span>;
}

function Graph({document,diff,side,label}:{document:Diagram;diff:RevisionDiff;side:'before'|'after';label:string}){
  const marker=useId();
  const geometry=useMemo(()=>{
    const boxes:Box[]=document.nodes.map(node=>({id:node.id,x:node.x*GRAPH.width/100,y:node.y*GRAPH.height/100,width:GRAPH.nodeWidth,height:GRAPH.nodeHeight}));
    const byId=new Map(boxes.map(box=>[box.id,box]));
    return {boxes,routes:[...diagramConnections(document)].map(([key,edge],index)=>({key,...routeConnection(byId.get(edge.from)!,byId.get(edge.to)!,boxes,index)}))};
  },[document]);
  const nodeKinds=new Map(diff.nodes.map(change=>[change.key,change.kind]));
  const edgeKinds=new Map(diff.connections.map(change=>[change.key,change.kind]));
  return <figure className="revision-graph"><figcaption>{label}<span>{document.nodes.length} nodes</span></figcaption>
    {!document.nodes.length?<p className="hint">This version has no nodes.</p>:<div className="revision-graph-viewport" tabIndex={0} role="region" aria-label={label+' scrollable diagram'}><svg viewBox={`${-GRAPH.padding} ${-GRAPH.padding} ${GRAPH.width+2*GRAPH.padding} ${GRAPH.height+2*GRAPH.padding}`} role="img" aria-label={label+' diagram. Added, removed and changed nodes and connections are highlighted; full changes are listed below.'}>
      <defs><marker id={marker} viewBox="0 0 8 8" refX="7" refY="4" markerWidth="5" markerHeight="5" orient="auto"><path d="M1 1 7 4 1 7" fill="none" stroke="context-stroke" strokeWidth="1.5"/></marker></defs>
      <g className="revision-graph-edges">{geometry.routes.map(route=><path key={route.key} d={route.path} data-kind={edgeKinds.get(route.key)} markerEnd={`url(#${marker})`}/>)}</g>
      {geometry.boxes.map((box,index)=>{
        const node=document.nodes[index],kind=nodeKinds.get(node.id);
        const shown=kind==='added'&&side==='before'||kind==='removed'&&side==='after'?undefined:kind;
        const text=node.label.length>GRAPH.labelLimit?node.label.slice(0,GRAPH.labelLimit-1)+'…':node.label;
        return <g key={node.id} className="revision-graph-node" data-kind={shown} data-node-id={node.id} transform={`translate(${box.x},${box.y})`}>
          <title>{node.label}{shown?' · '+STATUS[shown].label:''}</title><rect x={-box.width/2} y={-box.height/2} width={box.width} height={box.height} rx="8"/>
          <text className="revision-graph-label" textAnchor="middle" dominantBaseline="central">{text}</text>
          {shown&&<text className="revision-graph-mark" x={box.width/2-9} y={-box.height/2+10} textAnchor="middle">{STATUS[shown].mark}</text>}
        </g>;
      })}
    </svg></div>}
  </figure>;
}

function Value({label,value}:{label:string;value:string}){
  if(['Scenarios','Review notes','Scenario order'].includes(label)){
    try{
      const items:string[]=JSON.parse(value);
      if(!items.length)return <p>None</p>;
      const List=label==='Scenario order'?'ol':'ul';
      return <List className="revision-value-list">{items.map((item,index)=><li key={index}>{item}</li>)}</List>;
    }catch{ /* Added and removed records use the literal "Not present". */ }
  }
  return <p>{value}</p>;
}

function Fields({fields}:{fields:FieldChange[]}){
  return <dl className="revision-fields">{fields.map(field=><div key={field.label} className="revision-field"><dt>{field.label}</dt><dd><span className="revision-value-label">Saved revision</span><Value label={field.label} value={field.before}/></dd><dd><span className="revision-value-label">Current draft</span><Value label={field.label} value={field.after}/></dd></div>)}</dl>;
}

function Changes<T>({title,changes,label,displayFields}:{title:string;changes:EntryChange<T>[];label:(entry:EntryChange<T>)=>string;displayFields?:(entry:EntryChange<T>)=>FieldChange[]}){
  return <section className="revision-change-section" aria-label={title}><h4>{title}<span>{changes.length}</span></h4>
    {!changes.length?<p className="hint">No {title.toLowerCase()} changes.</p>:changes.map(change=><details key={change.key} className="revision-change" data-kind={change.kind}><summary><Badge kind={change.kind}/><span>{label(change)}</span></summary><Fields fields={displayFields?displayFields(change):change.fields}/></details>)}
  </section>;
}

export function RevisionComparison({before,after,version,currentVersion,unsaved}:{before:Diagram;after:Diagram;version:number;currentVersion:number;unsaved:boolean}){
  const section=useRef<HTMLElement>(null);
  useEffect(()=>{section.current?.scrollIntoView({block:'start'});section.current?.focus({preventScroll:true});},[version]);
  const diff=useMemo(()=>compareRevisions(before,after),[before,after]);
  const beforeNames=new Map(before.nodes.map(node=>[node.id,node.label])),afterNames=new Map(after.nodes.map(node=>[node.id,node.label]));
  const pathText=(steps:string[]|undefined,names:Map<string,string>)=>steps?steps.map((id,index)=>`${index+1}. ${names.get(id)||id} [${id}]`).join('\n')||'No steps':'Not present';
  const graphId=useId();
  return <section ref={section} tabIndex={-1} className="revision-comparison" aria-labelledby={graphId}>
    <div className="revision-comparison-heading"><div><p className="section-overline">REVISION COMPARISON</p><h3 id={graphId}>Version {version} → Current Draft</h3><p className="hint">Based on saved version {currentVersion}{unsaved?' · Includes unsaved edits':' · No unsaved edits'}. Comparison does not save or restore anything.</p></div></div>
    {!diff.hasChanges?<p className="revision-no-changes" role="status">No changes. This revision matches your current draft.</p>:<>
      <div className="revision-change-counts" aria-label="Change summary"><span><strong>{diff.nodes.length}</strong> node changes</span><span><strong>{diff.connections.length}</strong> connection changes</span><span><strong>{diff.scenarios.length}</strong> scenario changes</span><span><strong>{diff.project.length}</strong> project changes</span></div>
      <div className="revision-legend" aria-label="Change legend">{(['added','removed','changed'] as const).map(kind=><Badge key={kind} kind={kind}/>)}<span className="hint">Unchanged items stay neutral.</span></div>
      <p className="hint">Scroll each diagram horizontally when needed. Open a change below for its full labels and values.</p>
      <div className="revision-graphs"><Graph document={before} diff={diff} side="before" label={'Saved version '+version}/><Graph document={after} diff={diff} side="after" label="Current draft"/></div>
      {!!diff.project.length&&<section className="revision-change-section" aria-label="Project details"><h4>Project details</h4><Fields fields={diff.project}/></section>}
      <Changes title="Nodes" changes={diff.nodes} label={change=>(change.after??change.before)!.label}/>
      <Changes title="Connections" changes={diff.connections} label={change=>{const edge=(change.after??change.before)!;const names=change.after?afterNames:beforeNames;return `${names.get(edge.from)||edge.from} → ${names.get(edge.to)||edge.to}`;}}/>
      <Changes title="Scenarios" changes={diff.scenarios} label={change=>{const scenario=(change.after??change.before)!;const matches=(change.after?after:before).scenarios.filter(s=>s.name===scenario.name);return scenario.name+(matches.length>1?` · occurrence ${matches.indexOf(scenario)+1}`:'');}} displayFields={change=>change.fields.map(field=>field.label==='Steps'?{...field,before:pathText(change.before?.steps,beforeNames),after:pathText(change.after?.steps,afterNames)}:field)}/>
    </>}
    <p className="hint revision-match-note">Nodes match by ID. Scenarios match by name; duplicate names match by order. A renamed scenario appears as removed and added. Step order and repeated visits are compared.</p>
  </section>;
}
