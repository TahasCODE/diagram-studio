import {useId,useMemo,useState} from 'react';
import type {Diagram,DiagramNode,Scenario} from '../lib/model';
import {mergeConflict} from '../lib/conflictMerge';
import type {MergeChoices} from '../lib/conflictMerge';
import {RevisionComparison} from './RevisionComparison';
import {Icon} from './Icon';

function Value({value,nodes=[]}:{value:unknown;nodes?:DiagramNode[]}){
  if(value===null)return <p className="conflict-removed">Node removed</p>;
  if(typeof value==='string')return <p>{value||'None'}</p>;
  if(Array.isArray(value)){
    const names=new Map(nodes.map(node=>[node.id,node.label]));
    const counts=nodes.reduce((map,node)=>map.set(node.label,(map.get(node.label)??0)+1),new Map<string,number>());
    return <div className="conflict-scenarios">{(value as Scenario[]).map((scenario,index)=><details key={index}><summary>{scenario.name} · {scenario.steps.length} steps</summary><p>{scenario.description||'No description'}</p><ol>{scenario.steps.map((id,i)=><li key={i}>{names.get(id)||id}{(counts.get(names.get(id)||'')??0)>1?' ['+id+']':''}</li>)}</ol>{!!scenario.review?.length&&<ul aria-label="Review notes">{scenario.review.map((note,i)=><li key={i}>{note}</li>)}</ul>}</details>)}</div>;
  }
  const node=value as DiagramNode;
  return <div>{node.label&&<strong>{node.label}</strong>}<p>{node.x}%, {node.y}%</p>{node.notes&&<p>{node.notes}</p>}</div>;
}

interface Props {
  base:Diagram;local:Diagram;server:Diagram;baseVersion:number;serverVersion:number;
  busy:boolean;stale:boolean;error:string;
  onSave:(document:Diagram)=>void;onRefresh:()=>void;onCancel:()=>void;onCopy:()=>void;onBackup:()=>void;
}
export function ConflictRecovery(props:Props){
  const [choices,setChoices]=useState<MergeChoices>({});
  const [visual,setVisual]=useState(false);
  const name=useId();
  const plan=useMemo(()=>mergeConflict(props.base,props.local,props.server,choices),[props.base,props.local,props.server,choices]);
  return <section className="conflict-recovery" aria-label="Conflict recovery">
    <p className="dialog-copy">Another tab saved this project. Review the changes, choose between conflicting values, and save a combined version. Your original local draft stays unchanged until saving succeeds.</p>
    <div className="conflict-versions"><span>Shared base <strong>v{props.baseVersion}</strong></span><span>Your tab <strong>Unsaved edits</strong></span><span>Server snapshot <strong>v{props.serverVersion}</strong></span></div>
    {props.error&&<p role="alert" className="form-error">{props.error}</p>}
    {props.stale&&<div className="conflict-stale"><p>The server may have changed. Refresh it before saving. Refreshing resets your choices; your original local edits stay intact.</p><button disabled={props.busy} onClick={props.onRefresh}>Refresh Server Version</button></div>}
    <details className="conflict-visual" onToggle={event=>setVisual(event.currentTarget.open)}><summary>Compare local and server diagrams</summary>{visual&&<RevisionComparison before={props.server} after={props.local} version={props.serverVersion} currentVersion={props.baseVersion} unsaved autoFocus={false}/>}</details>
    <details className="conflict-preserved" open><summary>Automatically combined changes ({plan.preserved.length})</summary><p className="hint">Only edits that do not conflict with the shared base are combined automatically. Saving still requires your confirmation.</p>{plan.preserved.length?<ul>{plan.preserved.map((change,index)=><li key={index}><span>{change.label}</span><span>{change.source==='both'?'Same edit in both tabs':change.source==='local'?'From your tab':'From server'}</span></li>)}</ul>:<p className="hint">No non-conflicting changes to combine.</p>}</details>
    <div className="conflict-progress" role="status">{plan.conflicts.length?`${plan.conflicts.length-plan.unresolved.length} of ${plan.conflicts.length} conflicting fields resolved`:'No conflicting fields. Review the combined changes before saving.'}</div>
    {plan.conflicts.map((conflict,index)=><fieldset key={conflict.id} className="conflict-field"><legend>{conflict.label}</legend>{conflict.reason&&<p className="hint">{conflict.reason}</p>}<details className="conflict-base"><summary>Shared base value · v{props.baseVersion}</summary><Value value={conflict.base} nodes={props.base.nodes}/></details><div className="conflict-choices">{(['local','server'] as const).map(side=><div key={side} className={'conflict-choice'+(choices[conflict.id]===side?' is-chosen':'')}><label className="conflict-choice-heading"><input type="radio" name={name+'-'+index} value={side} checked={choices[conflict.id]===side} disabled={props.busy||props.stale} onChange={()=>setChoices(current=>({...current,[conflict.id]:side}))}/>{side==='local'?'Keep My Value':'Use Server Value'}</label><Value value={conflict[side]} nodes={props[side].nodes}/></div>)}</div></fieldset>)}
    <p className="hint">Node labels, notes and positions are compared separately. Scenarios and their step order are one collection: when both tabs change it, choose a complete set because scenarios do not yet have stable IDs.</p>
    {!!plan.errors.length&&<div className="conflict-validation" role="alert"><strong>This combination cannot be saved.</strong><ul>{plan.errors.map(error=><li key={error}>{error}</li>)}</ul><p>Adjust your choices, or keep the original local work as a separate copy. No steps are silently removed.</p></div>}
    <div className="conflict-footer"><button className="primary" disabled={!plan.document||props.busy||props.stale} onClick={()=>{if(plan.document)props.onSave(plan.document);}}><Icon name="save" size={16}/>{props.busy?'Saving…':'Save Reviewed Merge'}</button><button disabled={props.busy} onClick={props.onCopy}>Save as Separate Copy</button><button disabled={props.busy} onClick={props.onBackup}><Icon name="download" size={16}/>Download Local Backup</button><button className="quiet-button" disabled={props.busy} onClick={props.onCancel}>Cancel</button></div>
    {!!plan.unresolved.length&&<p className="hint">Choose a value for every conflicting field to enable the reviewed save.</p>}
  </section>;
}
