import {useMemo,useState} from 'react';
import type {Diagram} from '../lib/model';
import {compareScenarios} from '../lib/scenarioComparison';
import {Dialog} from './Dialog';
import {Icon} from './Icon';
import {NodeGlyph} from './NodeGlyph';
import '../styles/scenario-comparison.css';
export function ScenarioComparison({document,initialScenario,onClose,onExplore}:{document:Diagram;initialScenario:number;onClose:()=>void;onExplore:(scenario:number,step:number)=>void}){
  const [left,setLeft]=useState(initialScenario),[right,setRight]=useState(initialScenario===0?1:0),[step,setStep]=useState(0);
  const a=document.scenarios[left],b=document.scenarios[right];
  const diff=useMemo(()=>compareScenarios(a,b),[a,b]);
  const nodes=useMemo(()=>new Map(document.nodes.map(n=>[n.id,n])),[document.nodes]);
  const length=Math.max(a.steps.length,b.steps.length),last=Math.max(0,length-1);
  return <Dialog title="Compare Scenarios" className="scenario-comparison" onClose={onClose}>
    <p className="dialog-copy">Compare two paths through the same diagram. Steps are aligned by position, not elapsed time. Shared nodes may appear at different positions.</p>
    <div className="comparison-summary" role="status"><strong>{diff.identical?'These paths have the same ordered steps.':`First difference at step ${diff.prefix+1}.`}</strong><span>{diff.prefix} matching opening steps · {diff.shared.size} shared nodes · {diff.leftOnly.size+diff.rightOnly.size} nodes unique to one path</span></div>
    <div className="comparison-navigation"><div className="actions"><button disabled={step===0||!length} onClick={()=>setStep(step-1)}><Icon name="left" size={15}/>Previous Pair</button><button className="primary" disabled={step>=last||!length} onClick={()=>setStep(step+1)}>Next Pair<Icon name="right" size={15}/></button></div><span aria-live="polite">{length?`Position ${step+1} of ${length}`:'Both paths are empty'}</span><button disabled={diff.identical} onClick={()=>setStep(Math.min(diff.prefix,last))}>Jump to Difference</button><button disabled={step===0} onClick={()=>setStep(0)}>Restart Comparison</button></div>
    <div className="comparison-columns">{[{side:'A',index:left,scenario:a,set:setLeft,other:right},{side:'B',index:right,scenario:b,set:setRight,other:left}].map(({side,index,scenario,set,other})=>{
      const active=nodes.get(scenario.steps[step]);
      return <section className="comparison-path" key={side} aria-label={'Path '+side}>
        <label htmlFor={'compare-path-'+side}>Path {side}</label><select id={'compare-path-'+side} value={index} onChange={e=>{set(Number(e.target.value));setStep(0);}}>{document.scenarios.map((s,i)=><option key={i} value={i} disabled={i===other}>{s.name}</option>)}</select>
        <p className="comparison-path-meta">{scenario.steps.length} steps · {new Set(scenario.steps).size} nodes</p>
        {scenario.description&&<p className="reader-context">{scenario.description}</p>}
        <div className="comparison-current" aria-live="polite"><span className="section-overline">{active?'CURRENT STEP':scenario.steps.length?'PATH FINISHED':'EMPTY PATH'}</span><strong>{active?.label??(scenario.steps.length?'No step at this position.':'No steps in this scenario.')}</strong>{active?.notes&&<p>{active.notes}</p>}</div>
        <ol className="comparison-steps" aria-label={'Path '+side+' steps'}>{scenario.steps.map((id,i)=>{
          const node=nodes.get(id)!;return <li key={i}><button aria-current={step===i?'step':undefined} onClick={()=>setStep(i)} aria-label={`Path ${side}, step ${i+1}: ${node.label}`}><span className="comparison-step-number">{i+1}</span><span className={'node-type '+(node.type??'process')} aria-hidden="true"><NodeGlyph kind={node.type??'process'}/></span><span className="comparison-step-label">{node.label}</span><span className={'comparison-node-badge '+(diff.shared.has(id)?'shared':'unique')}>{diff.shared.has(id)?'Shared':'Only '+side}</span></button></li>;
        })}</ol>
        <button className="full-width" disabled={!scenario.steps.length} onClick={()=>onExplore(index,Math.min(step,scenario.steps.length-1))}>Open Path {side} in Playback<Icon name="right" size={15}/></button>
      </section>;
    })}</div>
  </Dialog>;
}
