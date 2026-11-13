import type { Diagram } from '../lib/model';
import { Icon } from './Icon';
export interface GuidedPlayback {
  started:boolean; chosen:boolean; choiceStep:number;
  onStart:()=>void; onChoose:(scenario:number)=>void; onRestart:()=>void;
}
export function Playback({document, scenario, step, readOnly, onScenario, onStep, guided}: {
  document: Diagram; scenario: number; step: number; readOnly: boolean;
  onScenario: (index: number) => void; onStep: (index: number) => void;
  guided?:GuidedPlayback;
}) {
  const current = document.scenarios[scenario];
  const byId = new Map(document.nodes.map(n => [n.id,n]));
  const active = byId.get(current.steps[step]);
  const waitingForChoice=!!guided&&!guided.chosen&&step>=guided.choiceStep;
  if(guided&&!guided.started)return <section className="walkthrough-intro"><p className="section-overline">INTERACTIVE WALKTHROUGH</p><h2>A cache failure. Two different outcomes.</h2><p className="hint">Follow one read request through an API, Redis and PostgreSQL. When Redis fails, you decide how the API responds.</p><p className="reader-context">Illustrative scenario, not a live Redis outage or a benchmark. Any timing figures are illustrative.</p><button className="primary full-width" onClick={guided.onStart}><Icon name="play" size={16}/>Start Walkthrough</button><p className="hint">No account needed. Your local draft stays unchanged.</p><a href="/">Back to Workspace</a></section>;
  return <section className="playback-panel"><div className="section-heading"><h2>Scenario Playback</h2><span className="section-tag">{document.scenarios.length} paths</span></div><p className="hint">Follow a path through your system, one step at a time.</p>
    {!guided&&<><label htmlFor="scenario">Active Scenario</label><select id="scenario" value={scenario} onChange={e => onScenario(Number(e.target.value))}>{document.scenarios.map((s,i) => <option value={i} key={i}>{s.name}{!readOnly && s.review?.length ? ' — Needs Review' : ''}</option>)}</select></>}
    {guided&&<p className="walkthrough-context">Illustrative walkthrough · {guided.chosen?current.name:'Choose at the cache failure'}</p>}
    {current.description&&(!guided||guided.chosen)&&<p className="reader-context">{current.description}</p>}
    <p id="step" aria-live="polite">{active ? `${step+1} / ${current.steps.length} · ${active.label}` : 'This scenario has no steps yet.'}</p>
    {active?.notes && <div className="reader-context"><strong>Step Notes</strong><p>{active.notes}</p></div>}
    {guided&&step===guided.choiceStep&&<div className="walkthrough-choices"><h3>Redis is down. What should the API do?</h3><p className="hint">Choose a response to see its consequences.</p>{document.scenarios.map((choice,index)=><button key={choice.name} onClick={()=>guided.onChoose(index)}><strong>{choice.name}</strong><span>{choice.description}</span></button>)}</div>}
    {guided&&step===current.steps.length-1&&<div className="walkthrough-outcome" role="status"><strong>{scenario===0?'Outcome: the customer gets the data.':'Outcome: this request fails; database capacity is protected.'}</strong><p>{current.description}</p><button onClick={()=>onStep(guided.choiceStep)}>Explore the Other Choice</button></div>}
    <progress id="progress" aria-label="Scenario Playback Progress" aria-valuetext={current.steps.length ? `Step ${step+1} of ${current.steps.length}` : 'No Steps'} max={Math.max(1,current.steps.length)} value={current.steps.length ? step+1 : 0}/>
    <ol id="timeline" aria-label="Playback Steps">{current.steps.map((id,i) => <li key={i}><button disabled={!!guided&&!guided.chosen&&i>guided.choiceStep} onClick={() => onStep(i)} aria-current={i === step ? 'step' : undefined} aria-label={`Step ${i+1}: ${byId.get(id)!.label}`}>{byId.get(id)!.label}</button></li>)}</ol>
    <div className="actions playback-actions"><button id="prev" disabled={step === 0} onClick={() => onStep(step-1)}><Icon name="left" size={15}/>Previous</button><button id="next" className="primary" disabled={step+1 >= current.steps.length||waitingForChoice} onClick={() => onStep(step+1)}>Next Step<Icon name="right" size={15}/></button></div>
    <div className="playback-footer"><button id="restart" className="quiet-button" disabled={!guided&&step===0} onClick={() => guided?guided.onRestart():onStep(0)}><Icon name="restart" size={14}/>{guided?'Restart Walkthrough':'Restart'}</button><span><kbd>←</kbd><kbd>→</kbd> Navigate</span></div>
    {guided&&<a className="walkthrough-back" href="/">Back to Workspace</a>}
  </section>;
}
